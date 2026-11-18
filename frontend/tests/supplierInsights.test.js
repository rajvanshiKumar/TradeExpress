import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compactInr, dailyTrendFromOrders, percentages, rfqStatusSummary, shortDay, trendForRange } from '../src/utils/supplierInsights.js';

const daily = Array.from({ length: 90 }, (_, i) => ({ date: `2026-${i < 30 ? '08' : i < 60 ? '09' : '10'}-${String((i % 30) + 1).padStart(2, '0')}`, sales: 100, orders: 1 }));

describe('Supplier dashboard insight helpers', () => {
  it('keeps 7/30-day ranges daily and sums 90 days per week, without losing totals', () => {
    assert.equal(trendForRange(daily, 7).length, 7);
    assert.equal(trendForRange(daily, 30).length, 30);
    const weeks = trendForRange(daily, 90);
    assert.equal(weeks.length, 13);
    assert.equal(weeks.reduce((s, w) => s + w.orders, 0), 90);
    assert.equal(weeks.reduce((s, w) => s + w.sales, 0), 9000);
    assert.equal(shortDay('2026-11-14'), 'Nov 14');
  });

  it('groups RFQs as Open / Responded / Closed', () => {
    const s = rfqStatusSummary([{ status: 'Submitted' }, { status: 'Viewed' }, { status: 'Quoted' }, { status: 'Negotiating' }, { status: 'Accepted' }, { status: 'Closed' }, { status: 'Declined' }]);
    assert.deepEqual(s, { open: 2, responded: 2, closed: 3, total: 7 });
  });

  it('percentages always add up to 100 and handle zero', () => {
    assert.deepEqual(percentages([6, 3, 1]), [60, 30, 10]);
    assert.equal(percentages([1, 1, 1]).reduce((a, b) => a + b, 0), 100);
    assert.deepEqual(percentages([0, 0, 0]), [0, 0, 0]);
  });

  it('formats rupee axis labels compactly', () => {
    assert.equal(compactInr(0), '₹0');
    assert.equal(compactInr(45000), '₹45K');
    assert.equal(compactInr(500000), '₹5.0L');
    assert.equal(compactInr(12000000), '₹1.2Cr');
  });

  it('local fallback ignores cancelled orders and keeps 90 days', () => {
    const now = new Date(2026, 10, 16, 12);
    const rows = dailyTrendFromOrders([
      { createdAt: new Date(2026, 10, 16, 9), status: 'Pending', total: 250 },
      { createdAt: new Date(2026, 10, 16, 10), status: 'Cancelled', total: 999 },
    ], (o) => o.total, now);
    assert.equal(rows.length, 90);
    assert.deepEqual(rows.at(-1), { date: '2026-11-16', sales: 250, orders: 1 });
  });
});
