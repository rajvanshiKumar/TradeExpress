import prisma from '../config/db.js';

export async function listProducts({ category, search, sort = 'relevance', limit = 50, page = 1 } = {}) {
  const where = { status: 'Active' };

  if (category) {
    where.categorySlug = category;
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q } },
      { summary: { contains: q } },
      { subcategory: { contains: q } },
      { sku: { contains: q } },
    ];
  }

  const orderBy = [];
  if (sort === 'price-asc') orderBy.push({ price: 'asc' });
  else if (sort === 'price-desc') orderBy.push({ price: 'desc' });
  else if (sort === 'newest') orderBy.push({ createdAt: 'desc' });
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
      },
    }),
  ]);

  return {
    total,
    page: parseInt(page, 10),
    totalPages: Math.ceil(total / take),
    products: products.map(formatProduct),
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
