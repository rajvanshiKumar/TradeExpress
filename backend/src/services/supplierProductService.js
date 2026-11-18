import prisma from '../config/db.js';
import { assertSupplierCanTrade } from './supplierDeletionService.js';
import * as XLSX from 'xlsx';
import { assertHierarchy, buildProductSpecifications, requireCategory, splitSpecifications } from './productSpecService.js';
import { resolveAttributeSchema } from '../data/categoryAttributes.js';

/** Previously saved values that still exist in the schema of the (possibly changed) category. */
function keepCompatibleValues(category, subcategory, productType, values = {}) {
  const override = category.attributes && typeof category.attributes === 'object' ? category.attributes.specSchema : null;
  const keys = new Set(resolveAttributeSchema(category.slug, subcategory, productType, override).attributes.map((a) => a.key));
  return Object.fromEntries(Object.entries(values || {}).filter(([key]) => keys.has(key)));
}

/** The free-form part of a stored display map (labels not produced by the structured values). */
function customOnly(display = {}, spec = null) {
  if (!spec) return display;
  const { ['Product Type']: _type, ...rest } = display; // eslint-disable-line no-unused-vars
  return rest;
}

/** A deleted product keeps its row (order history stays intact) but is gone from every supplier and buyer view. */
export const DELETED_STATUS = 'Deleted';

/**
 * The one ownership rule for supplier products: the product's supplierId is the signed-in supplier.
 * (Company names are not unique, so they are never used to decide ownership.)
 */
export const ownedProductsWhere = (supplierUser) => ({ supplierId: supplierUser.id, status: { not: DELETED_STATUS } });

function assertOwner(supplierUser, existing, verb) {
  if (supplierUser.role === 'ADMIN' || supplierUser.role === 'SUPER_ADMIN') return;
  if (!existing || existing.supplierId !== supplierUser.id || existing.status === DELETED_STATUS) {
    const error = new Error(existing && existing.supplierId !== supplierUser.id ? `You do not have permission to ${verb} this product.` : 'Product not found.');
    error.statusCode = existing && existing.supplierId !== supplierUser.id ? 403 : 404;
    throw error;
  }
}

export async function createSupplierProduct(supplierUser, data) {
  // No new listings while an approved account deletion is in its grace period
  await assertSupplierCanTrade(supplierUser.id);
  const companyId = supplierUser.companyId || supplierUser.company || supplierUser.id;
  const sku = data.sku || `TS-P-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
  const slug = (data.name || 'product')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') + `-${Date.now().toString(36)}`;

  if (Array.isArray(data.images) && data.images.length > 8) {
    const error = new Error('Maximum 8 product images allowed.');
    error.statusCode = 400;
    throw error;
  }

  const rawImages = Array.isArray(data.images) ? data.images.filter(Boolean).slice(0, 8) : [];
  const primaryPhoto = data.photo || rawImages[0] || null;
  const videoUrl = data.videoUrl || data.video || null;

  // The category must exist: a product is never filed under a different category (400 instead)
  const category = await requireCategory(data.categorySlug || data.category);
  const subcategory = data.subcategory ? String(data.subcategory).trim() : null;
  const productType = data.productType ? String(data.productType).trim() : null;
  assertHierarchy(category, subcategory, productType);
  // Category-specific specifications validated against the category schema (400 with field errors)
  const specifications = buildProductSpecifications({
    category, subcategory, productType, specValues: data.specValues, customSpecifications: data.specifications,
  });

  const finalCategorySlug = category.slug;

  const product = await prisma.product.create({
    data: {
      sku,
      slug,
      name: data.name.trim(),
      companyId: String(companyId),
      supplierId: supplierUser.id,
      categorySlug: finalCategorySlug,
      subcategory,
      summary: data.summary || data.name,
      description: data.description || data.summary || data.name,
      photo: primaryPhoto,
      videoUrl: videoUrl,
      currency: data.currency || 'INR',
      price: Number(data.price),
      unit: data.unit || 'piece',
      moq: parseInt(data.moq, 10) || 1,
      stock: parseInt(data.stock, 10) || 0,
      leadTimeDays: parseInt(data.leadTimeDays, 10) || 7,
      hsnCode: data.hsnCode ? String(data.hsnCode).trim() : '8471',
      gstRate: data.gstRate !== undefined ? Number(data.gstRate) : 18.0,
      sampleAvailable: Boolean(data.sampleAvailable ?? true),
      samplePrice: data.samplePrice ? Number(data.samplePrice) : null,
      weightKg: data.weightKg ? Number(data.weightKg) : 1.0,
      status: data.status || 'Active',
      moderationStatus: 'APPROVED', // Ready for immediate listing
      variants: data.variants || null,
      specifications,
      packaging: data.packaging || {},
      priceTiers: data.priceTiers || [],
      images: rawImages.length > 0
        ? {
            create: rawImages.map((url, index) => ({
              url,
              isPrimary: index === 0,
              sortOrder: index,
            })),
          }
        : undefined,
    },
    include: {
      category: true,
      images: true,
    },
  });

  return { ...product, ...splitSpecifications(product.specifications) };
}

export async function updateSupplierProduct(supplierUser, productId, data) {
  // Products hidden for an approved account deletion cannot be put back on sale during the grace period
  if (data?.status === 'Active') await assertSupplierCanTrade(supplierUser.id);
  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) {
    const error = new Error('Product not found.');
    error.statusCode = 404;
    throw error;
  }

  assertOwner(supplierUser, existing, 'edit');

  if (Array.isArray(data.images) && data.images.length > 8) {
    const error = new Error('Maximum 8 product images allowed.');
    error.statusCode = 400;
    throw error;
  }

  // Category, hierarchy and specifications are validated BEFORE anything is changed
  const hierarchyChanged = data.categorySlug !== undefined || data.subcategory !== undefined || data.productType !== undefined;
  const specsSubmitted = data.specValues !== undefined || data.specifications !== undefined;
  let nextSpecifications;
  let nextCategorySlug;
  let nextSubcategory;
  if (hierarchyChanged || specsSubmitted) {
    const { specData: previousSpec, specifications: previousDisplay } = splitSpecifications(existing.specifications);
    const category = await requireCategory(data.categorySlug !== undefined ? data.categorySlug : existing.categorySlug);
    nextCategorySlug = category.slug;
    nextSubcategory = data.subcategory !== undefined ? (data.subcategory ? String(data.subcategory).trim() : null) : existing.subcategory;
    // A product type belongs to its subcategory: it is kept only while category and subcategory stay the same
    const moved = nextCategorySlug !== existing.categorySlug || (nextSubcategory || '') !== (existing.subcategory || '');
    const productType = data.productType !== undefined
      ? (data.productType ? String(data.productType).trim() : null)
      : (moved ? null : (previousSpec?.productType || null));
    assertHierarchy(category, nextSubcategory, productType);
    // Without new values, previously saved values are re-checked against the (possibly new) category schema
    const specValues = data.specValues !== undefined ? data.specValues : (previousSpec ? keepCompatibleValues(category, nextSubcategory, productType, previousSpec.values) : undefined);
    nextSpecifications = buildProductSpecifications({
      category,
      subcategory: nextSubcategory,
      productType,
      specValues,
      customSpecifications: data.specifications !== undefined ? data.specifications : (previousSpec ? customOnly(previousDisplay, previousSpec) : previousDisplay),
    });
  }

  const updateData = {};
  if (data.videoUrl !== undefined) updateData.videoUrl = data.videoUrl;
  else if (data.video !== undefined) updateData.videoUrl = data.video;

  // New image list (applied in the same transaction as the product update below)
  const validImages = data.images !== undefined ? (Array.isArray(data.images) ? data.images.filter(Boolean).slice(0, 8) : []) : null;
  if (validImages) {
    if (validImages.length > 0) updateData.photo = validImages[0];
    else if (data.photo !== undefined) updateData.photo = data.photo;
  }
  if (data.name) updateData.name = data.name.trim();
  if (nextCategorySlug !== undefined) updateData.categorySlug = nextCategorySlug;
  if (nextSubcategory !== undefined) updateData.subcategory = nextSubcategory;
  if (data.summary !== undefined) updateData.summary = data.summary;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.photo !== undefined) updateData.photo = data.photo;
  if (data.price !== undefined) updateData.price = Number(data.price);
  if (data.unit !== undefined) updateData.unit = data.unit;
  if (data.moq !== undefined) updateData.moq = parseInt(data.moq, 10);
  if (data.stock !== undefined) updateData.stock = parseInt(data.stock, 10);
  if (data.leadTimeDays !== undefined) updateData.leadTimeDays = parseInt(data.leadTimeDays, 10);
  if (data.hsnCode !== undefined) updateData.hsnCode = String(data.hsnCode).trim();
  if (data.gstRate !== undefined) updateData.gstRate = Number(data.gstRate);
  if (data.sampleAvailable !== undefined) updateData.sampleAvailable = Boolean(data.sampleAvailable);
  if (data.samplePrice !== undefined) updateData.samplePrice = data.samplePrice ? Number(data.samplePrice) : null;
  if (data.weightKg !== undefined) updateData.weightKg = Number(data.weightKg);
  if (data.status !== undefined) {
    // Suppliers can only show or hide a listing; deleting has its own action (keeps order history)
    if (data.status !== existing.status && !['Active', 'Hidden'].includes(data.status)) {
      const error = new Error('Status must be Active or Hidden.');
      error.statusCode = 400;
      throw error;
    }
    updateData.status = data.status;
  }
  if (data.variants !== undefined) updateData.variants = data.variants;
  if (nextSpecifications !== undefined) updateData.specifications = nextSpecifications;
  if (data.packaging !== undefined) updateData.packaging = data.packaging;
  if (data.priceTiers !== undefined) updateData.priceTiers = data.priceTiers;

  // Images and product fields change together, or not at all
  const updated = await prisma.$transaction(async (tx) => {
    if (validImages) {
      await tx.productImage.deleteMany({ where: { productId } });
      if (validImages.length > 0) {
        await tx.productImage.createMany({
          data: validImages.map((url, index) => ({ productId, url, isPrimary: index === 0, sortOrder: index })),
        });
      }
    }
    return tx.product.update({
      where: { id: productId },
      data: updateData,
      include: { category: true, images: true },
    });
  });

  return { ...updated, ...splitSpecifications(updated.specifications) };
}

export async function deleteSupplierProduct(supplierUser, productId) {
  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) {
    const error = new Error('Product not found.');
    error.statusCode = 404;
    throw error;
  }

  assertOwner(supplierUser, existing, 'delete');

  // Marked Deleted instead of removing the row, so order history stays intact
  const updated = await prisma.product.update({
    where: { id: productId },
    data: { status: DELETED_STATUS },
  });

  return updated;
}

const toSupplierProduct = (p) => ({
  ...p,
  ...splitSpecifications(p.specifications),
  price: Number(p.price),
  gstRate: Number(p.gstRate),
  weightKg: Number(p.weightKg),
  samplePrice: p.samplePrice ? Number(p.samplePrice) : null,
});

/** One of the signed-in supplier's own products (deleted or someone else's: not found). */
export async function getSupplierProduct(supplierUser, productId) {
  const product = await prisma.product.findFirst({ where: { id: String(productId), ...ownedProductsWhere(supplierUser) }, include: { category: true, images: true } });
  if (!product) {
    const error = new Error('Product not found.');
    error.statusCode = 404;
    throw error;
  }
  return toSupplierProduct(product);
}

export async function listSupplierProducts(supplierUser) {
  const where = ownedProductsWhere(supplierUser);

  const products = await prisma.product.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { category: true, images: true },
  });

  return products.map((p) => ({
    ...p,
    ...splitSpecifications(p.specifications),
    price: Number(p.price),
    gstRate: Number(p.gstRate),
    weightKg: Number(p.weightKg),
    samplePrice: p.samplePrice ? Number(p.samplePrice) : null,
  }));
}

export function generateBulkUploadTemplate() {
  const sampleRows = [
    {
      SKU: 'TS-ELEC-101',
      Name: 'Industrial Fast Charging USB-C Hub 100W',
      CategorySlug: 'consumer-electronics',
      Subcategory: 'Chargers & Adapters',
      Price: 850,
      Unit: 'piece',
      MOQ: 50,
      Stock: 2500,
      HSN_Code: '85044090',
      GST_Rate: 18,
      LeadTimeDays: 7,
      SampleAvailable: 'yes',
      WeightKg: 0.25,
      Summary: 'High-speed multi-port GaN charging hub for wholesale distribution',
      Description: 'Full aluminium chassis, overvoltage protection, 100W PD delivery',
    },
    {
      SKU: 'TS-TEXT-202',
      Name: 'Organic Cotton Crewneck Heavyweight T-Shirt 240 GSM',
      CategorySlug: 'apparel-textiles',
      Subcategory: 'Men T-Shirts',
      Price: 280,
      Unit: 'piece',
      MOQ: 100,
      Stock: 5000,
      HSN_Code: '61091000',
      GST_Rate: 5,
      LeadTimeDays: 14,
      SampleAvailable: 'yes',
      WeightKg: 0.3,
      Summary: 'Pre-shrunk 100% combed organic cotton blank shirts',
      Description: 'Custom brand labelling available. Bio-washed and double-stitched.',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ProductsTemplate');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

export async function processBulkUpload(supplierUser, fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(worksheet);

  if (!rawRows || rawRows.length === 0) {
    const error = new Error('The uploaded file contains no data rows.');
    error.statusCode = 400;
    throw error;
  }

  const companyId = supplierUser.companyId || supplierUser.company || supplierUser.id;
  const categories = await prisma.category.findMany({ select: { slug: true } });
  const validCategorySlugs = new Set(categories.map((c) => c.slug));

  const errors = [];
  const validProducts = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowNumber = i + 2; // Excel 1-indexed + header row
    const rowErrors = [];

    const name = (row.Name || row.name || '').toString().trim();
    if (!name || name.length < 3) {
      rowErrors.push('Product Name is required (at least 3 characters).');
    }

    const categorySlug = (row.CategorySlug || row.categorySlug || row.Category || '').toString().trim().toLowerCase();
    if (!categorySlug || !validCategorySlugs.has(categorySlug)) {
      rowErrors.push(`Category "${categorySlug}" is invalid. Available: ${Array.from(validCategorySlugs).join(', ')}`);
    }

    const price = parseFloat(row.Price || row.price);
    if (isNaN(price) || price <= 0) {
      rowErrors.push('Price must be a valid positive number.');
    }

    const moq = parseInt(row.MOQ || row.moq, 10);
    if (isNaN(moq) || moq < 1) {
      rowErrors.push('MOQ must be at least 1.');
    }

    const stock = parseInt(row.Stock || row.stock, 10);
    if (isNaN(stock) || stock < 0) {
      rowErrors.push('Stock cannot be negative.');
    }

    const hsn = (row.HSN_Code || row.hsnCode || row.HSN || '8471').toString().trim();
    const gst = parseFloat(row.GST_Rate || row.gstRate || 18);

    if (rowErrors.length > 0) {
      errors.push({
        row: rowNumber,
        sku: row.SKU || row.sku || `Row ${rowNumber}`,
        name: name || 'Unnamed',
        error: rowErrors.join('; '),
      });
    } else {
      const sku = (row.SKU || row.sku || '').toString().trim() || `TS-${Date.now().toString(36).toUpperCase()}-${i}`;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + `-${Date.now().toString(36)}-${i}`;
      const sampleAvail = String(row.SampleAvailable || row.sampleAvailable || 'yes').toLowerCase() !== 'no';

      validProducts.push({
        sku,
        slug,
        name,
        companyId: String(companyId),
        supplierId: supplierUser.id,
        categorySlug,
        subcategory: (row.Subcategory || row.subcategory || '').toString().trim() || null,
        summary: (row.Summary || row.summary || name).toString().trim(),
        description: (row.Description || row.description || name).toString().trim(),
        price,
        unit: (row.Unit || row.unit || 'piece').toString().trim().toLowerCase(),
        moq,
        stock,
        hsnCode: hsn,
        gstRate: isNaN(gst) ? 18.0 : gst,
        leadTimeDays: parseInt(row.LeadTimeDays || row.leadTimeDays || 7, 10) || 7,
        sampleAvailable: sampleAvail,
        weightKg: parseFloat(row.WeightKg || row.weightKg || 1.0) || 1.0,
        status: 'Active',
        moderationStatus: 'APPROVED',
      });
    }
  }

  // Insert valid products
  let insertedCount = 0;
  if (validProducts.length > 0) {
    for (const prod of validProducts) {
      try {
        await prisma.product.upsert({
          where: { sku: prod.sku },
          update: prod,
          create: prod,
        });
        insertedCount++;
      } catch (err) {
        errors.push({
          row: 'DB Insert',
          sku: prod.sku,
          name: prod.name,
          error: err.message,
        });
      }
    }
  }

  return {
    totalRows: rawRows.length,
    successCount: insertedCount,
    failedCount: errors.length,
    errors,
  };
}
