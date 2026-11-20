import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  apiOrderStatus, apiPaymentStatus, amountDue, canCancelOrder, canShowInvoice, canTrackOrder, hasPendingPayment, paymentDisplay,
} from '../src/utils/orderStatus.js';

const order = (status, paymentStatus, extra = {}) => ({ status, paymentStatus, totals: { total: 1000 }, ...extra });

describe('Order status and payment status (kept separate)', () => {
  it('maps every server order status to a readable label', () => {
    const map = {
      ORDER_PLACED: 'Pending', ORDER_CONFIRMED: 'Confirmed', PROCESSING: 'Processing', PACKED: 'Packed', SHIPPED: 'Shipped',
      OUT_FOR_DELIVERY: 'Out for Delivery', DELIVERED: 'Delivered', CANCELLED: 'Cancelled', REFUNDED: 'Refunded',
    };
    for (const [code, label] of Object.entries(map)) assert.equal(apiOrderStatus(code), label);
    assert.equal(apiOrderStatus('Delivered'), 'Delivered', 'already-readable labels are kept');
  });

  it('maps every server payment status, including failed and refunded', () => {
    assert.deepEqual(
      ['PAID', 'PARTIALLY_PAID', 'FAILED', 'COD', 'REFUNDED', 'PENDING'].map(apiPaymentStatus),
      ['paid', 'partially_paid', 'failed', 'cod', 'refunded', 'pending'],
    );
  });

  it('counts only open orders with money still owed as pending payments', () => {
    assert.equal(hasPendingPayment(order('Pending', 'pending')), true);
    assert.equal(hasPendingPayment(order('Shipped', 'cod')), true);
    assert.equal(hasPendingPayment(order('Processing', 'failed')), true);
    assert.equal(hasPendingPayment(order('Delivered', 'paid')), false);
    assert.equal(hasPendingPayment(order('Cancelled', 'pending')), false, 'a cancelled order owes nothing');
    assert.equal(amountDue(order('Processing', 'partially_paid', { balanceDue: 400 })), 400, 'only the balance of a part payment');
    assert.equal(amountDue(order('Pending', 'pending')), 1000);
  });

  it('shows a cancelled, unpaid order as "Not charged" and a paid one as paid', () => {
    assert.equal(paymentDisplay(order('Cancelled', 'pending')).label, 'Not charged');
    assert.equal(paymentDisplay(order('Cancelled', 'refunded')).label, 'Refunded');
    assert.equal(paymentDisplay(order('Shipped', 'paid')).label, 'Paid');
  });

  it('offers only the actions that apply', () => {
    assert.equal(canCancelOrder(order('Pending')), true);
    assert.equal(canCancelOrder(order('Processing')), true);
    assert.equal(canCancelOrder(order('Packed')), false, 'same rule as the server: not once packed');
    assert.equal(canTrackOrder(order('Cancelled')), false);
    assert.equal(canTrackOrder(order('Refunded')), false);
    assert.equal(canTrackOrder(order('Shipped')), true);
    assert.equal(canShowInvoice(order('Cancelled')), false);
    assert.equal(canShowInvoice(order('Delivered')), true);
  });
});
