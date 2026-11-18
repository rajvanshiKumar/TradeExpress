import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../../src/config/db.js';
import * as cart from '../../src/services/cartService.js';
import { deleteNotification } from '../../src/services/notificationService.js';

// All database access goes through this in-memory stub; nothing reaches a real database.
let stub;
prisma.$use(async (params) => (stub ? stub(params) : null));

const GHEE = { id: 'db-ghee', sku: 'GH-1', slug: 'cow-ghee', name: 'Cow Ghee', price: 650, priceTiers: [{ minQty: 50, price: 600 }], photo: null, unit: 'kg', moq: 10, stock: 100, reservedStock: 0, committedStock: 0, status: 'Active', variants: { Pack: ['1 kg', '5 kg'] }, supplierId: 's1', companyId: 'c1', gstRate: 5 };
const OIL = { ...GHEE, id: 'db-oil', sku: 'OIL-1', slug: 'mustard-oil', name: 'Mustard Oil', variants: {}, priceTiers: [] };

function makeDb(t, { products = [GHEE, OIL], carts = [], items = [] } = {}) {
  const db = { products, carts: carts.map((c) => ({ ...c })), items: items.map((i) => ({ ...i })), locks: 0, seq: 0 };
  const withProduct = (i) => ({ ...i, product: db.products.find((p) => p.id === i.productId) });
  stub = async ({ model, action, args = {} }) => {
    if (action === 'queryRaw') { db.locks += 1; return []; }
    if (model === 'Product') {
      if (action === 'findUnique') return db.products.find((p) => p.id === args.where.id) || null;
      if (action === 'findFirst') return db.products.find((p) => args.where.OR.some((c) => (c.sku && p.sku === c.sku) || (c.slug && p.slug === c.slug))) || null;
    }
    if (model === 'Cart') {
      if (action === 'findMany' || action === 'findFirst') { const rows = db.carts.filter((c) => c.userId === args.where.userId); return action === 'findMany' ? rows : rows[0] || null; }
      if (action === 'create') { const c = { id: `cart-${++db.seq}`, userId: args.data.userId, createdAt: new Date() }; db.carts.push(c); return c; }
      if (action === 'deleteMany') { db.carts = db.carts.filter((c) => !args.where.id.in.includes(c.id)); return { count: 1 }; }
    }
    if (model === 'CartItem') {
      const match = (i) => Object.entries(args.where || {}).every(([k, v]) => (v && typeof v === 'object' && v.in ? v.in.includes(i[k]) : i[k] === v));
      if (action === 'findMany') return db.items.filter(match).map((i) => (args.include ? withProduct(i) : i));
      if (action === 'findFirst') { const i = db.items.find(match); return i ? withProduct(i) : null; }
      if (action === 'create') { const i = { id: `item-${++db.seq}`, createdAt: new Date(), ...args.data }; db.items.push(i); return i; }
      if (action === 'update') { const i = db.items.find((x) => x.id === args.where.id); Object.assign(i, args.data); return i; }
      if (action === 'updateMany') { db.items.filter(match).forEach((i) => Object.assign(i, args.data)); return { count: 1 }; }
      if (action === 'deleteMany') { const before = db.items.length; db.items = db.items.filter((i) => !match(i)); return { count: before - db.items.length }; }
    }
    return null;
  };
  t.after(() => { stub = null; });
  return db;
}

describe('Buyer cart (database, server-authoritative)', () => {
  it('adds the exact product by SKU/slug, with server prices; locks the buyer for each change', async (t) => {
    const db = makeDb(t);
    const res = await cart.addItem('b1', { productId: 'TS-P-1001', sku: 'GH-1', quantity: 10, variant: { Pack: '1 kg' } });
    assert.equal(res.items.length, 1);
    assert.equal(res.items[0].product.id, 'db-ghee', 'the catalogue product maps to the real database product');
    assert.equal(res.items[0].unitPrice, 650);
    assert.equal(res.totals.subtotal, 6500);
    assert.equal(db.locks, 1);
    assert.equal(db.carts.length, 1);
  });

  it('same product + same variant adds to one line; another variant stays separate; tier price applies', async (t) => {
    makeDb(t);
    await cart.addItem('b1', { sku: 'GH-1', quantity: 20, variant: { Pack: '1 kg' } });
    await cart.addItem('b1', { sku: 'GH-1', quantity: 30, variant: { Pack: '1 kg' } });
    const res = await cart.addItem('b1', { sku: 'GH-1', quantity: 10, variant: { Pack: '5 kg' } });
    assert.equal(res.items.length, 2);
    const oneKg = res.items.find((i) => i.variant.Pack === '1 kg');
    assert.equal(oneKg.quantity, 50);
    assert.equal(oneKg.unitPrice, 600, '50+ tier price');
  });

  it('refuses unknown products, below MOQ, above stock and invalid variants (nothing written)', async (t) => {
    const db = makeDb(t);
    await assert.rejects(cart.addItem('b1', { sku: 'NOPE', quantity: 10 }), (e) => e.errorCode === 'PRODUCT_UNAVAILABLE');
    await assert.rejects(cart.addItem('b1', { sku: 'GH-1', quantity: 5 }), (e) => e.errorCode === 'BELOW_MOQ');
    await assert.rejects(cart.addItem('b1', { sku: 'GH-1', quantity: 101 }), (e) => e.errorCode === 'ABOVE_STOCK');
    await assert.rejects(cart.addItem('b1', { sku: 'GH-1', quantity: 10, variant: { Pack: '9 kg' } }), (e) => e.errorCode === 'BAD_VARIANT');
    await assert.rejects(cart.addItem('b1', { sku: 'GH-1', quantity: 10.5 }), (e) => e.errorCode === 'BAD_QUANTITY');
    assert.equal(db.items.length, 0);
  });

  it('a buyer can only change or remove lines in their own cart', async (t) => {
    const db = makeDb(t, { carts: [{ id: 'cart-a', userId: 'buyerA', createdAt: new Date() }, { id: 'cart-b', userId: 'buyerB', createdAt: new Date() }], items: [{ id: 'line-b', cartId: 'cart-b', productId: 'db-oil', quantity: 10, variant: null, createdAt: new Date() }] });
    await assert.rejects(cart.updateItem('buyerA', 'line-b', { quantity: 20 }), (e) => e.errorCode === 'NOT_IN_CART');
    await cart.removeItem('buyerA', 'line-b');
    assert.equal(db.items.length, 1, "buyer B's line is untouched");
    assert.deepEqual((await cart.getCart('buyerA')).items, []);
  });

  it('update and remove persist; clear empties only this cart', async (t) => {
    makeDb(t);
    const added = await cart.addItem('b1', { sku: 'OIL-1', quantity: 10 });
    const updated = await cart.updateItem('b1', added.items[0].id, { quantity: 25 });
    assert.equal(updated.items[0].quantity, 25);
    await assert.rejects(cart.updateItem('b1', added.items[0].id, { quantity: 2 }), (e) => e.errorCode === 'BELOW_MOQ');
    assert.equal((await cart.removeItem('b1', added.items[0].id)).items.length, 0);
  });

  it('guest cart merge adds valid lines and reports the ones that no longer apply', async (t) => {
    makeDb(t);
    const res = await cart.mergeItems('b1', [{ sku: 'GH-1', quantity: 10 }, { sku: 'GONE', quantity: 10 }]);
    assert.equal(res.items.length, 1);
    assert.equal(res.skipped.length, 1);
  });

  it('variant keys ignore key order and empty values', () => {
    assert.equal(cart.variantKey({ b: '2', a: '1' }), cart.variantKey({ a: '1', b: '2', c: '' }));
    assert.equal(cart.variantKey(null), '');
  });
});

describe('Notifications: delete', () => {
  it("deletes only the user's own notification", async (t) => {
    t.after(() => { stub = null; });
    stub = async ({ model, action, args }) => (model === 'Notification' && action === 'deleteMany' ? { count: args.where.userId === 'b1' ? 1 : 0 } : null);
    assert.deepEqual(await deleteNotification('n1', 'b1'), { deleted: true });
    await assert.rejects(deleteNotification('n1', 'someone-else'), (e) => e.statusCode === 404);
  });
});
