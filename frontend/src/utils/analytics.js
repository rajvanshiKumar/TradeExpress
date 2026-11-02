// Small helpers that turn records into chart-friendly arrays.

const monthLabel = new Intl.DateTimeFormat('en-GB', { month: 'short' });

/** [{ month: 'Oct', orders: 3, revenue: 1200 }] for the last `months` months, oldest first. */
export function ordersByMonth(orders, { months = 6, amount = (order) => order.totals.total } = {}) {
  const now = new Date();
  const buckets = Array.from({ length: months }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1);
    return { key: `${date.getFullYear()}-${date.getMonth()}`, month: monthLabel.format(date), orders: 0, revenue: 0 };
  });
  orders.forEach((order) => {
    if (order.status === 'Cancelled') return;
    const date = new Date(order.createdAt);
    const bucket = buckets.find((item) => item.key === `${date.getFullYear()}-${date.getMonth()}`);
    if (bucket) {
      bucket.orders += 1;
      bucket.revenue = Math.round((bucket.revenue + amount(order)) * 100) / 100;
    }
  });
  return buckets.map(({ key, ...rest }) => rest);
}

/** [{ name: 'Pending', value: 2 }] counted by `getKey`, in the order given by `order` when supplied. */
export function countBy(items, getKey, order = null) {
  const counts = new Map();
  items.forEach((item) => {
    const key = getKey(item);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  const keys = order ? order.filter((key) => counts.has(key)) : [...counts.keys()];
  return keys.map((name) => ({ name, value: counts.get(name) }));
}

/** Value of one company's items inside an order. */
export function companyOrderValue(order, companyId) {
  return order.items.filter((item) => item.companyId === companyId).reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}

export const CHART_COLORS = ['#102A56', '#F97316', '#214A8C', '#16A34A', '#64748B', '#C2410C', '#7C3AED', '#0E7490'];
