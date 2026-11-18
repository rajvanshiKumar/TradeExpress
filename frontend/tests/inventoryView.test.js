import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, inventoryCsv, pageWindow, updatedLabel } from '../src/utils/inventoryView.js';

describe('Real-Time Inventory view helpers', () => {
  it('pagination shows every page when few, and a window with gaps when many', () => {
    assert.deepEqual(pageWindow(1, 5), [1, 2, 3, 4, 5]);
    assert.deepEqual(pageWindow(6, 12), [1, '…', 5, 6, 7, '…', 12]);
    assert.deepEqual(pageWindow(1, 12), [1, 2, '…', 12]);
    assert.deepEqual(pageWindow(12, 12), [1, '…', 11, 12]);
  });

  it('last-updated label: today, yesterday, older date, missing', () => {
    const now = new Date(2026, 10, 16, 18, 0);
    assert.match(updatedLabel(new Date(2026, 10, 16, 14, 10), now), /^Today, 02:10 PM$/);
    assert.match(updatedLabel(new Date(2026, 10, 15, 9, 30), now), /^Yesterday, 09:30 AM$/);
    assert.match(updatedLabel(new Date(2026, 10, 2, 16, 15), now), /2 Nov 2026, 04:15 PM$/);
    assert.equal(updatedLabel(null, now), '—');
  });

  it('CSV export quotes cells and neutralises spreadsheet formulas', () => {
    assert.equal(csvCell('He said "hi"'), '"He said ""hi"""');
    assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
    const csv = inventoryCsv([{ id: 'p1', sku: 'SKU-1', name: 'Ghee, 1L', categoryName: 'Food', unit: 'piece', stock: 10, reservedStock: 2, committedStock: 1, availableStock: 7, lowStockThreshold: 5, stockStatus: 'IN_STOCK', updatedAt: '2026-11-16' }]);
    const [head, row] = csv.split('\r\n');
    assert.match(head, /"Product ID","SKU","Product Name","Category","Unit","On Hand"/);
    assert.doesNotMatch(head, /Supplier/, 'supplier column only for platform staff');
    assert.match(row, /"p1","SKU-1","Ghee, 1L","Food","piece","10","2","1","7","5","IN_STOCK"/);
  });
});
