/**
 * Pure helpers for the Supplier Dashboard insight panels (trend ranges, RFQ status groups, axis labels).
 * All figures come from real orders / RFQs; nothing here invents data.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-14" -> "Nov 14" (date-only strings, no timezone shift) */
export function shortDay(isoDate) {
  const [, m, d] = String(isoDate).split('-').map(Number);
  return m && d ? `${MONTHS[m - 1]} ${d}` : String(isoDate);
}

/**
 * Daily rows ({ date, sales, orders }, oldest first) -> chart points for the last `days` days.
 * 7 and 30 days stay daily; longer ranges are summed per 7-day week (labelled by the week's first day).
 */
export function trendForRange(daily = [], days = 30) {
  const rows = daily.slice(-days);
  if (days <= 31) return rows.map((r) => ({ label: shortDay(r.date), date: r.date, sales: r.sales, orders: r.orders }));
  const out = [];
  for (let i = 0; i < rows.length; i += 7) {
    const week = rows.slice(i, i + 7);
    out.push({
      label: shortDay(week[0].date),
      date: week[0].date,
      endDate: week[week.length - 1].date,
      sales: Math.round(week.reduce((s, r) => s + r.sales, 0) * 100) / 100,
      orders: week.reduce((s, r) => s + r.orders, 0),
    });
  }
  return out;
}

/** Local fallback (no live API): daily rows from the browser's order list, same shape as the server's. */
export function dailyTrendFromOrders(orders = [], valueOf = (o) => Number(o.total || 0), now = new Date(), days = 90) {
  const key = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };
  const map = new Map();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    map.set(key(d), { date: key(d), sales: 0, orders: 0 });
  }
  for (const o of orders) {
    if (o.status === 'Cancelled') continue;
    const row = map.get(key(o.createdAt));
    if (!row) continue;
    row.orders += 1;
    row.sales += valueOf(o);
  }
  return [...map.values()];
}

const OPEN = ['Submitted', 'Viewed', 'New', 'Pending'];
const RESPONDED = ['Quoted', 'Negotiating'];
const CLOSED = ['Closed', 'Accepted', 'Declined', 'Expired'];

/** Buyer RFQs grouped as the dashboard shows them: Open (awaiting your quote), Responded, Closed. */
export function rfqStatusSummary(inquiries = []) {
  const out = { open: 0, responded: 0, closed: 0, total: 0 };
  for (const i of inquiries) {
    if (CLOSED.includes(i.status)) out.closed += 1;
    else if (RESPONDED.includes(i.status) || (i.quote && !OPEN.includes(i.status))) out.responded += 1;
    else out.open += 1;
    out.total += 1;
  }
  return out;
}

/** Whole-number percentages that add up to 100 (largest remainder). */
export function percentages(values) {
  const total = values.reduce((s, v) => s + v, 0);
  if (!total) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((s, v) => s + v, 0);
  raw.map((v, i) => [v - floors[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { floors[i] += 1; left -= 1; } });
  return floors;
}

/** Compact Indian rupee axis label: ₹0, ₹850, ₹45K, ₹5.0L, ₹1.2Cr */
export function compactInr(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `₹${Math.round(n / 1e3)}K`;
  return `₹${Math.round(n)}`;
}
