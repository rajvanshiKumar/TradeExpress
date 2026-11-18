import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSalesTrend, buildTopProducts } from '../../src/services/supplierDashboardService.js';

const NOW = new Date('2026-11-16T06:00:00Z'); // 11:30 IST
const order = (id, createdAt, total, extra = {}) => ({ id, createdAt, total, orderStatus: 'PROCESSING', paymentStatus: 'PAID', items: [], ...extra });

describe('Supplier overview: sales trend and top products', () => {
  it('has 90 consecutive India-time days ending today, with orders and confirmed sales per day', () => {
    const trend = buildSalesTrend([
      order('o1', '2026-11-16T03:00:00Z', 1000),
      order('o2', '2026-11-15T20:00:00Z', 500), // 01:30 IST on the 16th
      order('o3', '2026-11-10T10:00:00Z', 700, { paymentStatus: 'PENDING' }), // placed, not yet a confirmed sale
      order('o4', '2025-01-01T10:00:00Z', 900), // outside the window
    ], NOW);
    assert.equal(trend.length, 90);
    assert.equal(trend.at(-1).date, '2026-11-16');
    assert.deepEqual(trend.at(-1), { date: '2026-11-16', sales: 1500, orders: 2 });
    assert.deepEqual(trend.find((d) => d.date === '2026-11-10'), { date: '2026-11-10', sales: 0, orders: 1 });
    assert.equal(trend.reduce((s, d) => s + d.orders, 0), 3);
  });

  it('ranks only this supplier’s products by confirmed sales, counting distinct orders', () => {
    const items = (lines) => ({ items: lines });
    const top = buildTopProducts([
      order('o1', NOW, 0, items([{ productId: 'a', productName: 'A', quantity: 2, lineTotal: 200 }, { productId: 'x', productName: 'Other seller', quantity: 9, lineTotal: 9000 }])),
      order('o2', NOW, 0, items([{ productId: 'a', productName: 'A', quantity: 1, lineTotal: 100 }, { productId: 'b', productName: 'B', quantity: 5, lineTotal: 500 }])),
      order('o3', NOW, 0, { paymentStatus: 'PENDING', ...items([{ productId: 'b', productName: 'B', quantity: 1, lineTotal: 100 }]) }),
    ], [{ id: 'a', name: 'Product A', unit: 'piece' }, { id: 'b', name: 'Product B', unit: 'kg' }]);
    assert.deepEqual(top.map((t) => [t.productId, t.orders, t.units, t.sales]), [['b', 2, 6, 500], ['a', 2, 3, 300]]);
    assert.equal(top[0].name, 'Product B');
  });
});
