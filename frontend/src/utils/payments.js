import { PAYMENT_METHODS, PAYMENT_STATUS } from './constants';

export const getPaymentMethod = (id) => PAYMENT_METHODS.find((method) => method.id === id) ?? null;

/** Payment status of an order. Never reports "Paid" unless the order record says so. */
export function getPaymentStatus(order) {
  if (order.status === 'Cancelled') return PAYMENT_STATUS.cancelled;
  if (order.paymentStatus) return order.paymentStatus;
  return order.paymentMethod === 'cod' ? PAYMENT_STATUS.cod : PAYMENT_STATUS.pending;
}
