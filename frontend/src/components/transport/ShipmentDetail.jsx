import { useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, MapPin, Phone, ShieldCheck, Truck } from 'lucide-react';
import Button from '../common/Button';
import ConfirmDialog from '../common/ConfirmDialog';
import useNotifications from '../../hooks/useNotifications';
import ShipmentActionModal from './ShipmentActionModal';
import { shipmentActions } from './shipmentActions';
import { KeyValue, ShipmentStatus, addressLine, humanize, inr, num, when } from './transportUi';

const EVENT_DOT = {
  STATUS_CHANGE: 'bg-emerald-600',
  LOCATION_UPDATE: 'bg-sky-500',
  ISSUE: 'bg-rose-500',
  DOCUMENT: 'bg-slate-400',
  NOTE: 'bg-amber-500',
};

/** Verified timeline: every entry was recorded by a person in a TradeExpress workflow (source MANUAL). */
export function ShipmentTimeline({ events = [] }) {
  if (!events.length) return <p className="text-sm text-muted">No tracking events yet.</p>;
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {[...events].reverse().map((e) => (
        <li key={e.id} className="relative">
          <span className={`absolute -left-[26px] top-1 size-3 rounded-full ring-4 ring-white ${EVENT_DOT[e.eventType] || 'bg-slate-400'}`} aria-hidden="true" />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="text-sm font-semibold text-ink">{e.title}</p>
            <p className="text-[12px] text-muted">{when(e.eventAt)}</p>
          </div>
          {e.location ? <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink"><MapPin className="size-3" />{e.location} <span className="text-muted">(reported)</span></p> : null}
          {e.description ? <p className="mt-0.5 text-[13px] text-muted">{e.description}</p> : null}
          {e.documents?.length ? (
            <div className="mt-1 flex flex-wrap gap-2">{e.documents.map((d) => <a key={d.url} href={d.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-semibold text-navy-700 hover:underline"><FileText className="size-3" />{d.title}</a>)}</div>
          ) : null}
          <p className="mt-0.5 text-[11px] text-muted">By {e.by} · recorded {when(e.recordedAt)}</p>
        </li>
      ))}
    </ol>
  );
}

/**
 * Full shipment view with the steps the viewer may take. `role` is the backend role (BUYER, SUPPLIER, SUPER_ADMIN).
 * `onChange(updated)` is called after any successful step.
 */
export default function ShipmentDetail({ shipment, role, onChange, compact = false }) {
  const { showToast } = useNotifications();
  const [action, setAction] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);
  const actions = shipmentActions(shipment, role);
  const buyer = role === 'BUYER';

  const finish = (result, done) => {
    setAction(null);
    setConfirming(null);
    showToast(done?.done || `${done?.label || 'Step'} saved.`, 'success');
    onChange?.(result && result.id ? result : null);
  };

  const runDirect = async (item) => {
    setBusy(true);
    try {
      const result = await item.submit({});
      finish(result, item);
    } catch (err) {
      showToast(err.message || 'This step could not be saved.', 'error');
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const click = (item) => {
    if (item.direct) {
      if (item.confirm) setConfirming(item);
      else runDirect(item);
    } else setAction(item);
  };

  const primary = actions.filter((a) => a.primary);
  const secondary = actions.filter((a) => !a.primary);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-bold text-ink">{shipment.shipmentNumber}</p>
          <p className="text-[12px] text-muted">Order #{shipment.order?.orderNumber}{shipment.bookingNumber ? ` · Booking ${shipment.bookingNumber}` : ''}{!buyer && shipment.order?.buyer ? ` · ${shipment.order.buyer}` : ''}</p>
        </div>
        <ShipmentStatus status={shipment.status} delayed={shipment.delayed} />
      </div>

      {shipment.awaitingDeliveryCode && buyer ? (
        <p className="flex items-start gap-2 rounded-xl bg-teal-50 px-3 py-2.5 text-sm text-teal-900"><ShieldCheck className="mt-0.5 size-4 shrink-0" />Your goods have arrived. Check them, then confirm delivery with the code we emailed you{shipment.deliveryCodeExpiresAt ? ` (valid until ${when(shipment.deliveryCodeExpiresAt)})` : ''}.</p>
      ) : null}
      {shipment.status === 'DELIVERY_FAILED' && shipment.deliveryFailedReason ? (
        <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-800"><AlertTriangle className="mt-0.5 size-4 shrink-0" />Delivery failed: {shipment.deliveryFailedReason}</p>
      ) : null}
      {shipment.request?.status === 'REJECTED' && shipment.status === 'AWAITING_TRANSPORT' ? (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900"><AlertTriangle className="mt-0.5 size-4 shrink-0" />TradeExpress could not arrange transport ({shipment.request.rejectionReason}). Assign your own truck or request again.</p>
      ) : null}

      {actions.length ? (
        <div className="flex flex-wrap gap-2">
          {primary.map((item) => <Button key={item.key} size="sm" variant={item.danger ? 'danger' : 'primary'} onClick={() => click(item)} disabled={busy}>{item.label}</Button>)}
          {secondary.map((item) => <Button key={item.key} size="sm" variant={item.danger ? 'danger' : 'outline'} onClick={() => click(item)} disabled={busy}>{item.label}</Button>)}
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-line p-4 sm:grid-cols-3">
        <KeyValue label="Supplier">{shipment.supplier?.name}</KeyValue>
        <KeyValue label="Pickup">{buyer ? [shipment.pickupAddress?.city, shipment.pickupAddress?.state].filter(Boolean).join(', ') : addressLine(shipment.pickupAddress)}</KeyValue>
        <KeyValue label="Delivery address">{addressLine(shipment.deliveryAddress)}</KeyValue>
        <KeyValue label="Truck">{shipment.vehicle?.vehicleNumber ? `${shipment.vehicle.vehicleNumber}${shipment.vehicle.vehicleType ? ` · ${humanize(shipment.vehicle.vehicleType)}` : ''}` : 'Not assigned yet'}</KeyValue>
        <KeyValue label="Transport company">{shipment.transporter?.name}</KeyValue>
        <KeyValue label="Driver">
          {shipment.driver ? (
            <span>{shipment.driver.name}{shipment.driver.phone ? <a href={`tel:${shipment.driver.phone}`} className="ml-1 inline-flex items-center gap-0.5 text-navy-700 hover:underline"><Phone className="size-3" />{shipment.driver.phone}</a> : null}{shipment.driver.licence ? <span className="block text-[11px] text-muted">Licence {shipment.driver.licence}</span> : null}</span>
          ) : '—'}
        </KeyValue>
        <KeyValue label="Last reported location">{shipment.lastReportedLocation ? `${shipment.lastReportedLocation} · ${when(shipment.lastReportedAt)}` : '—'}</KeyValue>
        <KeyValue label="Pickup time">{when(shipment.pickupScheduledAt)}</KeyValue>
        <KeyValue label="Estimated delivery">{when(shipment.estimatedDeliveryAt)}</KeyValue>
        {!compact ? <KeyValue label="Packages / weight">{shipment.totalPackages ? `${num(shipment.totalPackages)} pkgs` : '—'}{shipment.totalWeightKg ? ` · ${num(shipment.totalWeightKg)} kg` : ''}</KeyValue> : null}
        {!compact ? <KeyValue label="LR / e-way bill">{[shipment.lrNumber, shipment.ewayBillNumber].filter(Boolean).join(' / ') || '—'}</KeyValue> : null}
        {shipment.freight ? <KeyValue label="Freight">{inr(shipment.freight.charges)} · {humanize(shipment.freight.payer)} pays · {humanize(shipment.freight.paymentStatus)}</KeyValue> : null}
      </dl>

      <section>
        <h4 className="mb-2 text-sm font-bold text-ink">Goods on this truck</h4>
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {shipment.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span className="min-w-0"><span className="font-semibold">{item.productName}</span> <span className="font-mono text-[11px] text-muted">{item.productSku}</span></span>
              <span className="text-right text-[13px]">
                <span className="font-bold">{num(item.loadedQuantity ?? item.quantity)} {item.unit}</span>
                {item.loadedQuantity !== null && item.loadedQuantity !== undefined && item.loadedQuantity !== item.quantity ? <span className="text-muted"> (planned {num(item.quantity)})</span> : null}
                {shipment.status === 'DELIVERED' ? <span className="block text-[12px] text-muted">{num(item.deliveredQuantity)} received{item.damagedQuantity ? ` · ${num(item.damagedQuantity)} damaged` : ''}{item.missingQuantity ? ` · ${num(item.missingQuantity)} missing` : ''}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {shipment.deliveryProof ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-sm">
          <h4 className="flex items-center gap-1.5 font-bold text-emerald-900"><CheckCircle2 className="size-4" />Proof of delivery</h4>
          <p className="mt-1 text-emerald-900">Received by {shipment.deliveryProof.recipientName} on {when(shipment.deliveryProof.receivedAt)} · {shipment.deliveryProof.otpVerified ? 'confirmed with delivery code' : 'manual confirmation'} · condition {humanize(shipment.deliveryProof.condition)}</p>
          {shipment.deliveryProof.receiverNotes ? <p className="mt-1 text-emerald-900/80">{shipment.deliveryProof.receiverNotes}</p> : null}
          {shipment.deliveryProof.photoProofUrls?.length ? <div className="mt-1 flex gap-2">{shipment.deliveryProof.photoProofUrls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-navy-700 hover:underline">View photo</a>)}</div> : null}
        </section>
      ) : null}

      {shipment.issues?.length ? (
        <section>
          <h4 className="mb-2 text-sm font-bold text-ink">Issues</h4>
          <ul className="space-y-2">
            {shipment.issues.map((issue) => (
              <li key={issue.id} className="rounded-xl border border-line px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{humanize(issue.issueType)}</span>{issue.quantity ? <span className="text-muted">× {issue.quantity}</span> : null}<span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${['RESOLVED', 'REJECTED'].includes(issue.status) ? 'bg-slate-100 text-slate-700' : 'bg-rose-50 text-rose-700'}`}>{humanize(issue.status)}</span></div>
                <p className="mt-0.5 text-[13px] text-muted">{issue.description}</p>
                {issue.resolution ? <p className="mt-0.5 text-[13px] text-ink">Resolution: {issue.resolution}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {shipment.documents?.length ? (
        <section>
          <h4 className="mb-2 text-sm font-bold text-ink">Documents</h4>
          <div className="flex flex-wrap gap-2">
            {shipment.documents.map((d) => <a key={d.id} href={d.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-[13px] font-semibold text-navy-800 hover:bg-surface"><FileText className="size-3.5" />{d.title}{d.docNumber ? ` · ${d.docNumber}` : ''}</a>)}
          </div>
        </section>
      ) : null}

      <section>
        <h4 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink"><Truck className="size-4" />Tracking history</h4>
        <ShipmentTimeline events={shipment.events} />
        <p className="mt-3 text-[11px] text-muted">Locations are reported by the supplier or TradeExpress operations. This is not live GPS tracking.</p>
      </section>

      {action ? <ShipmentActionModal action={action} shipment={shipment} viewerRole={role} onClose={() => setAction(null)} onDone={(result) => finish(result, action)} /> : null}
      <ConfirmDialog open={Boolean(confirming)} title={confirming?.label} text={confirming?.confirm} confirmLabel={confirming?.label} onConfirm={() => runDirect(confirming)} onCancel={() => setConfirming(null)} loading={busy} />
    </div>
  );
}
