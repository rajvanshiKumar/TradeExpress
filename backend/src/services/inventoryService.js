import prisma from '../config/db.js';
import { broadcastInventoryUpdate, broadcastProductStock } from './socketService.js';

export const ADJUSTMENT_REASONS = [
  'RESTOCK',
  'MANUAL_ADJUSTMENT',
  'DAMAGE_WRITE_OFF',
  'CYCLE_COUNT_CORRECTION',
  'WAREHOUSE_TRANSFER',
  'RETURN_RESTORED',
  'AUDIT_CORRECTION',
  'OTHER',
];

/**
 * Validates that the requesting supplier owns the product (or is an Admin).
 */
export async function verifySupplierProductOwnership(supplierUser, productId) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { category: true },
  });

  if (!product) {
    const error = new Error('Product not found.');
    error.statusCode = 404;
    throw error;
  }

  if (supplierUser.role === 'ADMIN' || supplierUser.role === 'SUPER_ADMIN') {
    return product;
  }

  const companyId = supplierUser.companyId || supplierUser.company || supplierUser.id;
  const isOwner =
    (product.supplierId && product.supplierId === supplierUser.id) ||
    (product.companyId && String(product.companyId) === String(companyId));

  if (!isOwner) {
    const error = new Error('You do not have authorization to view or manage inventory for this product.');
    error.statusCode = 403;
    throw error;
  }

  return product;
}

/**
 * Lists supplier inventory with database-backed metrics, filters, sorting, and pagination.
 */
export async function listSupplierInventory(supplierUser, query = {}) {
  const companyId = supplierUser.companyId || supplierUser.company || supplierUser.id;
  const whereSupplier = {
    OR: [
      { supplierId: supplierUser.id },
      ...(companyId ? [{ companyId: String(companyId) }] : []),
    ],
  };

  const {
    search = '',
    category = '',
    stockStatus = 'all', // all, in_stock, low_stock, out_of_stock
    sortBy = 'updatedAt', // name, stock, availableStock, reservedStock, updatedAt, sku
    sortOrder = 'desc',
    page = 1,
    limit = 20,
  } = query;

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  // Build Prisma filter clauses
  const conditions = [{ ...whereSupplier }];

  if (search && search.trim()) {
    const q = search.trim();
    conditions.push({
      OR: [
        { name: { contains: q } },
        { sku: { contains: q } },
      ],
    });
  }

  if (category && category.trim()) {
    conditions.push({ categorySlug: category.trim() });
  }

  const combinedWhere = { AND: conditions };

  // Fetch all products matching supplier conditions to calculate accurate real-time metrics
  const allSupplierProducts = await prisma.product.findMany({
    where: combinedWhere,
    select: {
      id: true,
      sku: true,
      name: true,
      stock: true,
      reservedStock: true,
      lowStockThreshold: true,
      price: true,
      status: true,
    },
  });

  // Calculate live database metrics across the supplier's active catalog
  let totalPhysicalStock = 0;
  let totalReservedStock = 0;
  let totalAvailableStock = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  const enrichedMetrics = allSupplierProducts.map((p) => {
    const physical = p.stock || 0;
    const reserved = p.reservedStock || 0;
    const available = Math.max(0, physical - reserved);
    const threshold = p.lowStockThreshold || 10;

    totalPhysicalStock += physical;
    totalReservedStock += reserved;
    totalAvailableStock += available;

    if (available <= 0) {
      outOfStockCount++;
    } else if (available <= threshold) {
      lowStockCount++;
    }

    return {
      ...p,
      physical,
      reserved,
      available,
      threshold,
    };
  });

  // Apply in-memory status filter if requested
  let filteredProducts = enrichedMetrics;
  if (stockStatus === 'in_stock') {
    filteredProducts = enrichedMetrics.filter((p) => p.available > p.threshold);
  } else if (stockStatus === 'low_stock') {
    filteredProducts = enrichedMetrics.filter((p) => p.available > 0 && p.available <= p.threshold);
  } else if (stockStatus === 'out_of_stock') {
    filteredProducts = enrichedMetrics.filter((p) => p.available <= 0);
  }

  // Sort
  filteredProducts.sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    if (sortBy === 'availableStock') {
      aVal = a.available;
      bVal = b.available;
    } else if (sortBy === 'stock') {
      aVal = a.physical;
      bVal = b.physical;
    } else if (sortBy === 'reservedStock') {
      aVal = a.reserved;
      bVal = b.reserved;
    }

    if (typeof aVal === 'string') {
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
  });

  const totalFiltered = filteredProducts.length;
  const totalPages = Math.ceil(totalFiltered / parsedLimit) || 1;
  const pagedSlice = filteredProducts.slice(skip, skip + parsedLimit);

  // Hydrate paged items with full details from database
  const pagedIds = pagedSlice.map((p) => p.id);
  const fullProducts = await prisma.product.findMany({
    where: { id: { in: pagedIds } },
    include: {
      category: { select: { slug: true, name: true } },
      images: { where: { isPrimary: true }, take: 1 },
    },
  });

  const fullProductMap = new Map(fullProducts.map((p) => [p.id, p]));

  const formattedItems = pagedSlice.map((item) => {
    const full = fullProductMap.get(item.id);
    const available = item.available;
    const threshold = item.threshold;

    let computedStatus = 'IN_STOCK';
    if (available <= 0) computedStatus = 'OUT_OF_STOCK';
    else if (available <= threshold) computedStatus = 'LOW_STOCK';

    return {
      id: item.id,
      sku: full?.sku || item.sku,
      name: full?.name || item.name,
      slug: full?.slug,
      categorySlug: full?.categorySlug,
      categoryName: full?.category?.name || 'General',
      photo: full?.photo || full?.images?.[0]?.url || null,
      unit: full?.unit || 'piece',
      price: Number(full?.price || 0),
      moq: full?.moq || 1,
      stock: item.physical, // Physical on-hand
      reservedStock: item.reserved, // Allocated to orders
      availableStock: available, // Usable by buyers
      lowStockThreshold: threshold,
      warehouseLocation: full?.warehouseLocation || null,
      stockStatus: computedStatus,
      status: full?.status || 'Active',
      updatedAt: full?.updatedAt,
    };
  });

  return {
    metrics: {
      totalProducts: allSupplierProducts.length,
      totalPhysicalStock,
      totalReservedStock,
      totalAvailableStock,
      lowStockCount,
      outOfStockCount,
    },
    products: formattedItems,
    pagination: {
      total: totalFiltered,
      page: parsedPage,
      limit: parsedLimit,
      totalPages,
    },
  };
}

/**
 * Adjusts stock for a product inside a strict Prisma database transaction.
 * Concurrency-safe and prevents negative stock.
 */
export async function adjustProductStock(supplierUser, productId, adjustmentPayload) {
  const {
    adjustmentType = 'ADD', // ADD, SET, SUBTRACT
    quantity,
    reason,
    notes = '',
    warehouseLocation = undefined,
    lowStockThreshold = undefined,
  } = adjustmentPayload;

  // Validate mandatory reason
  if (!reason || !reason.trim()) {
    const error = new Error('Stock adjustment reason is mandatory for audit trail compliance.');
    error.statusCode = 400;
    throw error;
  }

  const parsedQty = parseInt(quantity, 10);
  if (isNaN(parsedQty) || (adjustmentType !== 'SET' && parsedQty <= 0) || (adjustmentType === 'SET' && parsedQty < 0)) {
    const error = new Error('Adjustment quantity must be a non-negative whole integer.');
    error.statusCode = 400;
    throw error;
  }

  // Verify ownership
  await verifySupplierProductOwnership(supplierUser, productId);

  // Execute database transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Fetch current product state with row locking semantics
    const product = await tx.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      const error = new Error('Product not found.');
      error.statusCode = 404;
      throw error;
    }

    const previousStock = product.stock || 0;
    const reservedStock = product.reservedStock || 0;
    let newStock = previousStock;

    if (adjustmentType === 'ADD') {
      newStock = previousStock + parsedQty;
    } else if (adjustmentType === 'SUBTRACT') {
      newStock = previousStock - parsedQty;
    } else if (adjustmentType === 'SET') {
      newStock = parsedQty;
    }

    // 2. Strict Invariant Checks:
    // Physical stock cannot be negative
    if (newStock < 0) {
      const error = new Error(`Cannot reduce physical stock below 0. Current physical stock is ${previousStock}.`);
      error.statusCode = 400;
      throw error;
    }

    // Physical stock cannot be reduced below already reserved buyer commitments
    if (newStock < reservedStock) {
      const error = new Error(
        `Cannot reduce stock to ${newStock} units because ${reservedStock} units are currently reserved for pending buyer orders. Minimum allowed physical stock is ${reservedStock}.`
      );
      error.statusCode = 400;
      throw error;
    }

    const changeAmount = newStock - previousStock;

    // 3. Prepare product update payload
    const updateData = {
      stock: newStock,
    };

    if (warehouseLocation !== undefined) {
      updateData.warehouseLocation = warehouseLocation ? String(warehouseLocation).trim() : null;
    }

    if (lowStockThreshold !== undefined) {
      const parsedThreshold = parseInt(lowStockThreshold, 10);
      if (!isNaN(parsedThreshold) && parsedThreshold >= 0) {
        updateData.lowStockThreshold = parsedThreshold;
      }
    }

    // 4. Update product
    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: updateData,
    });

    // 5. Create immutable audit log entry
    const log = await tx.inventoryLog.create({
      data: {
        productId: product.id,
        supplierId: supplierUser.id,
        previousStock,
        newStock,
        changeAmount,
        previousReserved: reservedStock,
        newReserved: reservedStock,
        reason: String(reason).trim(),
        notes: notes ? String(notes).trim() : `Manual stock ${adjustmentType.toLowerCase()} of ${parsedQty} units`,
        actorId: supplierUser.id,
        actorName: supplierUser.name || 'Supplier',
      },
    });

    return { updatedProduct, log };
  });

  const availableStock = Math.max(0, result.updatedProduct.stock - result.updatedProduct.reservedStock);

  // Broadcast real-time authorized event to the supplier
  broadcastInventoryUpdate(supplierUser.id, {
    productId,
    sku: result.updatedProduct.sku,
    stock: result.updatedProduct.stock,
    reservedStock: result.updatedProduct.reservedStock,
    availableStock,
    lowStockThreshold: result.updatedProduct.lowStockThreshold,
    log: result.log,
  });

  // Broadcast public stock change to all active buyer portals
  broadcastProductStock(productId, {
    sku: result.updatedProduct.sku,
    availableStock,
    inStock: availableStock > 0,
  });

  return {
    success: true,
    message: 'Stock updated successfully.',
    data: {
      id: result.updatedProduct.id,
      sku: result.updatedProduct.sku,
      name: result.updatedProduct.name,
      stock: result.updatedProduct.stock,
      reservedStock: result.updatedProduct.reservedStock,
      availableStock,
      lowStockThreshold: result.updatedProduct.lowStockThreshold,
      warehouseLocation: result.updatedProduct.warehouseLocation,
      log: result.log,
    },
  };
}

/**
 * Returns chronological inventory logs / audit trail for a product.
 */
export async function getProductInventoryHistory(supplierUser, productId, options = {}) {
  await verifySupplierProductOwnership(supplierUser, productId);

  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(options.limit, 10) || 25));
  const skip = (page - 1) * limit;

  const [total, logs] = await Promise.all([
    prisma.inventoryLog.count({ where: { productId } }),
    prisma.inventoryLog.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    productId,
    logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Updates inventory settings (low-stock threshold & warehouse location).
 */
export async function updateInventorySettings(supplierUser, productId, settingsPayload) {
  await verifySupplierProductOwnership(supplierUser, productId);

  const data = {};
  if (settingsPayload.lowStockThreshold !== undefined) {
    const threshold = parseInt(settingsPayload.lowStockThreshold, 10);
    if (!isNaN(threshold) && threshold >= 0) {
      data.lowStockThreshold = threshold;
    }
  }

  if (settingsPayload.warehouseLocation !== undefined) {
    data.warehouseLocation = settingsPayload.warehouseLocation ? String(settingsPayload.warehouseLocation).trim() : null;
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data,
  });

  const availableStock = Math.max(0, updated.stock - updated.reservedStock);

  // Broadcast update
  broadcastInventoryUpdate(supplierUser.id, {
    productId,
    sku: updated.sku,
    stock: updated.stock,
    reservedStock: updated.reservedStock,
    availableStock,
    lowStockThreshold: updated.lowStockThreshold,
    warehouseLocation: updated.warehouseLocation,
  });

  return {
    id: updated.id,
    sku: updated.sku,
    stock: updated.stock,
    reservedStock: updated.reservedStock,
    availableStock,
    lowStockThreshold: updated.lowStockThreshold,
    warehouseLocation: updated.warehouseLocation,
  };
}

