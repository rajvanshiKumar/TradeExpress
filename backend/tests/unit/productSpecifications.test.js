import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../../src/config/db.js';
import { createSupplierProduct, updateSupplierProduct } from '../../src/services/supplierProductService.js';

// All database access goes through this stub; nothing reaches a real database.
let stub;
prisma.$use(async (params) => (stub ? stub(params) : null));
const useStub = (t, handler) => { stub = handler; t.after(() => { stub = null; }); };

const SUPPLIER = { id: 'sup-1', role: 'SUPPLIER', companyId: 'co-1' };
const FOOD = { slug: 'food-beverages', name: 'Food & Beverages', subcategories: ['Dairy Products', 'Ghee', 'Rice'], attributes: null };
const MACHINERY = { slug: 'machinery', name: 'Industrial Machinery', subcategories: ['CNC Machines', 'Power Tools'], attributes: null };
const BASE = { name: 'Premium Cow Ghee', price: 650, moq: 10, stock: 500 };
const GHEE_VALUES = { ghee_type: 'Cow Ghee', milk_fat_percent: '99.5', net_weight: '15', shelf_life_months: '9', packaging_type: 'Tin', storage_conditions: 'Below 25 °C' };

function catalogue(t, { categories = [FOOD, MACHINERY], existing = null } = {}) {
  const writes = [];
  useStub(t, async (q) => {
    if (q.model === 'Category' && q.action === 'findUnique') return categories.find((c) => c.slug === q.args.where.slug) || null;
    if (q.model === 'Category' && q.action === 'findFirst') { writes.push('category.findFirst (fallback!)'); return categories[0]; }
    if (q.model === 'Product' && q.action === 'findUnique') return existing;
    if (q.model === 'Product' && (q.action === 'create' || q.action === 'update')) { writes.push(`product.${q.action}`); return { id: 'p-1', ...existing, ...q.args.data, price: 650, gstRate: 18, weightKg: 1 }; }
    if (q.model === 'ProductImage') { writes.push(`productImage.${q.action}`); return { count: 0 }; }
    return null;
  });
  return writes;
}
const rejects = (p, re) => assert.rejects(p, (e) => e.statusCode === 400 && re.test(JSON.stringify({ m: e.message, e: e.errors })));

describe('Add Product: category and specifications (server side)', () => {
  it('rejects an unknown category instead of filing the product under another category', async (t) => {
    const writes = catalogue(t);
    await rejects(createSupplierProduct(SUPPLIER, { ...BASE, categorySlug: 'no-such-category' }), /valid category/);
    assert.deepEqual(writes, [], 'no fallback category lookup and no product written');
  });

  it('rejects a subcategory or product type that does not belong to the category', async (t) => {
    catalogue(t);
    await rejects(createSupplierProduct(SUPPLIER, { ...BASE, categorySlug: 'food-beverages', subcategory: 'CNC Machines' }), /not a subcategory/);
    await rejects(createSupplierProduct(SUPPLIER, { ...BASE, categorySlug: 'food-beverages', subcategory: 'Dairy Products', productType: 'Laptop' }), /not a product type/);
  });

  it('rejects invalid specifications with field-level errors and writes nothing', async (t) => {
    const writes = catalogue(t);
    await rejects(createSupplierProduct(SUPPLIER, {
      ...BASE, categorySlug: 'food-beverages', subcategory: 'Dairy Products', productType: 'Ghee',
      specValues: { ...GHEE_VALUES, milk_fat_percent: '140', ghee_type: '', injected: 'x' },
    }), /specValues\.milk_fat_percent.*|specValues\.ghee_type/);
    assert.deepEqual(writes, []);
  });

  it('saves valid specifications as a display map plus structured values, and returns specData (never __spec)', async (t) => {
    catalogue(t);
    const product = await createSupplierProduct(SUPPLIER, {
      ...BASE, categorySlug: 'food-beverages', subcategory: 'Dairy Products', productType: 'Ghee', specValues: GHEE_VALUES,
      specifications: { 'Brand Story': 'Family dairy since 1960' },
    });
    assert.equal(product.specifications['Milk Fat'], '99.5 %');
    assert.equal(product.specifications['Product Type'], 'Ghee');
    assert.equal(product.specifications['Brand Story'], 'Family dairy since 1960', 'free-form lines are kept');
    assert.equal(product.specifications.__spec, undefined);
    assert.equal(product.specData.productType, 'Ghee');
    assert.equal(product.specData.values.milk_fat_percent, 99.5);
  });

  it('keeps old clients working (free-form map only) and never trusts a client-sent __spec', async (t) => {
    catalogue(t);
    const product = await createSupplierProduct(SUPPLIER, { ...BASE, categorySlug: 'machinery', subcategory: 'Power Tools', specifications: { Material: 'Steel', __spec: { values: { fake: 1 } } } });
    assert.deepEqual(product.specifications, { Material: 'Steel' });
    assert.equal(product.specData, null);
  });
});

describe('Edit Product: specifications', () => {
  const existing = {
    id: 'p-1', supplierId: 'sup-1', companyId: 'co-1', categorySlug: 'food-beverages', subcategory: 'Dairy Products',
    specifications: { 'Product Type': 'Ghee', 'Milk Fat': '99.5 %', __spec: { version: 1, subcategory: 'Dairy Products', productType: 'Ghee', values: { ghee_type: 'Cow Ghee', milk_fat_percent: 99.5, net_weight: 15, shelf_life_months: 9, packaging_type: 'Tin', storage_conditions: 'Cool' } } },
  };

  it('rejects invalid values before touching images or the product', async (t) => {
    const writes = catalogue(t, { existing });
    await rejects(updateSupplierProduct(SUPPLIER, 'p-1', { images: ['a.jpg'], specValues: { ...existing.specifications.__spec.values, milk_fat_percent: -1 } }), /milk_fat_percent/);
    assert.deepEqual(writes, [], 'images were not deleted, product not updated');
  });

  it('keeps saved values when only other fields change', async (t) => {
    catalogue(t, { existing });
    const updated = await updateSupplierProduct(SUPPLIER, 'p-1', { price: 700 });
    assert.equal(updated.specData.values.milk_fat_percent, 99.5);
  });

  it('on a category change, keeps compatible values and drops ones the new category does not define', async (t) => {
    catalogue(t, { existing });
    await rejects(updateSupplierProduct(SUPPLIER, 'p-1', { categorySlug: 'machinery', subcategory: 'CNC Machines' }), /machine_type|axes|condition/);
  });
});
