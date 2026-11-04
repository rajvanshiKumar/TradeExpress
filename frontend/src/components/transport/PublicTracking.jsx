import { CheckCircle2, Circle, Package, Truck } from 'lucide-react';
import { ShipmentTimeline } from './ShipmentDetail';
import { ShipmentStatus, num, when } from './transportUi';

/** Read-only shipment cards (used where the viewer cannot take any shipment action). */
export function ShipmentCards({ shipments = [] }) {
  if (!shipments.length) {
    return <p className="text-sm text-muted">No shipment has been dispatched yet. Shipments appear here as soon as the supplier arranges a truck.</p>;
  }
  return (
    <div className="space-y-4">
      {shipments.length > 1 ? <p className="text-[13px] text-muted">This order is travelling in {shipments.length} shipments.</p> : null}
      {shipments.map((s, index) => (
        <article key={s.id} className="rounded-2xl border border-line bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-ink">Shipment {index + 1} <span className="font-mono text-[12px] font-normal text-muted">{s.shipmentNumber}</span></p>
              <p className="text-[12px] text-muted">{s.supplier?.name} · {s.items.map((i) => `${num(i.loadedQuantity ?? i.quantity)} ${i.unit} ${i.productName}`).join(', ')}</p>
            </div>
            <ShipmentStatus status={s.status} delayed={s.delayed} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
            <div><dt className="text-[11px] text-muted">Truck</dt><dd className="font-medium">{s.vehicle?.vehicleNumber || 'Not assigned yet'}</dd></div>
            <div><dt className="text-[11px] text-muted">Transport company</dt><dd className="font-medium">{s.transporter?.name || '—'}</dd></div>
            <div><dt className="text-[11px] text-muted">Last reported location</dt><dd className="font-medium">{s.lastReportedLocation ? `${s.lastReportedLocation} · ${when(s.lastReportedAt)}` : '—'}</dd></div>
            <div><dt className="text-[11px] text-muted">Estimated delivery</dt><dd className="font-medium">{when(s.estimatedDeliveryAt)}</dd></div>
          </dl>
          <details className="mt-3">
            <summary className="cursor-pointer text-[13px] font-semibold text-navy-800">Tracking history ({s.events.length})</summary>
            <div className="mt-3"><ShipmentTimeline events={s.events} /></div>
          </details>
        </article>
      ))}
      <p className="text-[11px] text-muted">Locations are reported by the supplier or TradeExpress operations. This is not live GPS tracking.</p>
    </div>
  );
}

/**
 * Limited tracking view for someone who looked an order up with its email address without signing in: progress,
 * items and shipments only.
 */
export default function PublicTracking({ tracking }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Order tracking</p>
        <h1 className="mt-1 text-xl font-extrabold text-navy-950 sm:text-2xl">{tracking.orderNumber}</h1>
        <p className="mt-1 text-xs text-muted">Placed {when(tracking.orderDate)}{tracking.deliveryCity ? ` · delivering to ${tracking.deliveryCity}` : ''}</p>
        <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-[13px] text-muted">Sign in to the account that placed this order to see prices, invoices, the full delivery address and to confirm delivery.</p>
      </div>

      {tracking.isCancelled || tracking.isRefunded ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">This order was {tracking.isRefunded ? 'refunded' : 'cancelled'}.</p>
      ) : (
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="mb-4 text-base font-bold">Order progress</h2>
          <ol className="grid gap-3 sm:grid-cols-6">
            {tracking.timeline.map((step) => (
              <li key={step.statusKey} className={`flex items-center gap-2 text-[13px] sm:flex-col sm:text-center ${step.isCompleted ? 'text-emerald-800' : 'text-muted'}`}>
                {step.isCompleted ? <CheckCircle2 className="size-5 shrink-0" /> : <Circle className="size-5 shrink-0" />}
                <span className={step.isCurrent ? 'font-bold' : ''}>{step.label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-base font-bold"><Package className="size-4" />Items</h2>
        <ul className="divide-y divide-line text-sm">
          {tracking.items.map((item) => (
            <li key={item.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>{item.productName}</span>
              <span className="text-muted">{num(item.quantity)} {item.unit} · {num(item.shippedQuantity)} dispatched · {num(item.deliveredQuantity)} delivered</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-base font-bold"><Truck className="size-4" />Shipments</h2>
        <ShipmentCards shipments={tracking.shipments} />
      </section>
    </div>
  );
}
