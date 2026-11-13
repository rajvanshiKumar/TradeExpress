import prisma from '../config/db.js';

/**
 * Trending categories for the quick buttons on the products page, from real marketplace activity:
 *   1. Orders in the last 30 days (each order counts once per category, so one huge order cannot dominate).
 *      Cancelled, refunded, failed and still-unpaid orders are left out.
 *   2. Whether a Super Admin has marked any of its products as trending, so a category can be promoted by hand.
 *      This counts once per category: marking many products cannot outweigh real orders.
 * Remaining places are filled by how many live products a category has. Only categories with live products appear.
 */

export const TRENDING_WINDOW_DAYS = 30;
const ADMIN_TRENDING_WEIGHT = 3;
const CACHE_MS = 10 * 60 * 1000;
const COUNTED_PAYMENTS = ['PAID', 'PARTIALLY_PAID', 'COD'];
const EXCLUDED_ORDER_STATUSES = ['CANCELLED', 'REFUNDED'];
const LIVE_PRODUCT = { status: 'Active', moderationStatus: 'APPROVED' };

let cache = { at: 0, limit: 0, value: null };

/**
 * Ranks categories. Pure, so the rules can be tested without a database.
 * orderLines: [{ orderId, categorySlug }]  adminTrending / liveProducts: { [slug]: count }
 */
export function rankTrendingCategories({ orderLines = [], adminTrending = {}, liveProducts = {}, limit = 7 }) {
  const ordersPerCategory = new Map();
  for (const { orderId, categorySlug } of orderLines) {
    if (!categorySlug || !liveProducts[categorySlug]) continue;
    if (!ordersPerCategory.has(categorySlug)) ordersPerCategory.set(categorySlug, new Set());
    ordersPerCategory.get(categorySlug).add(orderId);
  }
  const scored = Object.keys(liveProducts)
    .filter((slug) => liveProducts[slug] > 0)
    .map((slug) => ({
      slug,
      orders: ordersPerCategory.get(slug)?.size || 0,
      adminTrending: adminTrending[slug] || 0,
      liveProducts: liveProducts[slug],
    }))
    // A Super Admin mark counts once per category, so marking many products cannot outweigh real orders
    .map((row) => ({ ...row, score: row.orders + (row.adminTrending > 0 ? ADMIN_TRENDING_WEIGHT : 0) }));

  return scored
    .sort((a, b) => b.score - a.score || b.liveProducts - a.liveProducts || a.slug.localeCompare(b.slug))
    .slice(0, Math.max(1, Math.min(20, limit)));
}

const countBySlug = (rows) => Object.fromEntries(rows.map((row) => [row.categorySlug, row._count._all]));

export async function getTrendingCategories({ limit = 7 } = {}) {
  if (cache.value && cache.limit === limit && Date.now() - cache.at < CACHE_MS) return cache.value;

  const since = new Date(Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [lines, adminRows, liveRows, categories] = await Promise.all([
    prisma.orderItem.findMany({
      where: {
        productId: { not: null },
        order: {
          createdAt: { gte: since },
          orderStatus: { notIn: EXCLUDED_ORDER_STATUSES },
          paymentStatus: { in: COUNTED_PAYMENTS },
        },
      },
      select: { orderId: true, product: { select: { categorySlug: true } } },
      take: 20000,
    }),
    prisma.product.groupBy({ by: ['categorySlug'], where: { ...LIVE_PRODUCT, trending: true }, _count: { _all: true } }),
    prisma.product.groupBy({ by: ['categorySlug'], where: LIVE_PRODUCT, _count: { _all: true } }),
    prisma.category.findMany({ select: { slug: true, name: true } }),
  ]);

  const names = new Map(categories.map((category) => [category.slug, category.name]));
  const ranked = rankTrendingCategories({
    orderLines: lines.map((line) => ({ orderId: line.orderId, categorySlug: line.product?.categorySlug })),
    adminTrending: countBySlug(adminRows),
    liveProducts: countBySlug(liveRows),
    limit,
  }).filter((row) => names.has(row.slug));

  const value = ranked.map((row) => ({ slug: row.slug, name: names.get(row.slug), orders: row.orders, liveProducts: row.liveProducts }));
  cache = { at: Date.now(), limit, value };
  return value;
}

/** Test helper: forgets the cached ranking. */
export function clearTrendingCache() {
  cache = { at: 0, limit: 0, value: null };
}
