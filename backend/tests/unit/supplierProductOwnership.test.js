import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../../src/config/db.js';
import { deleteSupplierProduct, getSupplierProduct, listSupplierProducts, ownedProductsWhere, updateSupplierProduct } from '../../src/services/supplierProductService.js';
import { getSupplierOverview } from '../../src/services/supplierDashboardService.js';

// All database access goes through this in-memory stub; nothing reaches a real database.
let stub;
prisma.$use(async (params) => (stub ? stub(params) : null));

// Two suppliers with the SAME company name: ownership must never follow the name
const A = { id: 'sup-A', role: 'SUPPLIER', company: 'Mukesh Interprises' };
const B = { id: 'sup-B', role: 'SUPPLIER', company: 'Mukesh Interprises' };

function makeDb(t) {
  const products = [
    { id: 'a1', supplierId: 'sup-A', companyId: 'Mukesh Interprises', status: 'Active', moderationStatus: 'APPROVED', stock: 10, moq: 1, price: 100, gstRate: 18, weightKg: 1, specifications: null, categorySlug: 'food-beverages', subcategory: null },
    { id: 'a2', supplierId: 'sup-A', companyId: 'Mukesh Interprises', status: 'Hidden', moderationStatus: 'APPROVED', stock: 5, moq: 1, price: 100, gstRate: 18, weightKg: 1, specifications: null, categorySlug: 'food-beverages', subcategory: null },
    { id: 'a3', supplierId: 'sup-A', companyId: 'Mukesh Interprises', status: 'Deleted', moderationStatus: 'APPROVED', stock: 0, moq: 1, price: 100, gstRate: 18, weightKg: 1, specifications: null, categorySlug: 'food-beverages', subcategory: null },
    { id: 'b1', supplierId: 'sup-B', companyId: 'Mukesh Interprises', status: 'Active', moderationStatus: 'PENDING', stock: 10, moq: 1, price: 100, gstRate: 18, weightKg: 1, specifications: null, categorySlug: 'food-beverages', subcategory: null },
  ];
  const match = (p, where = {}) => Object.entries(where).every(([k, v]) => {
    if (k === 'OR') return v.some((c) => match(p, c));
    if (k === 'AND') return v.every((c) => match(p, c));
    if (v && typeof v === 'object' && 'not' in v) return p[k] !== v.not;
    return p[k] === v;
  });
  stub = async ({ model, action, args = {} }) => {
    if (model === 'Product') {
      if (action === 'findMany') return products.filter((p) => match(p, args.where));
      if (action === 'findFirst') return products.find((p) => match(p, args.where)) || null;
      if (action === 'findUnique') return products.find((p) => p.id === args.where.id) || null;
      if (action === 'update') { const p = products.find((x) => x.id === args.where.id); Object.assign(p, args.data); return p; }
    }
    if (model === 'Category' && action === 'findUnique') return { slug: 'food-beverages', subcategories: [], attributes: null };
    if (action === 'findMany') return [];
    if (action === 'count') return 0;
    if (action === 'aggregate') return { _sum: {} };
    return null;
  };
  t.after(() => { stub = null; });
  return products;
}

describe('Supplier products: one ownership rule for catalogue, dashboard and inventory', () => {
  it('the rule is the signed-in supplier id, never the company name, and excludes deleted products', () => {
    assert.deepEqual(ownedProductsWhere(A), { supplierId: 'sup-A', status: { not: 'Deleted' } });
  });

  it('Product Catalogue lists only own, non-deleted products (hidden ones included)', async (t) => {
    makeDb(t);
    assert.deepEqual((await listSupplierProducts(A)).map((p) => p.id).sort(), ['a1', 'a2']);
    assert.deepEqual((await listSupplierProducts(B)).map((p) => p.id), ['b1'], 'same company name does not share products');
  });

  it('dashboard counts match the catalogue: total, active (Active + approved) and pending review', async (t) => {
    makeDb(t);
    const a = await getSupplierOverview(A);
    assert.equal(a.metrics.totalProducts, 2, 'the deleted product is not counted');
    assert.equal(a.metrics.activeProducts, 1);
    assert.equal(a.metrics.pendingApproval, 0);
    const b = await getSupplierOverview(B);
    assert.deepEqual([b.metrics.totalProducts, b.metrics.activeProducts, b.metrics.pendingApproval], [1, 0, 1]);
  });

  it('delete marks the product Deleted (row kept for order history) and it disappears from list and counts', async (t) => {
    const products = makeDb(t);
    await deleteSupplierProduct(A, 'a1');
    assert.equal(products.find((p) => p.id === 'a1').status, 'Deleted');
    assert.deepEqual((await listSupplierProducts(A)).map((p) => p.id), ['a2']);
    assert.equal((await getSupplierOverview(A)).metrics.totalProducts, 1);
  });

  it("a supplier cannot read, edit or delete another supplier's product, even with the same company name", async (t) => {
    makeDb(t);
    await assert.rejects(getSupplierProduct(B, 'a1'), (e) => e.statusCode === 404);
    await assert.rejects(updateSupplierProduct(B, 'a1', { stock: 99 }), (e) => e.statusCode === 403);
    await assert.rejects(deleteSupplierProduct(B, 'a1'), (e) => e.statusCode === 403);
  });

  it('suppliers can only set Active or Hidden; deleted products cannot be edited', async (t) => {
    makeDb(t);
    await assert.rejects(updateSupplierProduct(A, 'a1', { status: 'Deleted' }), (e) => e.statusCode === 400);
    await assert.rejects(updateSupplierProduct(A, 'a1', { status: 'Featured' }), (e) => e.statusCode === 400);
    await assert.rejects(updateSupplierProduct(A, 'a3', { stock: 1 }), (e) => e.statusCode === 404);
    const hidden = await updateSupplierProduct(A, 'a1', { status: 'Hidden' });
    assert.equal(hidden.status, 'Hidden');
  });
});
