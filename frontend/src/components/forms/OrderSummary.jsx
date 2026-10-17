import useCurrency from '../../hooks/useCurrency';

/** Totals box used by the cart, checkout and order pages. `totals` is in INR. */
export default function OrderSummary({ totals, title = 'Summary', shippingLabel, children }) {
  const { money, currency } = useCurrency();
  const rows = [
    ['Subtotal', money(totals.subtotal)],
    [shippingLabel ?? `Shipping estimate${totals.shippingMethod ? ` (${totals.shippingMethod.label})` : ''}`, money(totals.shipping)],
    ['Duties & taxes estimate', money(totals.tax)],
  ];
  return (
    <section aria-label={title} className="ts-card p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      <dl className="mt-4 space-y-2.5 text-sm">
        {rows.map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-muted">{label}</dt><dd className="font-semibold text-ink">{value}</dd></div>)}
        <div className="flex items-baseline justify-between gap-4 border-t pt-3">
          <dt className="font-bold text-navy-900">Total</dt>
          <dd className="font-display text-2xl font-extrabold text-navy-900">{money(totals.total)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-muted">All amounts in Indian Rupees (₹). Shipping and taxes are estimates.</p>
      {children}
    </section>
  );
}
