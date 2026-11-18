import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { markRfqsSeen, rfqSeenKey, seenRfqStorageKey, unseenRfqCount } from '../src/utils/supplierRfqBadge.js';

const rfq = (id, quote = null) => ({ id, status: 'Submitted', quote });

describe('Supplier Buyer RFQs sidebar badge', () => {
  it('shows open RFQs not seen yet, then clears once Buyer RFQs is opened', () => {
    const open = [rfq('R-1'), rfq('R-2'), rfq('R-3'), rfq('R-4')];
    assert.equal(unseenRfqCount(open, []), 4);
    assert.equal(unseenRfqCount(open, markRfqsSeen(open, [])), 0, 'the 4 must disappear after viewing');
  });

  it('a new RFQ shows again', () => {
    const seen = markRfqsSeen([rfq('R-1')], []);
    assert.equal(unseenRfqCount([rfq('R-1'), rfq('R-2')], seen), 1);
  });

  it('a buyer counter-offer shows again; the supplier’s own quote or counter does not', () => {
    const seen = markRfqsSeen([rfq('R-1')], []);
    assert.equal(unseenRfqCount([rfq('R-1', { round: 1, lastProposedBy: 'SUPPLIER' })], seen), 0);
    const buyerCounter = [rfq('R-1', { round: 2, lastProposedBy: 'BUYER' })];
    assert.equal(unseenRfqCount(buyerCounter, seen), 1);
    const seenAgain = markRfqsSeen(buyerCounter, seen);
    assert.equal(unseenRfqCount([rfq('R-1', { round: 3, lastProposedBy: 'SUPPLIER' })], seenAgain), 0);
  });

  it('keys and storage are per RFQ and per supplier', () => {
    assert.equal(rfqSeenKey(rfq('R-9', { round: 2, lastProposedBy: 'BUYER' })), 'R-9:buyer-round-2');
    assert.match(seenRfqStorageKey('U-1'), /seen-supplier-rfqs:U-1$/);
  });

  it('the sidebar clears the badge on /supplier/inquiries', () => {
    const sidebar = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/components/layout/SupplierSidebar.jsx'), 'utf8');
    assert.match(sidebar, /unseenRfqCount\(openRfqs, seenRfqKeys\)/);
    assert.match(sidebar, /location\.pathname === '\/supplier\/inquiries'/);
  });
});
