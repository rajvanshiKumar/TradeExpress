import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { badgeOf, categoryOf, destinationOf, notificationSummary, referencesOf, withinDays } from '../src/utils/notificationView.js';

describe('Supplier notifications view helpers', () => {
  it('maps server and local types to the six tabs', () => {
    assert.equal(categoryOf({ rawType: 'ORDER_UPDATE' }), 'orders');
    assert.equal(categoryOf({ rawType: 'SHIPMENT' }), 'orders');
    assert.equal(categoryOf({ rawType: 'RFQ_RECEIVED' }), 'rfqs');
    assert.equal(categoryOf({ type: 'quotes' }), 'rfqs');
    assert.equal(categoryOf({ rawType: 'INVENTORY' }), 'products');
    assert.equal(categoryOf({ rawType: 'PAYOUT' }), 'payments');
    assert.equal(categoryOf({ rawType: 'SYSTEM' }), 'system');
    assert.equal(badgeOf({ rawType: 'QUOTE' }), 'Quotation');
    assert.equal(badgeOf({ rawType: 'RFQ_RECEIVED' }), 'RFQ');
  });

  it('reads reference numbers and amounts only from the notification text', () => {
    assert.deepEqual(referencesOf({ title: 'Quote Accepted: #TS-QTE-600344-497', body: 'Order #TS-ORD-600229 for ₹1,25,000' }),
      { refs: ['#TS-QTE-600344-497', '#TS-ORD-600229'], amount: '₹1,25,000' });
    assert.deepEqual(referencesOf({ title: 'Item added', body: 'No refs here' }), { refs: [], amount: null });
  });

  it('opens the notification’s own link, otherwise its section', () => {
    assert.equal(destinationOf({ link: '/supplier/orders/o-1', rawType: 'ORDER' }), '/supplier/orders/o-1');
    assert.equal(destinationOf({ rawType: 'RFQ_RECEIVED' }), '/supplier/inquiries');
    assert.equal(destinationOf({ link: 'https://evil.example', rawType: 'PAYOUT' }), '/supplier/payments', 'external links are never followed');
    assert.equal(destinationOf({ rawType: 'SYSTEM' }), null);
  });

  it('date window and summary figures', () => {
    const now = new Date(2026, 10, 16, 12); // Monday
    const at = (d) => new Date(2026, 10, d, 9).toISOString();
    const list = [{ at: at(16), read: false }, { at: at(14), read: true }, { at: at(2), read: false }, { at: new Date(2026, 8, 1).toISOString(), read: true }];
    assert.deepEqual(notificationSummary(list, now), { total: 4, unread: 2, thisWeek: 1, thisMonth: 3 });
    assert.equal(withinDays(list[2], 7, now.getTime()), false);
    assert.equal(withinDays(list[2], 30, now.getTime()), true);
    assert.equal(withinDays(list[3], 0, now.getTime()), true);
  });
});
