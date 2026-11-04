import prisma from '../config/db.js';
import { availableOf, INVENTORY_STATES, publishInventoryChanges } from './inventoryLifecycleService.js';

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

  // Ownership is the product's supplier account only. (Matching on company fields let a supplier whose free-text
  // company name equalled another catalogue's company id manage that catalogue.)
  const isOwner = Boolean(product.supplierId) && product.supplierId === supplierUser.id;

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
  // Suppliers see only their own products. Admins get platform-wide oversight (optionally one supplier's).
  const isStaff = supplierUser.role === 'ADMIN' || supplierUser.role === 'SUPER_ADMIN';
  const whereSupplier = isStaff
    ? (query.supplierId ? { supplierId: String(query.supplierId) } : {})
    : { supplierId: supplierUser.id };

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
      committedStock: true,
      lowStockThreshold: true,
      price: true,
      status: true,
    },
  });

  // Calculate live database metrics across the supplier's active catalog
  let totalPhysicalStock = 0;
  let totalReservedStock = 0;
  let totalCommittedStock = 0;
  let totalAvailableStock = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  const enrichedMetrics = allSupplierProducts.map((p) => {
    const physical = p.stock || 0;
    const reserved = p.reservedStock || 0;
    const committed = p.committedStock || 0;
    const available = availableOf(p);
    const threshold = p.lowStockThreshold ?? 10;

    totalPhysicalStock += physical;
    totalReservedStock += reserved;
    totalCommittedStock += committed;
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
      committed,
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
    } else if (sortBy === 'committedStock') {
      aVal = a.committed;
      bVal = b.committed;
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

  // Platform staff see which supplier owns each product
  const supplierNames = new Map();
  if (isStaff) {
    const supplierIds = [...new Set(fullProducts.map((p) => p.supplierId).filter(Boolean))];
    const suppliers = await prisma.user.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true, company: true } });
    for (const s of suppliers) supplierNames.set(s.id, s.company || s.name);
  }

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
      reservedStock: item.reserved, // Held for orders awaiting payment
      committedStock: item.committed, // Paid / confirmed, not yet shipped
      availableStock: available, // Usable by buyers
      supplierId: full?.supplierId || null,
      ...(isStaff ? { supplierName: supplierNames.get(full?.supplierId) || null } : {}),
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
      totalCommittedStock,
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
    // 1. Lock the product row so order reservations cannot interleave with this adjustment
    const [product] = await tx.$queryRaw`
      SELECT id, sku, name, supplierId, stock, reservedStock, committedStock, lowStockThreshold
      FROM products WHERE id = ${productId} FOR UPDATE
    `;

    if (!product) {
      const error = new Error('Product not found.');
      error.statusCode = 404;
      throw error;
    }

    const previousStock = product.stock || 0;
    const reservedStock = product.reservedStock || 0;
    const committedStock = product.committedStock || 0;
    const heldStock = reservedStock + committedStock;
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

    // Physical stock cannot drop below what open orders already hold
    if (newStock < heldStock) {
      const error = new Error(
        `Cannot reduce stock to ${newStock} units because ${heldStock} units are held for open orders (${reservedStock} reserved, ${committedStock} committed). Minimum allowed on-hand stock is ${heldStock}.`
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
        supplierId: product.supplierId || supplierUser.id,
        previousStock,
        newStock,
        changeAmount,
        previousReserved: reservedStock,
        newReserved: reservedStock,
        previousCommitted: committedStock,
        newCommitted: committedStock,
        reason: String(reason).trim(),
        notes: notes ? String(notes).trim() : `Manual stock ${adjustmentType.toLowerCase()} of ${parsedQty} units`,
        actorId: supplierUser.id,
        actorName: supplierUser.name || 'Supplier',
      },
    });

    return { updatedProduct, log, availableBefore: availableOf(product) };
  }, { maxWait: 15000, timeout: 30000 });

  const availableStock = availableOf(result.updatedProduct);

  // Live update to the product's supplier and admins, public availability to buyers, low-stock alert if crossed
  publishInventoryChanges([result.updatedProduct], new Map([[productId, result.availableBefore]]));

  return {
    success: true,
    message: 'Stock updated successfully.',
    data: {
      id: result.updatedProduct.id,
      sku: result.updatedProduct.sku,
      name: result.updatedProduct.name,
      stock: result.updatedProduct.stock,
      reservedStock: result.updatedProduct.reservedStock,
      committedStock: result.updatedProduct.committedStock,
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

  const availableStock = availableOf(updated);

  publishInventoryChanges([updated]);

  return {
    id: updated.id,
    sku: updated.sku,
    stock: updated.stock,
    reservedStock: updated.reservedStock,
    committedStock: updated.committedStock,
    availableStock,
    lowStockThreshold: updated.lowStockThreshold,
    warehouseLocation: updated.warehouseLocation,
  };
}


/**
 * One product's figures plus the open orders currently holding its stock (for the detail panel).
 */
export async function getProductInventoryDetail(supplierUser, productId) {
  const product = await verifySupplierProductOwnership(supplierUser, productId);

  const items = await prisma.orderItem.findMany({
    where: {
      productId,
      order: { inventoryState: { in: [INVENTORY_STATES.RESERVED, INVENTORY_STATES.COMMITTED] } },
    },
    select: {
      quantity: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          inventoryState: true,
          orderStatus: true,
          paymentStatus: true,
          paymentMethod: true,
          buyerCompany: true,
          buyerName: true,
          reservationExpiresAt: true,
          createdAt: true,
        },
      },
    },
    orderBy: { order: { createdAt: 'desc' } },
    take: 100,
  });

  // An order can list the product on several lines; show one row per order
  const byOrder = new Map();
  for (const item of items) {
    const row = byOrder.get(item.order.id) || { ...item.order, quantity: 0 };
    row.quantity += item.quantity;
    byOrder.set(item.order.id, row);
  }

  return {
    product: {
      id: product.id,
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      supplierId: product.supplierId,
      stock: product.stock,
      reservedStock: product.reservedStock,
      committedStock: product.committedStock,
      availableStock: availableOf(product),
      lowStockThreshold: product.lowStockThreshold,
      warehouseLocation: product.warehouseLocation,
    },
    holds: [...byOrder.values()].map((o) => ({
      orderId: o.id,
      orderNumber: o.orderNumber,
      state: o.inventoryState,
      quantity: o.quantity,
      orderStatus: o.orderStatus,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      buyer: o.buyerCompany || o.buyerName,
      reservationExpiresAt: o.reservationExpiresAt,
      createdAt: o.createdAt,
    })),
  };
}
