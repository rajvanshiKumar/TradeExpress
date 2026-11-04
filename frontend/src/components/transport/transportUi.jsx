import { AlertTriangle, CheckCircle2, Clock, Loader2, MapPin, Package, Truck, XCircle } from 'lucide-react';
import { formatDateTime } from '../../utils/formatDate';

export const STATUS_LABELS = {
  AWAITING_TRANSPORT: 'Awaiting transport',
  TRANSPORT_REQUESTED: 'Transport requested',
  TRANSPORT_ASSIGNED: 'Truck assigned',
  PICKUP_SCHEDULED: 'Pickup scheduled',
  LOADING_IN_PROGRESS: 'Loading',
  LOADED: 'Loaded',
  PICKED_UP: 'Picked up',
  IN_TRANSIT: 'In transit',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED_PENDING_CONFIRMATION: 'Arrived – awaiting confirmation',
  DELIVERED: 'Delivered',
  DELIVERY_FAILED: 'Delivery failed',
  RETURN_IN_TRANSIT: 'Returning',
  RETURNED: 'Returned',
  CANCELLED: 'Cancelled',
};

const STATUS_STYLES = {
  AWAITING_TRANSPORT: ['bg-amber-50 text-amber-900 ring-amber-200', Clock],
  TRANSPORT_REQUESTED: ['bg-sky-50 text-sky-900 ring-sky-200', Clock],
  TRANSPORT_ASSIGNED: ['bg-indigo-50 text-indigo-900 ring-indigo-200', Truck],
  PICKUP_SCHEDULED: ['bg-indigo-50 text-indigo-900 ring-indigo-200', Truck],
  LOADING_IN_PROGRESS: ['bg-violet-50 text-violet-900 ring-violet-200', Loader2],
  LOADED: ['bg-violet-50 text-violet-900 ring-violet-200', Package],
  PICKED_UP: ['bg-emerald-50 text-emerald-900 ring-emerald-200', Truck],
  IN_TRANSIT: ['bg-emerald-50 text-emerald-900 ring-emerald-200', Truck],
  OUT_FOR_DELIVERY: ['bg-emerald-50 text-emerald-900 ring-emerald-200', MapPin],
  DELIVERED_PENDING_CONFIRMATION: ['bg-teal-50 text-teal-900 ring-teal-200', MapPin],
  DELIVERED: ['bg-emerald-600 text-white ring-emerald-600', CheckCircle2],
  DELIVERY_FAILED: ['bg-rose-50 text-rose-800 ring-rose-200', AlertTriangle],
  RETURN_IN_TRANSIT: ['bg-orange-50 text-orange-900 ring-orange-200', Truck],
  RETURNED: ['bg-slate-100 text-slate-700 ring-slate-200', Package],
  CANCELLED: ['bg-slate-100 text-slate-600 ring-slate-200', XCircle],
};

export function ShipmentStatus({ status, delayed = false }) {
  const [style, Icon] = STATUS_STYLES[status] || ['bg-slate-100 text-slate-700 ring-slate-200', Clock];
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${style}`}>
        <Icon className="size-3" aria-hidden="true" />{STATUS_LABELS[status] || status}
      </span>
      {delayed ? <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 ring-1 ring-rose-200"><AlertTriangle className="size-3" />Delayed</span> : null}
    </span>
  );
}

export const humanize = (value) => (value ? String(value).replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()) : '—');
export const when = (value) => (value ? formatDateTime(value) : '—');
export const num = (value) => Number(value || 0).toLocaleString('en-IN');
export const inr = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const addressLine = (a) => (a ? [a.line1 || a.street, a.city, a.state, a.postalCode].filter(Boolean).join(', ') : '—');

/** <input type="datetime-local"> value for a date (local time). */
export function toLocalInput(date) {
  if (!date) return '';
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function StatTile({ label, value, hint, icon: Icon, tone = 'slate', onClick, active }) {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-900',
    amber: 'border-amber-200 bg-amber-50/50 text-amber-950',
    sky: 'border-sky-200 bg-sky-50/50 text-sky-950',
    indigo: 'border-indigo-200 bg-indigo-50/50 text-indigo-950',
    violet: 'border-violet-200 bg-violet-50/50 text-violet-950',
    emerald: 'border-emerald-200 bg-emerald-50/50 text-emerald-950',
    rose: 'border-rose-200 bg-rose-50/50 text-rose-950',
  };
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={`rounded-2xl border p-3.5 text-left shadow-2xs transition ${tones[tone] || tones.slate} ${onClick ? 'hover:-translate-y-0.5 hover:shadow-card' : ''} ${active ? 'ring-2 ring-emerald-600/40' : ''}`}>
      <div className="flex items-center justify-between text-xs font-semibold opacity-80">
        <span>{label}</span>
        {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
      </div>
      <p className="mt-2 font-display text-2xl font-black">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] opacity-70">{hint}</p> : null}
    </Tag>
  );
}

/** Simple labelled control for transport forms. */
export function FormField({ id, label, required, hint, children, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="ts-label">{label}{required ? <span className="text-danger" aria-hidden="true"> *</span> : null}</label>
      {children}
      {hint ? <p className="mt-1 text-[12px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function FormError({ message }) {
  if (!message) return null;
  return <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-800"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{message}</p>;
}

export function KeyValue({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-ink">{children ?? '—'}</dd>
    </div>
  );
}
