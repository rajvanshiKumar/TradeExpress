import { PAYMENT_METHODS, PAYMENT_STATUS } from './constants';
import { paymentDisplay } from './orderStatus';

export const getPaymentMethod = (id) => PAYMENT_METHODS.find((method) => method.id === id) ?? null;

/**
 * Payment status of an order, as text to show. Never reports "Paid" unless the order record says so.
 * Server codes (paid, partially_paid, failed, refunded…) are shown as readable labels, never as raw codes.
 */
export function getPaymentStatus(order) {
  const code = order.paymentStatus;
  if (order.status === 'Cancelled' && !['paid', 'partially_paid', 'refunded'].includes(code)) return PAYMENT_STATUS.cancelled;
  if (!code) return order.paymentMethod === 'cod' ? PAYMENT_STATUS.cod : PAYMENT_STATUS.pending;
  if (code === 'pending') return PAYMENT_STATUS.pending;
  if (code === 'cod') return PAYMENT_STATUS.cod;
  return paymentDisplay(order).label;
}
