import { CheckCircle2, Clock3, XCircle, MinusCircle } from 'lucide-react';

/** Profile photo, or initials when there is none or it fails to load. */
export function AccountAvatar({ name, avatarUrl, size = 'lg' }) {
  const initials = String(name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || '?';
  const dimension = size === 'lg' ? 'size-16 text-xl' : 'size-12 text-base';
  return (
    <span className={`relative inline-flex ${dimension} shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-success to-navy-900 font-display font-bold text-white shadow-card`}>
      {initials}
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover"
          onError={(event) => { event.currentTarget.style.display = 'none'; }}
        />
      ) : null}
    </span>
  );
}

const STATUS_STYLES = {
  VERIFIED: { label: 'Verified', className: 'bg-success-50 text-success', icon: CheckCircle2 },
  ACTIVE: { label: 'Active', className: 'bg-success-50 text-success', icon: CheckCircle2 },
  LINKED: { label: 'Linked', className: 'bg-success-50 text-success', icon: CheckCircle2 },
  PENDING: { label: 'In review', className: 'bg-warning-50 text-warning', icon: Clock3 },
  NOT_VERIFIED: { label: 'Not verified', className: 'bg-warning-50 text-warning', icon: Clock3 },
  NOT_CONFIRMED: { label: 'Not confirmed', className: 'bg-surface text-muted', icon: MinusCircle },
  NOT_SUBMITTED: { label: 'Not submitted', className: 'bg-surface text-muted', icon: MinusCircle },
  NOT_STARTED: { label: 'Not checked', className: 'bg-surface text-muted', icon: MinusCircle },
  NOT_ADDED: { label: 'Not added', className: 'bg-surface text-muted', icon: MinusCircle },
  NOT_LINKED: { label: 'Not linked', className: 'bg-danger-50 text-danger', icon: XCircle },
  UNABLE_TO_VERIFY: { label: 'Could not verify', className: 'bg-warning-50 text-warning', icon: Clock3 },
  REJECTED: { label: 'Rejected', className: 'bg-danger-50 text-danger', icon: XCircle },
  SUSPENDED: { label: 'Suspended', className: 'bg-danger-50 text-danger', icon: XCircle },
};

export function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || { label: String(status || 'Unknown').replace(/_/g, ' ').toLowerCase(), className: 'bg-surface text-muted', icon: MinusCircle };
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${style.className}`}>
      <Icon className="size-3.5" aria-hidden="true" /> {style.label}
    </span>
  );
}

/** Label / value row for read-only details. */
export function DetailRow({ label, children }) {
  return (
    <div className="flex flex-col gap-1 border-b border-line py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium text-ink sm:text-right">{children ?? <span className="text-muted">Not provided</span>}</dd>
    </div>
  );
}

export function AccountCard({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
      {title ? <h2 className="font-display text-lg font-bold text-navy-900">{title}</h2> : null}
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      <div className={title || description ? 'mt-4' : ''}>{children}</div>
    </section>
  );
}

export function AccountSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading account settings">
      <div className="h-32 animate-pulse rounded-2xl bg-white shadow-card" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1, 2].map((i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-white shadow-card" />)}
      </div>
    </div>
  );
}
