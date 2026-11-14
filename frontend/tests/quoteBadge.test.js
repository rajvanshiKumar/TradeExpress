import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { markQuotesSeen, quoteSeenKey, unseenQuotesCount } from '../src/utils/quoteBadge.js';

const BUYER = 'TS-U-001';
const rfq = (id, status, quote, buyerId = BUYER) => ({ id, buyerId, status, quote });
const supplierQuote = (round = 1) => ({ id: 'Q-1', round, lastProposedBy: 'SUPPLIER' });

describe('My Quotes sidebar badge', () => {
  it('shows a new supplier quote, then clears once My Quotes is opened', () => {
    const inquiries = [rfq('R-1', 'Quoted', supplierQuote())];
    assert.equal(unseenQuotesCount(inquiries, BUYER, []), 1);
    const seen = markQuotesSeen(inquiries, BUYER, []);
    assert.equal(unseenQuotesCount(inquiries, BUYER, seen), 0, 'the 1 must disappear after viewing');
  });

  it('a supplier counter-offer (new round) shows again; the buyer’s own counter does not', () => {
    const seen = markQuotesSeen([rfq('R-1', 'Quoted', supplierQuote(1))], BUYER, []);
    assert.equal(unseenQuotesCount([rfq('R-1', 'Negotiating', supplierQuote(2))], BUYER, seen), 1);
    const buyerCounter = { id: 'Q-1', round: 2, lastProposedBy: 'BUYER' };
    assert.equal(unseenQuotesCount([rfq('R-1', 'Negotiating', buyerCounter)], BUYER, seen), 0);
  });

  it('accepted, declined and closed requests never count (they kept the badge at 1 before)', () => {
    for (const status of ['Accepted', 'Declined', 'Closed']) {
      assert.equal(unseenQuotesCount([rfq('R-1', status, supplierQuote())], BUYER, []), 0, status);
    }
  });

  it('ignores requests without a quote and other buyers’ requests', () => {
    assert.equal(unseenQuotesCount([rfq('R-1', 'Submitted', null)], BUYER, []), 0);
    assert.equal(unseenQuotesCount([rfq('R-2', 'Quoted', supplierQuote(), 'TS-U-004')], BUYER, []), 0);
    assert.equal(unseenQuotesCount([rfq('R-1', 'Quoted', supplierQuote())], null, []), 0);
  });

  it('seen keys identify the request, quote and round', () => {
    assert.equal(quoteSeenKey(rfq('R-9', 'Quoted', { id: 'Q-7', round: 3 })), 'R-9:Q-7:3');
  });

  it('the sidebar uses the unseen count and clears it on /buyer/quotes', () => {
    const sidebar = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/components/layout/BuyerSidebar.jsx'), 'utf8');
    assert.match(sidebar, /key === 'quotes' && newQuotesCount > 0/);
    assert.match(sidebar, /location\.pathname !== '\/buyer\/quotes'/);
    assert.doesNotMatch(sidebar, /openQuotesCount/);
  });
});
