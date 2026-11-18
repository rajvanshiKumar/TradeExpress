import prisma from '../config/db.js';
import { availableOf } from './inventoryLifecycleService.js';

/*
 * Buyer cart, stored in the database (carts / cart_items) and owned by the signed-in buyer only.
 *
 * - Product: resolved by its database id, or by the exact SKU / slug the catalogue shows (the same rule checkout
 *   uses). Never by name, never created from request data.
 * - Every change is validated: product Active, quantity a whole number >= MOQ and <= stock available to buyers,
 *   variant values among the product's options.
 * - Same product + same variant = one line (quantity added); a different variant is its own line.
 * - Prices and totals are calculated here (tiered prices); the client never supplies a price.
 * - Each buyer's changes run in a transaction holding a row lock on that buyer, so concurrent requests (two tabs,
 *   double clicks) cannot create duplicate lines, duplicate carts or lost quantity updates.
 */

export const MAX_QUANTITY = 1_000_000;

function fail(message, statusCode = 400, code = 'CART_ERROR') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = code;
  return error;
}

/** Stable key for a variant selection ({} / null = no variant). */
export function variantKey(variant) {
  if (!variant || typeof variant !== 'object' || Array.isArray(variant)) return '';
  const entries = Object.entries(variant).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => [String(k), String(v)]);
  entries.sort(([a], [b]) => a.localeCompare(b));
  return entries.length ? JSON.stringify(entries) : '';
}
const cleanVariant = (variant) => {
  const key = variantKey(variant);
  return key ? Object.fromEntries(JSON.parse(key)) : null;
};

export function unitPriceFor(product, quantity) {
  let price = Number(product.price);
  if (Array.isArray(product.priceTiers)) {
    for (const tier of [...product.priceTiers].sort((a, b) => b.minQty - a.minQty)) {
      if (quantity >= Number(tier.minQty)) { price = Number(tier.price); break; }
    }
  }
  return price;
}

const PRODUCT_SELECT = {
  id: true, sku: true, slug: true, name: true, price: true, priceTiers: true, photo: true, unit: true, moq: true,
  stock: true, reservedStock: true, committedStock: true, status: true, variants: true, supplierId: true, companyId: true, gstRate: true,
};

async function resolveProduct(db, { productId, sku, slug }) {
  let product = null;
  if (productId) product = await db.product.findUnique({ where: { id: String(productId) }, select: PRODUCT_SELECT }).catch(() => null);
  if (!product && (sku || slug)) {
    product = await db.product.findFirst({ where: { OR: [...(sku ? [{ sku: String(sku) }] : []), ...(slug ? [{ slug: String(slug) }] : [])] }, select: PRODUCT_SELECT });
  }
  return product;
}

function checkLine(product, quantity, variant) {
  if (!product || product.status !== 'Active') throw fail('This product is not available to order right now.', 404, 'PRODUCT_UNAVAILABLE');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) throw fail('Enter a valid quantity.', 400, 'BAD_QUANTITY');
  if (quantity < (product.moq || 1)) throw fail(`The minimum order for ${product.name} is ${product.moq} ${product.unit}(s).`, 400, 'BELOW_MOQ');
  const available = availableOf(product);
  if (available <= 0) throw fail(`${product.name} is out of stock.`, 409, 'OUT_OF_STOCK');
  if (quantity > available) throw fail(`Only ${available} ${product.unit}(s) of ${product.name} are available.`, 409, 'ABOVE_STOCK');
  const options = product.variants && typeof product.variants === 'object' ? product.variants : {};
  for (const [name, value] of Object.entries(variant || {})) {
    if (Array.isArray(options[name]) && options[name].length && !options[name].map(String).includes(String(value))) {
      throw fail(`"${value}" is not an option for ${name}.`, 400, 'BAD_VARIANT');
    }
  }
}

/** Runs `fn(tx, cart)` with the buyer row locked; finds (or creates) the buyer's single cart. */
async function withBuyerCart(userId, fn) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    const carts = await tx.cart.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    let cart = carts[0];
    if (!cart) cart = await tx.cart.create({ data: { userId }, select: { id: true } });
    if (carts.length > 1) {
      // Older data could hold several carts for one buyer: fold them into the first one
      const extra = carts.slice(1).map((c) => c.id);
      await tx.cartItem.updateMany({ where: { cartId: { in: extra } }, data: { cartId: cart.id } });
      await tx.cart.deleteMany({ where: { id: { in: extra } } });
    }
    return fn(tx, cart);
  }, { maxWait: 10000, timeout: 20000 });
}

/** The buyer's cart with server-calculated prices. Unavailable products are flagged, not silently dropped. */
export async function getCart(userId, db = prisma) {
  const cart = await db.cart.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (!cart) return { items: [], totals: { lines: 0, units: 0, subtotal: 0 } };
  const rows = await db.cartItem.findMany({ where: { cartId: cart.id }, orderBy: { createdAt: 'asc' }, include: { product: { select: PRODUCT_SELECT } } });
  const items = rows.map((row) => {
    const p = row.product;
    const unitPrice = unitPriceFor(p, row.quantity);
    const available = availableOf(p);
    return {
      id: row.id,
      quantity: row.quantity,
      variant: row.variant || null,
      unitPrice,
      lineTotal: Math.round(unitPrice * row.quantity * 100) / 100,
      issue: p.status !== 'Active' ? 'UNAVAILABLE' : available <= 0 ? 'OUT_OF_STOCK' : row.quantity > available ? 'ABOVE_STOCK' : row.quantity < p.moq ? 'BELOW_MOQ' : null,
      product: {
        id: p.id, sku: p.sku, slug: p.slug, name: p.name, photo: p.photo, unit: p.unit, moq: p.moq, available, status: p.status,
        price: Number(p.price), priceTiers: p.priceTiers || [], supplierId: p.supplierId, companyId: p.companyId, gstRate: Number(p.gstRate ?? 18),
      },
    };
  });
  return {
    items,
    totals: {
      lines: items.length,
      units: items.reduce((s, i) => s + i.quantity, 0),
      subtotal: Math.round(items.filter((i) => !i.issue).reduce((s, i) => s + i.lineTotal, 0) * 100) / 100,
    },
  };
}

async function addOne(tx, cart, { productId, sku, slug, quantity, variant }) {
  const qty = Number(quantity);
  const product = await resolveProduct(tx, { productId, sku, slug });
  const v = cleanVariant(variant);
  const key = variantKey(v);
  const lines = await tx.cartItem.findMany({ where: { cartId: cart.id, productId: product?.id ?? '__none__' } });
  const same = lines.find((l) => variantKey(l.variant) === key);
  const nextQty = (same?.quantity || 0) + qty;
  checkLine(product, Number.isInteger(qty) ? nextQty : qty, v);
  if (same) await tx.cartItem.update({ where: { id: same.id }, data: { quantity: nextQty } });
  else await tx.cartItem.create({ data: { cartId: cart.id, productId: product.id, quantity: qty, variant: v } });
}

/** Adds a product (same product + variant: quantity is added to the existing line). */
export async function addItem(userId, input) {
  await withBuyerCart(userId, (tx, cart) => addOne(tx, cart, input || {}));
  return getCart(userId);
}

/** Sets the quantity of one of the buyer's own lines. */
export async function updateItem(userId, itemId, { quantity }) {
  await withBuyerCart(userId, async (tx, cart) => {
    const line = await tx.cartItem.findFirst({ where: { id: String(itemId), cartId: cart.id }, include: { product: { select: PRODUCT_SELECT } } });
    if (!line) throw fail('This item is not in your cart.', 404, 'NOT_IN_CART');
    checkLine(line.product, Number(quantity), line.variant);
    await tx.cartItem.update({ where: { id: line.id }, data: { quantity: Number(quantity) } });
  });
  return getCart(userId);
}

/** Removes one of the buyer's own lines (removing an item that is already gone is not an error). */
export async function removeItem(userId, itemId) {
  await withBuyerCart(userId, (tx, cart) => tx.cartItem.deleteMany({ where: { id: String(itemId), cartId: cart.id } }));
  return getCart(userId);
}

export async function clearCart(userId) {
  await withBuyerCart(userId, (tx, cart) => tx.cartItem.deleteMany({ where: { cartId: cart.id } }));
  return getCart(userId);
}

/**
 * Explicit guest-to-buyer merge after sign-in: each guest line is added with the same rules.
 * Lines that are no longer valid are skipped and reported (nothing is partially written for a line).
 */
export async function mergeItems(userId, items) {
  if (!Array.isArray(items)) throw fail('Items must be a list.', 400, 'BAD_ITEMS');
  const skipped = [];
  for (const item of items.slice(0, 100)) {
    try {
      await withBuyerCart(userId, (tx, cart) => addOne(tx, cart, item || {}));
    } catch (error) {
      if (!error.statusCode) throw error;
      skipped.push({ sku: item?.sku || null, slug: item?.slug || null, reason: error.message });
    }
  }
  return { ...(await getCart(userId)), skipped };
}
