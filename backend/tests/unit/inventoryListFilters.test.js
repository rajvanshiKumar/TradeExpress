import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../../src/config/db.js';
import { listSupplierInventory } from '../../src/services/inventoryService.js';

// All database access goes through this stub; nothing reaches a real database.
let stub;
prisma.$use(async (params) => (stub ? stub(params) : null));

const SUPPLIER = { id: 'sup-1', role: 'SUPPLIER' };
const PRODUCTS = [
  { id: 'p-1', sku: 'GH-1', name: 'Cow Ghee', stock: 50, reservedStock: 0, committedStock: 0, lowStockThreshold: 10, categorySlug: 'food-beverages', supplierId: 'sup-1' },
  { id: 'p-2', sku: 'CN-1', name: 'CNC Lathe', stock: 0, reservedStock: 0, committedStock: 0, lowStockThreshold: 1, categorySlug: 'machinery', supplierId: 'sup-1' },
];

function database(t) {
  const calls = [];
  stub = async (q) => {
    calls.push(q);
    if (q.model === 'Product' && q.action === 'findMany') return PRODUCTS;
    if (q.model === 'Product' && q.action === 'groupBy') return [{ categorySlug: 'machinery' }, { categorySlug: 'food-beverages' }];
    if (q.model === 'Category' && q.action === 'findMany') return [{ slug: 'food-beverages', name: 'Food & Beverages' }, { slug: 'machinery', name: 'Industrial Machinery' }];
    return null;
  };
  t.after(() => { stub = null; });
  return calls;
}

describe('Real-Time Inventory list: search and category options', () => {
  it('search also matches an exact Product ID, still limited to the supplier', async (t) => {
    const calls = database(t);
    await listSupplierInventory(SUPPLIER, { search: 'p-1' });
    const where = calls.find((q) => q.model === 'Product' && q.action === 'findMany').args.where;
    assert.deepEqual(where.AND[0], { supplierId: 'sup-1' });
    assert.ok(where.AND.some((c) => c.status && c.status.not === 'Deleted'), 'deleted products are excluded');
    assert.deepEqual(where.AND.find((c) => c.OR).OR, [{ name: { contains: 'p-1' } }, { sku: { contains: 'p-1' } }, { id: 'p-1' }]);
  });

  it('returns the supplier’s own categories (sorted by name) for the category filter', async (t) => {
    const calls = database(t);
    const result = await listSupplierInventory(SUPPLIER, { category: 'machinery' });
    assert.deepEqual(result.categories, [
      { slug: 'food-beverages', name: 'Food & Beverages' },
      { slug: 'machinery', name: 'Industrial Machinery' },
    ]);
    const group = calls.find((q) => q.model === 'Product' && q.action === 'groupBy');
    assert.deepEqual(group.args.where, { supplierId: 'sup-1' }, 'options come from this supplier only and ignore the active filter');
  });
});
