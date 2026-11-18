/**
 * Pure helpers for the Supplier Notifications page: category, badge, reference chips,
 * destination link and date windows. Everything is read from the real notification record.
 */

export const NOTIFICATION_CATEGORIES = [
  { id: 'all', label: 'All Notifications' },
  { id: 'orders', label: 'Orders' },
  { id: 'rfqs', label: 'RFQs' },
  { id: 'products', label: 'Products' },
  { id: 'payments', label: 'Payments' },
  { id: 'system', label: 'System' },
];

const typeOf = (n) => String(n?.rawType || n?.type || '').toUpperCase();

/** Which tab a notification belongs to (server types such as ORDER_UPDATE, RFQ_RECEIVED, PAYOUT, and local types such as orders/quotes). */
export function categoryOf(n) {
  const t = typeOf(n);
  if (/ORDER|SHIPMENT|DELIVERY|DISPUTE|CART/.test(t)) return 'orders';
  if (/RFQ|QUOTE|QUOTATION|INQUIR|NEGOTIA/.test(t)) return 'rfqs';
  if (/PRODUCT|INVENTORY|STOCK|CATALOG|LISTING/.test(t)) return 'products';
  if (/PAY|ESCROW|SETTLE|INVOICE|REFUND|CARD/.test(t)) return 'payments';
  return 'system';
}

/** Badge text: Quotation is shown separately from RFQ, inside the RFQs tab. */
export function badgeOf(n) {
  const t = typeOf(n);
  if (/QUOTE|QUOTATION/.test(t)) return 'Quotation';
  return { orders: 'Order', rfqs: 'RFQ', products: 'Product', payments: 'Payment', system: 'System' }[categoryOf(n)];
}

/** Reference chips found in the notification's own text: document numbers and rupee amounts. */
export function referencesOf(n) {
  const text = `${n?.title || ''} ${n?.body || n?.message || ''}`;
  const refs = new Set();
  for (const m of text.matchAll(/#?\b((?:TS|TE)-[A-Z]{2,5}-[A-Z0-9]+(?:-[A-Z0-9]+)*|(?:RFQ|ORD|QT|QTE|INV|PO)-[A-Z0-9]+(?:-[A-Z0-9]+)*)\b/g)) refs.add(`#${m[1]}`);
  const amount = text.match(/₹\s?\d[\d,]*(?:\.\d+)?/);
  return { refs: [...refs].slice(0, 2), amount: amount ? amount[0].replace(/\s/, '') : null };
}

const SUPPLIER_PAGES = { orders: '/supplier/orders', rfqs: '/supplier/inquiries', products: '/supplier/inventory', payments: '/supplier/payments', system: '/supplier/notifications' };

/** Page to open: the notification's own link when it has one, otherwise the section it belongs to. */
export function destinationOf(n) {
  if (n?.link && String(n.link).startsWith('/')) return n.link;
  const page = SUPPLIER_PAGES[categoryOf(n)];
  return page === '/supplier/notifications' ? null : page;
}

export const timeOf = (n) => new Date(n?.at || n?.createdAt || 0).getTime();
export const isUnread = (n) => !n?.read && !n?.isRead;

/** Within the last `days` days (null = all time). */
export function withinDays(n, days, now = Date.now()) {
  if (!days) return true;
  return now - timeOf(n) <= days * 86400000;
}

/** Summary figures from the loaded notifications. */
export function notificationSummary(list, now = new Date()) {
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)).getTime(); // Monday
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return {
    total: list.length,
    unread: list.filter(isUnread).length,
    thisWeek: list.filter((n) => timeOf(n) >= startOfWeek).length,
    thisMonth: list.filter((n) => timeOf(n) >= startOfMonth).length,
  };
}

/** "13 Nov 2026, 11:24 AM" */
export function notificationTime(n) {
  const d = new Date(n?.at || n?.createdAt);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
  return `${date}, ${time}`;
}
