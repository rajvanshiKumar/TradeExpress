import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { percentChange, resolveRange } from '../../src/services/adminDashboardService.js';

describe('Super Admin Command Center: periods and change', () => {
  const now = new Date('2026-11-17T07:00:00Z'); // 12:30 IST

  it('7d / 30d / 90d end today (India time) and include today', () => {
    for (const [range, days] of [['7d', 7], ['30d', 30], ['90d', 90]]) {
      const r = resolveRange({ range }, now);
      assert.equal(r.days, days);
      assert.equal(Math.round((r.end - r.start) / 86400000), days);
      assert.equal(r.end.toISOString(), '2026-11-17T18:30:00.000Z', 'end = midnight after today, IST');
    }
  });

  it('custom range is inclusive, validated and limited to a year', () => {
    const r = resolveRange({ range: 'custom', from: '2026-11-01', to: '2026-11-10' }, now);
    assert.equal(r.days, 10);
    assert.equal(r.start.toISOString(), '2026-10-31T18:30:00.000Z');
    assert.throws(() => resolveRange({ range: 'custom', from: '2026-11-10', to: '2026-11-01' }, now), (e) => e.statusCode === 400);
    assert.throws(() => resolveRange({ range: 'custom', from: 'x', to: '2026-11-01' }, now), (e) => e.statusCode === 400);
    assert.throws(() => resolveRange({ range: 'custom', from: '2024-01-01', to: '2026-01-01' }, now), /one year/);
  });

  it('change % is null when there is no earlier data (never invented)', () => {
    assert.equal(percentChange(54, 0), null);
    assert.equal(percentChange(150, 100), 50);
    assert.equal(percentChange(50, 100), -50);
  });
});
