import prisma from '../config/db.js';

export async function listProducts({
  category,
  search,
  minPrice,
  maxPrice,
  maxMoq,
  readyToShip,
  sampleAvailable,
  isNew,
  deal,
  verifiedOnly,
  sort = 'relevance',
  limit = 50,
  page = 1,
} = {}) {
  const where = { status: 'Active' };

  if (category) {
    where.categorySlug = category;
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q } },
      { summary: { contains: q } },
      { description: { contains: q } },
      { subcategory: { contains: q } },
      { sku: { contains: q } },
    ];
  }

  if (minPrice !== undefined && minPrice !== '' && !isNaN(Number(minPrice))) {
    where.price = { ...(where.price || {}), gte: Number(minPrice) };
  }
  if (maxPrice !== undefined && maxPrice !== '' && !isNaN(Number(maxPrice))) {
    where.price = { ...(where.price || {}), lte: Number(maxPrice) };
  }
  if (maxMoq !== undefined && maxMoq !== '' && !isNaN(Number(maxMoq))) {
    where.moq = { lte: Number(maxMoq) };
  }
  if (readyToShip === 'true' || readyToShip === true) {
    where.readyToShip = true;
  }
  if (sampleAvailable === 'true' || sampleAvailable === true) {
    where.sampleAvailable = true;
  }
  if (isNew === 'true' || isNew === true) {
    where.isNew = true;
  }
  if (deal === 'true' || deal === true) {
    where.deal = true;
  }

  const orderBy = [];
  if (sort === 'price-asc') orderBy.push({ price: 'asc' });
  else if (sort === 'price-desc') orderBy.push({ price: 'desc' });
  else if (sort === 'newest') orderBy.push({ createdAt: 'desc' });
  else if (sort === 'moq-asc') orderBy.push({ moq: 'asc' });
  else orderBy.push({ featured: 'desc' }, { createdAt: 'desc' });

  const take = parseInt(limit, 10);
  const skip = (parseInt(page, 10) - 1) * take;

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      take,
      skip,
      include: {
        category: {
          select: { name: true, slug: true },
        },
        images: { orderBy: { sortOrder: 'asc' } },
      },
    }),
  ]);

  // Retrieve supplier users for these products
  const supplierIds = [...new Set(products.map((p) => p.supplierId).filter(Boolean))];
  const supplierUsers = supplierIds.length
    ? await prisma.user.findMany({
        where: { id: { in: supplierIds } },
        select: { id: true, name: true, company: true, city: true, country: true, isVerified: true, kycStatus: true },
      })
    : [];
  const supplierMap = new Map(supplierUsers.map((u) => [u.id, u]));

  let formatted = products.map((p) => {
    const formattedItem = formatProduct(p);
    const sup = p.supplierId ? supplierMap.get(p.supplierId) : null;
    return {
      ...formattedItem,
      supplier: sup ? {
        id: sup.id,
        name: sup.name,
        company: sup.company || sup.name,
        city: sup.city,
        country: sup.country || 'India',
        isVerified: Boolean(sup.isVerified || sup.kycStatus === 'VERIFIED'),
        kycStatus: sup.kycStatus || 'NOT_SUBMITTED',
      } : null,
    };
  });

  if (verifiedOnly === 'true' || verifiedOnly === true) {
    formatted = formatted.filter((p) => p.supplier?.isVerified);
  }

  return {
    total,
    page: parseInt(page, 10),
    totalPages: Math.ceil(total / take),
    products: formatted,
  };
}

export async function getProductBySlug(slug) {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      images: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!product) {
    const error = new Error('Product not found.');
    error.statusCode = 404;
    throw error;
  }

  return formatProduct(product);
}

export async function getProductById(id) {
  let product = await prisma.product.findUnique({
    where: { id },
    include: { category: true },
  });

  if (!product) {
    const match = String(id).match(/(\d+)$/);
    const number = match ? match[1] : null;

    product = await prisma.product.findFirst({
      where: {
        OR: [
          { sku: id },
          ...(number ? [{ sku: { endsWith: `-${number}` } }] : []),
          { slug: id },
        ],
      },
      include: { category: true },
    });
  }

  if (!product) {
    const error = new Error('Product not found.');
    error.statusCode = 404;
    throw error;
  }

  return formatProduct(product);
}

export async function listCategories() {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { products: true } },
    },
  });

  return categories.map((cat) => ({
    id: cat.id,
    slug: cat.slug,
    name: cat.name,
    description: cat.description,
    photo: cat.photo,
    subcategories: cat.subcategories || [],
    productCount: cat._count.products,
  }));
}

export async function getCategoryBySlug(slug) {
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      products: {
        where: { status: 'Active' },
        take: 24,
      },
    },
  });

  if (!category) {
    const error = new Error('Category not found.');
    error.statusCode = 404;
    throw error;
  }

  return {
    ...category,
    products: category.products.map(formatProduct),
  };
}

function formatProduct(p) {
  return {
    ...p,
    price: Number(p.price),
    variants: p.variants || null,
    specifications: p.specifications || {},
    packaging: p.packaging || {},
    priceTiers: p.priceTiers || [],
  };
}

export async function getProductSuppliers(slugOrId) {
  // Find product first
  let product = await prisma.product.findFirst({
    where: {
      OR: [{ slug: slugOrId }, { id: slugOrId }, { sku: slugOrId }],
    },
    include: {
      category: true,
      images: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!product) {
    const error = new Error('Product not found.');
    error.statusCode = 404;
    throw error;
  }

  // 1. Find all suppliers registered in the system (genuine database users with role = SUPPLIER)
  const allSuppliers = await prisma.user.findMany({
    where: { role: 'SUPPLIER' },
    select: {
      id: true,
      name: true,
      email: true,
      company: true,
      phone: true,
      city: true,
      country: true,
      warehouseAddress: true,
      warehouseState: true,
      warehousePincode: true,
      isVerified: true,
      kycStatus: true,
      createdAt: true,
    },
  });

  // 2. Find any active product listings for this same product name or same category
  const relatedProducts = await prisma.product.findMany({
    where: {
      status: 'Active',
      OR: [
        { id: product.id },
        { name: product.name },
        { categorySlug: product.categorySlug },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      moq: true,
      stock: true,
      leadTimeDays: true,
      priceTiers: true,
      supplierId: true,
      companyId: true,
    },
  });

  // Calculate real average review ratings for suppliers from the review table
  const reviews = await prisma.review.findMany({
    include: {
      order: { select: { supplierId: true } },
    },
  });

  const ratingsBySupplier = new Map();
  for (const r of reviews) {
    const sId = r.order?.supplierId;
    if (sId) {
      if (!ratingsBySupplier.has(sId)) {
        ratingsBySupplier.set(sId, { totalRating: 0, count: 0 });
      }
      const data = ratingsBySupplier.get(sId);
      data.totalRating += r.rating;
      data.count += 1;
    }
  }

  const supplierListing = [];
  const seenSupplierIds = new Set();

  function formatSupplierEntry(supplierUser, listingProduct, isPrimary = false) {
    const isVerified = Boolean(supplierUser.isVerified || supplierUser.kycStatus === 'VERIFIED');
    const location = [supplierUser.city, supplierUser.country || 'India'].filter(Boolean).join(', ');
    const ratingData = ratingsBySupplier.get(supplierUser.id);
    const averageRating = ratingData && ratingData.count > 0 ? Math.round((ratingData.totalRating / ratingData.count) * 10) / 10 : 0;
    const reviewCount = ratingData ? ratingData.count : 0;

    const price = listingProduct ? Number(listingProduct.price) : Number(product.price);
    const moq = listingProduct ? listingProduct.moq : product.moq;
    const stock = listingProduct ? listingProduct.stock : product.stock;
    const leadTimeDays = listingProduct ? listingProduct.leadTimeDays : product.leadTimeDays;
    const priceTiers = listingProduct?.priceTiers || product.priceTiers || [];

    const companySlug = supplierUser.company
      ? supplierUser.company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      : supplierUser.id;

    return {
      supplierId: supplierUser.id,
      companyName: supplierUser.company || supplierUser.name,
      contactPerson: supplierUser.name,
      email: supplierUser.email,
      phone: supplierUser.phone,
      isVerified,
      kycStatus: supplierUser.kycStatus || 'NOT_SUBMITTED',
      location,
      city: supplierUser.city,
      country: supplierUser.country || 'India',
      availableQuantity: stock,
      moq,
      price,
      currency: product.currency || 'INR',
      priceTiers,
      leadTimeDays,
      isPrimarySupplier: isPrimary,
      productId: listingProduct?.id || product.id,
      productSlug: listingProduct?.slug || product.slug,
      productName: listingProduct?.name || product.name,
      profileSlug: companySlug,
      profileUrl: `/suppliers/${companySlug}`,
      rating: averageRating,
      reviewCount,
    };
  }

  // 1. Add primary supplier if product has supplierId
  if (product.supplierId) {
    const primarySup = allSuppliers.find((s) => s.id === product.supplierId);
    if (primarySup) {
      supplierListing.push(formatSupplierEntry(primarySup, product, true));
      seenSupplierIds.add(primarySup.id);
    }
  }

  // 2. Add suppliers with matching products in this category
  for (const rel of relatedProducts) {
    if (rel.supplierId && !seenSupplierIds.has(rel.supplierId)) {
      const sup = allSuppliers.find((s) => s.id === rel.supplierId);
      if (sup) {
        supplierListing.push(formatSupplierEntry(sup, rel, false));
        seenSupplierIds.add(sup.id);
      }
    }
  }

  // 3. If there are other suppliers registered in the database, also list them as verified wholesale suppliers
  for (const sup of allSuppliers) {
    if (!seenSupplierIds.has(sup.id)) {
      supplierListing.push(formatSupplierEntry(sup, null, false));
      seenSupplierIds.add(sup.id);
    }
  }

  return {
    product: formatProduct(product),
    totalSuppliers: supplierListing.length,
    suppliers: supplierListing,
  };
}

