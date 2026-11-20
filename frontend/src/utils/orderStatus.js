/*
 * Order status and payment status of an order, kept separate.
 * The server's codes (OrderStatus / PaymentStatus enums in the Prisma schema) are turned into the labels shown to
 * buyers, and the rules for which actions apply to an order live here, in one place.
 */

const ORDER_STATUS_LABELS = {
  ORDER_PLACED: 'Pending',
  ORDER_CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

/** Order statuses a buyer can filter by, in the order an order moves through them. */
export const BUYER_ORDER_STATUSES = ['Pending', 'Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Refunded'];

const titleCase = (code) => String(code || '').toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Server order status code -> label (labels that are already readable are kept). */
export function apiOrderStatus(code) {
  if (!code) return 'Pending';
  return ORDER_STATUS_LABELS[code] || (BUYER_ORDER_STATUSES.includes(code) ? code : titleCase(code));
}

/** Server payment status code -> the code used in the app. */
export function apiPaymentStatus(code) {
  const map = { PAID: 'paid', PARTIALLY_PAID: 'partially_paid', FAILED: 'failed', COD: 'cod', REFUNDED: 'refunded', PENDING: 'pending' };
  return map[code] || 'pending';
}

const PAYMENT_DISPLAY = {
  paid: { label: 'Paid', tone: 'success' },
  partially_paid: { label: 'Partially paid', tone: 'warning' },
  pending: { label: 'Payment pending', tone: 'warning' },
  cod: { label: 'Cash on Delivery', tone: 'neutral' },
  failed: { label: 'Payment failed', tone: 'danger' },
  refunded: { label: 'Refunded', tone: 'neutral' },
};

const isClosed = (order) => order.status === 'Cancelled' || order.status === 'Refunded';

/** Payment status label and badge tone. A cancelled order that was never paid is "Not charged". */
export function paymentDisplay(order) {
  const code = order.paymentStatus || (order.paymentMethod === 'cod' ? 'cod' : 'pending');
  if (isClosed(order) && ['pending', 'cod', 'failed'].includes(code)) return { code, label: 'Not charged', tone: 'neutral' };
  return { code, ...(PAYMENT_DISPLAY[code] || PAYMENT_DISPLAY.pending) };
}

/** True when the buyer still owes money on an open order (counted in "Pending payments"). */
export function hasPendingPayment(order) {
  if (isClosed(order)) return false;
  return ['pending', 'partially_paid', 'failed', 'cod'].includes(paymentDisplay(order).code);
}

/** Amount still to pay on an order with a pending payment. */
export function amountDue(order) {
  if (!hasPendingPayment(order)) return 0;
  if (paymentDisplay(order).code === 'partially_paid' && Number.isFinite(order.balanceDue)) return order.balanceDue;
  return Number(order.totals?.total) || 0;
}

// Same rule as the server (orderService.cancelBuyerOrder): only before packing
export const canCancelOrder = (order) => ['Pending', 'Confirmed', 'Processing'].includes(order.status);
// Nothing to track once an order is cancelled or refunded
export const canTrackOrder = (order) => !isClosed(order);
// A tax invoice exists only for an order that was not cancelled
export const canShowInvoice = (order) => !isClosed(order);
