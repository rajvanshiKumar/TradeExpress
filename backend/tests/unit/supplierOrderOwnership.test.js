import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../../src/config/db.js';
import { getSupplierOrders, ownedOrdersWhere } from '../../src/services/supplierOrderService.js';
import { getSupplierOverview } from '../../src/services/supplierDashboardService.js';

// All database access goes through this in-memory stub; nothing reaches a real database.
let stub;
prisma.$use(async (params) => (stub ? stub(params) : null));

const A = { id: 'sup-A', role: 'SUPPLIER', company: 'Mukesh Interprises' };
const B = { id: 'sup-B', role: 'SUPPLIER', company: 'Mukesh Interprises' }; // same company name as A

const PRODUCTS = { pa: { supplierId: 'sup-A', status: 'Deleted' }, pb: { supplierId: 'sup-B', status: 'Active' } };
const ORDERS = [
  { id: 'o1', orderNumber: 'TS-1', supplierId: 'sup-A', supplierCompanyId: 'Mukesh Interprises', orderStatus: 'ORDER_PLACED', paymentStatus: 'PENDING', createdAt: new Date(), total: 100, subtotal: 100, items: [{ id: 'i1', productId: 'pa', productName: 'Cow Ghee', quantity: 10, unitPrice: 10, lineTotal: 100 }] },
  { id: 'o2', orderNumber: 'TS-2', supplierId: 'sup-A', supplierCompanyId: 'Mukesh Interprises', orderStatus: 'CANCELLED', paymentStatus: 'PENDING', createdAt: new Date(), total: 50, subtotal: 50, items: [{ id: 'i2', productId: 'pa', productName: 'Cow Ghee', quantity: 5, unitPrice: 10, lineTotal: 50 }] },
  { id: 'o3', orderNumber: 'TS-3', supplierId: 'sup-B', supplierCompanyId: 'Mukesh Interprises', orderStatus: 'DELIVERED', paymentStatus: 'PAID', createdAt: new Date(), total: 70, subtotal: 70, items: [{ id: 'i3', productId: 'pb', productName: 'Oil', quantity: 7, unitPrice: 10, lineTotal: 70 }] },
];

function matchOrder(o, where) {
  if (!where) return true;
  if (where.OR) return where.OR.some((c) => matchOrder(o, c));
  if (where.supplierId) return o.supplierId === where.supplierId;
  if (where.items?.some?.product?.supplierId) return o.items.some((i) => PRODUCTS[i.productId]?.supplierId === where.items.some.product.supplierId);
  if (where.supplierCompanyId) return o.supplierCompanyId === where.supplierCompanyId;
  return true;
}

function useDb(t) {
  stub = async ({ model, action, args = {} }) => {
    if (model === 'Order' && action === 'findMany') {
      return ORDERS.filter((o) => matchOrder(o, args.where)).map((o) => ({
        ...o, payments: [], statusHistory: [],
        items: o.items.map((i) => ({ ...i, product: args.include?.items?.include ? PRODUCTS[i.productId] : undefined })),
      }));
    }
    if (action === 'findMany') return [];
    if (action === 'count') return 0;
    if (action === 'aggregate') return { _sum: {} };
    return null;
  };
  t.after(() => { stub = null; });
}

describe('Supplier orders: one ownership rule, deleted products never hide orders', () => {
  it('the rule is supplierId or own product; the company name is never used', () => {
    assert.equal(JSON.stringify(ownedOrdersWhere(A)).includes('Mukesh'), false);
  });

  it('lists both orders (pending and cancelled) even though their product was deleted', async (t) => {
    useDb(t);
    const list = await getSupplierOrders(A);
    assert.deepEqual(list.map((o) => o.orderNumber).sort(), ['TS-1', 'TS-2']);
    assert.deepEqual(list.map((o) => o.orderStatus).sort(), ['CANCELLED', 'ORDER_PLACED']);
    assert.equal(list[0].items[0].productName, 'Cow Ghee', 'name from the order line snapshot');
    assert.equal(list[0].items[0].mine, true);
    assert.equal(list[0].items[0].productAvailable, false);
  });

  it("supplier B (same company name) sees only B's order", async (t) => {
    useDb(t);
    assert.deepEqual((await getSupplierOrders(B)).map((o) => o.orderNumber), ['TS-3']);
  });

  it('dashboard totals match the unfiltered list: total, active, cancelled', async (t) => {
    useDb(t);
    const { metrics } = await getSupplierOverview(A);
    assert.equal(metrics.totalOrders, 2);
    assert.equal(metrics.activeOrders, 1);
    assert.equal(metrics.cancelledOrders, 1);
    assert.equal(metrics.refundedOrders, 0);
  });
});
