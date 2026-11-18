import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPPLIER_ORDER_FILTERS, toSupplierOrder } from '../src/utils/supplierOrders.js';

const order = (orderStatus, items) => ({ id: `id-${orderStatus}`, orderNumber: `TS-${orderStatus}`, orderStatus, paymentStatus: 'PENDING', buyerName: 'Asha', buyerCompany: 'Asha Traders', subtotal: 1000, shippingFee: 0, tax: 180, total: 1180, createdAt: '2026-11-12', items });
const line = (extra) => ({ productId: 'p1', productName: 'Cow Ghee 1L', productSku: 'GH-1', quantity: 10, unitPrice: 100, lineTotal: 1000, unit: 'piece', ...extra });

describe('Supplier Purchase Orders (database orders)', () => {
  it('every database status has a filter, so no order falls outside "All orders" filters', () => {
    const statuses = ['ORDER_PLACED', 'ORDER_CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
    for (const s of statuses) assert.ok(SUPPLIER_ORDER_FILTERS.includes(toSupplierOrder(order(s, [])).status), s);
    assert.equal(toSupplierOrder(order('CANCELLED', [])).status, 'Cancelled');
    assert.equal(toSupplierOrder(order('ORDER_PLACED', [])).status, 'Pending');
  });

  it('a deleted product keeps the order readable from the line snapshot (name, quantity, price)', () => {
    const o = toSupplierOrder(order('ORDER_PLACED', [line({ mine: true, productAvailable: false })]), 'co-1');
    assert.deepEqual([o.items[0].name, o.items[0].quantity, o.items[0].unitPrice, o.items[0].productAvailable], ['Cow Ghee 1L', 10, 100, false]);
    assert.equal(o.items[0].companyId, 'co-1', "this supplier's line counts as its item");
  });

  it("another supplier's line in the same order is never counted as this supplier's", () => {
    const o = toSupplierOrder(order('ORDER_PLACED', [line({ mine: true }), line({ productId: 'x', mine: false })]), 'co-1');
    assert.deepEqual(o.items.map((i) => i.companyId), ['co-1', null]);
  });

  it('the page reads the supplier orders API and never reports a failed action as done', () => {
    const page = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/pages/supplier/SupplierOrders.jsx'), 'utf8');
    assert.match(page, /useSupplierOrders\(company\.id\)/);
    assert.doesNotMatch(page, /updateOrderStatus\(/, 'no local-only status changes');
    assert.doesNotMatch(page, /catch \{\s*updateOrderStatus/);
  });
});
