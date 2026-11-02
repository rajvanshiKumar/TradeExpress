import useCurrency from '../../hooks/useCurrency';

/** Totals box used by the cart, checkout and order pages. `totals` is in INR. */
export default function OrderSummary({ totals, title = 'Summary', shippingLabel, children }) {
  const { money } = useCurrency();
  const gst = totals.gstBreakup;

  return (
    <section aria-label={title} className="ts-card p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      <dl className="mt-4 space-y-2.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Subtotal (excl. tax)</dt>
          <dd className="font-semibold text-ink">{money(totals.subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">
            {shippingLabel ?? `Shipping estimate${totals.shippingMethod ? ` (${totals.shippingMethod.label})` : ''}`}
          </dt>
          <dd className="font-semibold text-ink">{money(totals.shipping)}</dd>
        </div>

        {/* Detailed GST Breakup */}
        {gst ? (
          gst.isInterState ? (
            <div className="flex justify-between gap-4 text-xs">
              <dt className="text-muted">IGST (18% Inter-State)</dt>
              <dd className="font-semibold text-ink">{money(gst.igst)}</dd>
            </div>
          ) : (
            <>
              <div className="flex justify-between gap-4 text-xs">
                <dt className="text-muted">CGST (9% Central GST)</dt>
                <dd className="font-semibold text-ink">{money(gst.cgst)}</dd>
              </div>
              <div className="flex justify-between gap-4 text-xs">
                <dt className="text-muted">SGST (9% State GST)</dt>
                <dd className="font-semibold text-ink">{money(gst.sgst)}</dd>
              </div>
            </>
          )
        ) : (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">GST (18% estimate)</dt>
            <dd className="font-semibold text-ink">{money(totals.tax)}</dd>
          </div>
        )}

        <div className="flex items-baseline justify-between gap-4 border-t pt-3">
          <dt className="font-bold text-navy-900">Total Order Value</dt>
          <dd className="font-display text-2xl font-extrabold text-navy-900">{money(totals.total)}</dd>
        </div>

        {/* Partial Advance Payment Breakup */}
        {totals.isPartialPayment && (
          <div className="mt-3 rounded-xl bg-amber-50/80 p-3 border border-amber-200/80 text-xs space-y-1.5">
            <div className="flex justify-between font-bold text-amber-900">
              <span>Advance Payable Now (20%):</span>
              <span>{money(totals.advanceAmount)}</span>
            </div>
            <div className="flex justify-between text-amber-800">
              <span>Balance Due on Delivery (80%):</span>
              <span>{money(totals.balanceDue)}</span>
            </div>
          </div>
        )}
      </dl>
      <p className="mt-2 text-xs text-muted">All amounts in Indian Rupees (₹). GST invoice issued upon dispatch.</p>
      {children}
    </section>
  );
}

