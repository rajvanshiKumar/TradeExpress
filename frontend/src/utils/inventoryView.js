/** Pure helpers for the Real-Time Inventory page (pagination window, dates, CSV export). */

/** Page numbers around the current page, e.g. 1 … 4 5 6 … 12 */
export function pageWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const list = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  list.forEach((p, i) => {
    if (i && p - list[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

/** "Today, 02:10 PM", "Yesterday, 09:30 AM" or "12 Nov 2026, 04:15 PM" */
export function updatedLabel(value, now = new Date()) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
  const dayDiff = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, ${time}`;
}

/** CSV cell: quoted, and spreadsheet formulas neutralised */
export function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function inventoryCsv(rows, withSupplier = false) {
  const head = ['Product ID', 'SKU', 'Product Name', 'Category', ...(withSupplier ? ['Supplier'] : []), 'Unit', 'On Hand', 'Reserved', 'Committed', 'Available', 'Low-Stock Alert Level', 'Stock Status', 'Warehouse Location', 'Last Updated'];
  const lines = rows.map((r) => [
    r.id, r.sku, r.name, r.categoryName, ...(withSupplier ? [r.supplierName || ''] : []), r.unit, r.stock, r.reservedStock, r.committedStock, r.availableStock,
    r.lowStockThreshold, r.stockStatus, r.warehouseLocation || '', r.updatedAt || '',
  ].map(csvCell).join(','));
  return [head.map(csvCell).join(','), ...lines].join('\r\n');
}
