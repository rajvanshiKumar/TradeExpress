import { useEffect, useState } from 'react';
import {
  Activity, BadgeCheck, Building2, Calendar, CheckCircle2, Clock, ExternalLink, FileText, Fingerprint, Globe,
  Mail, Phone, ShieldCheck, Store, User, X, XCircle,
} from 'lucide-react';
import { backendFileUrl } from '../../config/api.js';
import ShopProfileCard from './ShopProfileCard';

/* ---------- small display helpers ---------- */

const formatDate = (value, withTime = false) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-IN', withTime
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
};

const money = (amount, currency = 'INR') => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n); } catch { return `${currency} ${n.toFixed(2)}`; }
};

const maskAccount = (value) => (value ? `•••• ${String(value).slice(-4)}` : null);

const TONES = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  red: 'bg-rose-50 text-rose-700 border-rose-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
  dark: 'bg-emerald-950 text-emerald-200 border-emerald-800',
};

function Chip({ tone = 'slate', icon: Icon, children }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold ${TONES[tone]}`}>
      {Icon ? <Icon className="size-3" /> : null}
      {children}
    </span>
  );
}

/** One labelled value; empty values show a muted dash. */
function Field({ label, value, mono = false, wide = false, children }) {
  const content = children ?? value;
  const empty = content === null || content === undefined || content === '';
  return (
    <div className={`min-w-0 rounded-xl border border-slate-100 bg-slate-50/70 p-3 ${wide ? 'sm:col-span-2' : ''}`}>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className={`mt-0.5 break-words text-xs font-semibold ${empty ? 'text-slate-400' : 'text-slate-800'} ${mono ? 'font-mono' : ''}`}>
        {empty ? '—' : content}
      </dd>
    </div>
  );
}

function Section({ title, icon: Icon, children, aside }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
          {Icon ? <Icon className="size-3.5 text-emerald-700" /> : null}
          {title}
        </h4>
        {aside}
      </div>
      {children}
    </section>
  );
}

const Grid = ({ children }) => <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">{children}</dl>;

const Empty = ({ children }) => <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">{children}</p>;

const kycTone = (status) => (status === 'VERIFIED' ? 'green' : status === 'REJECTED' ? 'red' : 'amber');
const statusTone = (status) => (status === 'SUSPENDED' ? 'red' : status === 'DEACTIVATED' ? 'slate' : 'green');
const panTone = (status) => (status === 'LINKED' ? 'green' : status === 'NOT_LINKED' ? 'red' : status === 'UNABLE_TO_VERIFY' ? 'amber' : 'slate');
const PAN_LABEL = { LINKED: 'Linked & verified', NOT_LINKED: 'Not linked', UNABLE_TO_VERIFY: 'Could not verify', PENDING: 'Pending', NOT_STARTED: 'Not verified' };

/* ---------- tabs ---------- */

function OverviewTab({ user }) {
  const counts = user._count || {};
  const location = [user.city, user.state, user.postalCode, user.country].filter(Boolean).join(', ');
  return (
    <div className="space-y-6">
      <Section title="Account" icon={User}>
        <Grid>
          <Field label="Full name" value={user.name} />
          <Field label="Company / shop name" value={user.company} />
          <Field label="Email">
            {user.email ? (
              <span className="inline-flex flex-wrap items-center gap-1.5">
                <span className="font-mono">{user.email}</span>
                <Chip tone="green" icon={CheckCircle2}>{user.googleId ? 'Verified by Google' : 'Verified'}</Chip>
              </span>
            ) : null}
          </Field>
          <Field label="Mobile">
            {user.phone ? (
              <span className="inline-flex flex-wrap items-center gap-1.5">
                <span className="font-mono">{user.phone}</span>
                <Chip tone={user.isPhoneVerified ? 'green' : 'amber'} icon={user.isPhoneVerified ? CheckCircle2 : Clock}>
                  {user.isPhoneVerified ? 'OTP verified' : 'Not verified'}
                </Chip>
              </span>
            ) : null}
          </Field>
          <Field label="Location" value={location} wide />
          <Field label="Member since" value={formatDate(user.createdAt, true)} />
          <Field label="Last updated" value={formatDate(user.updatedAt, true)} />
          {user.statusReason ? <Field label="Status reason" value={user.statusReason} wide /> : null}
          {user.kycRejectionReason ? <Field label="KYC rejection reason" value={user.kycRejectionReason} wide /> : null}
        </Grid>
      </Section>

      <Section title="Activity summary" icon={Activity}>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {[
            ['Orders placed', counts.orders],
            ['Orders received', counts.supplierOrders],
            ['RFQs', counts.rfqs],
            ['Quotations', counts.quotations],
            ['Disputes', counts.disputesRaised],
            ['Support tickets', counts.supportTickets],
          ].map(([label, n]) => (
            <div key={label} className="rounded-xl border border-slate-100 bg-white p-3 text-center">
              <p className="text-lg font-black text-slate-900">{n ?? 0}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// Full number as 1234 5678 9012 when UIDAI returned it; older or UAT records only have the last 4 digits
function formatAadhaarNumber(full, last4) {
  if (/^\d{12}$/.test(full || '')) return full.replace(/(\d{4})(?=\d)/g, '$1 ');
  return last4 ? `•••• •••• ${last4}` : null;
}

function IdentityTab({ user }) {
  const aadhaar = user.aadhaarVerifications?.[0];
  const holder = aadhaar?.holder;
  const checks = user.panAadhaarLinkChecks || [];
  const docs = user.kycDocuments || [];
  return (
    <div className="space-y-6">
      <Section
        title="Aadhaar"
        icon={Fingerprint}
        aside={aadhaar ? <Chip tone="green" icon={BadgeCheck}>OTP verified{aadhaar.environment === 'uat' ? ' (UAT test)' : ''}</Chip> : <Chip tone="slate">No OTP verification</Chip>}
      >
        {holder?.photo ? (
          <figure className="flex items-center gap-3">
            <img src={holder.photo} alt={`Aadhaar photo of ${holder.fullName || 'the account holder'}`} className="h-28 w-24 rounded-xl border border-slate-200 bg-slate-50 object-cover" />
            <figcaption className="text-[11px] font-medium text-slate-500">Photo as per Aadhaar (UIDAI)</figcaption>
          </figure>
        ) : null}
        {!aadhaar ? (
          <p className="text-[11px] text-slate-500">
            Aadhaar photo and holder details are available only for accounts verified with Aadhaar OTP during signup.
          </p>
        ) : !holder?.photo ? (
          <p className="text-[11px] text-slate-500">UIDAI did not return a photo for this verification.</p>
        ) : null}
        <Grid>
          <Field label="Aadhaar number" value={formatAadhaarNumber(holder?.aadhaarNumber, user.aadhaarLast4)} mono />
          {aadhaar ? (
            <>
              <Field label="Verified on" value={formatDate(aadhaar.verifiedAt, true)} />
              <Field label="Name as per Aadhaar" value={holder?.fullName} />
              <Field label="Date of birth" value={holder?.dateOfBirth} />
              <Field label="Gender" value={holder?.gender} />
              <Field label="Care of" value={holder?.careOf} />
            </>
          ) : null}
        </Grid>
      </Section>

      <Section
        title="PAN"
        icon={FileText}
        aside={<Chip tone={panTone(user.panAadhaarStatus)}>{PAN_LABEL[user.panAadhaarStatus] || user.panAadhaarStatus || 'Not verified'}</Chip>}
      >
        <Grid>
          <Field label="PAN (as entered)" value={user.pan} mono />
          <Field label="PAN linked with Aadhaar (Income Tax)" value={user.panAadhaarMaskedPan} mono />
          <Field label="Checked on" value={formatDate(user.panAadhaarCheckedAt, true)} />
          <Field label="GSTIN" value={user.gstin} mono />
        </Grid>
        {checks.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[520px] text-left text-[11px]">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr><th className="px-3 py-2">When</th><th className="px-3 py-2">PAN entered</th><th className="px-3 py-2">Linked PAN</th><th className="px-3 py-2">Result</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {checks.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 text-slate-600">{formatDate(c.createdAt, true)}</td>
                    <td className="px-3 py-2 font-mono text-slate-800">{c.pan}</td>
                    <td className="px-3 py-2 font-mono text-slate-600">{c.maskedPan || '—'}</td>
                    <td className="px-3 py-2">
                      <Chip tone={c.result === 'LINKED' ? 'green' : c.result === 'NOT_LINKED' ? 'red' : 'amber'}>
                        {c.reason === 'PAN_MISMATCH' ? 'Different PAN' : c.result}{c.environment === 'uat' ? ' · UAT' : ''}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Section>

      <Section title="KYC documents" icon={ShieldCheck} aside={<Chip tone={kycTone(user.kycStatus)}>{user.kycStatus || 'NOT_SUBMITTED'}</Chip>}>
        {docs.length ? (
          <ul className="space-y-2">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800">{d.docType.replace(/_/g, ' ')}{d.docNumber ? <span className="ml-1.5 font-mono font-medium text-slate-500">{d.docNumber}</span> : null}</p>
                  <p className="text-[11px] text-slate-500">{d.fileName} · {formatDate(d.createdAt)}</p>
                  {d.notes ? <p className="mt-0.5 text-[11px] text-rose-600">{d.notes}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Chip tone={d.status === 'APPROVED' ? 'green' : d.status === 'REJECTED' ? 'red' : 'amber'}>{d.status}</Chip>
                  <a href={backendFileUrl(d.fileUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-emerald-800 hover:underline">
                    Open <ExternalLink className="size-3" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        ) : <Empty>No documents uploaded.</Empty>}
        {user.supplierDocument?.supplierId ? (
          <Grid>
            <Field label="TradeExpress supplier ID" value={user.supplierDocument.supplierId} mono />
            <Field label="Certificate number" value={user.supplierDocument.certificateNumber} mono />
            <Field label="Verified on" value={formatDate(user.supplierDocument.verifiedAt)} />
            <Field label="Valid until" value={formatDate(user.supplierDocument.validUntil)} />
          </Grid>
        ) : null}
      </Section>
    </div>
  );
}

function BusinessTab({ user }) {
  const images = Array.isArray(user.businessImages) ? user.businessImages.map((i) => (typeof i === 'string' ? i : i?.url)).filter(Boolean) : [];
  return (
    <div className="space-y-6">
      <Section title="Business" icon={Building2}>
        {user.logoUrl ? <img src={backendFileUrl(user.logoUrl)} alt={`${user.company || 'Company'} logo`} className="h-16 w-16 rounded-xl border border-slate-200 object-contain bg-white" /> : null}
        <Grid>
          <Field label="Company" value={user.company} />
          <Field label="Supplier code" value={user.supplierCode} mono />
          <Field label="Legal structure" value={user.legalStructure} />
          <Field label="Registration number" value={user.registrationNumber} mono />
          <Field label="Business type / certificate" value={user.businessType === 'Other' ? user.businessTypeOther : user.businessType} />
          <Field label="Tax ID" value={user.taxId} mono />
          <Field label="GST status" value={user.gstStatus} />
          <Field label="GSTIN" value={user.gstin} mono />
          <Field label="Official phone" value={user.businessPhone} mono />
          <Field label="Year established" value={user.yearEstablished} />
          <Field label="Business address" value={user.businessAddress} wide />
          <Field label="Factory address" value={user.factoryAddressSame ? (user.businessAddress ? 'Same as business address' : null) : user.factoryAddress} wide />
          <Field label="About the business" value={user.companyDescription} wide />
        </Grid>
        {images.length ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((src) => (
              <a key={src} href={backendFileUrl(src)} target="_blank" rel="noopener noreferrer">
                <img src={backendFileUrl(src)} alt="Business" className="aspect-square w-full rounded-lg border border-slate-200 object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        ) : null}
      </Section>

      <Section title="Warehouse & bank" icon={Globe}>
        <Grid>
          <Field label="Warehouse address" value={[user.warehouseAddress, user.warehouseState, user.warehousePincode].filter(Boolean).join(', ')} wide />
          <Field label="Bank" value={user.bankName} />
          <Field label="IFSC" value={user.bankIfsc} mono />
          <Field label="Account number" value={maskAccount(user.bankAccountNumber)} mono />
        </Grid>
      </Section>
    </div>
  );
}

function ActivityTab({ recentOrders = [], auditTrail = [] }) {
  return (
    <div className="space-y-6">
      <Section title="Recent orders" icon={Calendar}>
        {recentOrders.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[480px] text-left text-[11px]">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr><th className="px-3 py-2">Order</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Total</th><th className="px-3 py-2">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-3 py-2 font-mono font-bold text-slate-800">{o.orderNumber}</td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(o.createdAt)}</td>
                    <td className="px-3 py-2 text-slate-800">{money(o.total, o.currency)}</td>
                    <td className="px-3 py-2"><Chip tone="blue">{o.orderStatus}</Chip> <Chip>{o.paymentStatus}</Chip></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No orders yet.</Empty>}
      </Section>

      <Section title="Audit trail" icon={Activity}>
        {auditTrail.length ? (
          <ul className="space-y-1.5">
            {auditTrail.map((log) => (
              <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-[11px]">
                <span className="font-bold text-slate-800">{String(log.action || '').replace(/_/g, ' ')}</span>
                <span className="text-slate-500">{formatDate(log.createdAt, true)}</span>
              </li>
            ))}
          </ul>
        ) : <Empty>No recorded activity.</Empty>}
      </Section>
    </div>
  );
}

/**
 * Super Admin: everything known about one user, in tabs. Buyers get a Shop tab (signup live photo + location),
 * suppliers a Business tab. Opens from any row of the User Directory.
 *
 * Props: details ({ user, recentOrders, auditTrail }), onClose, onVerify(user) (shown when KYC is not verified)
 */
export default function UserDetailPanel({ details, onClose, onVerify }) {
  const { user, recentOrders, auditTrail, loading = false, error = '' } = details;
  const isBuyer = user.role === 'BUYER';
  const isSupplier = user.role === 'SUPPLIER';
  const tabs = [
    { id: 'overview', label: 'Profile', icon: User },
    { id: 'identity', label: 'Identity & KYC', icon: Fingerprint },
    ...(isBuyer ? [{ id: 'shop', label: 'Shop', icon: Store }] : []),
    ...(isSupplier || user.gstin || user.businessAddress ? [{ id: 'business', label: 'Business', icon: Building2 }] : []),
    { id: 'activity', label: 'Activity', icon: Activity },
  ];
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  const canVerify = (isBuyer || isSupplier) && user.kycStatus !== 'VERIFIED' && user.status === 'ACTIVE';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs" onClick={onClose} role="presentation">
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-detail-title"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="border-b border-slate-200 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {user.avatarUrl || user.logoUrl ? (
                <img src={backendFileUrl(user.avatarUrl || user.logoUrl)} alt="" className="size-12 shrink-0 rounded-full border border-slate-200 object-cover" />
              ) : (
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-slate-900 text-base font-bold uppercase text-white">
                  {(user.name || user.email || 'U').charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <h3 id="user-detail-title" className="truncate text-lg font-black text-slate-900">{user.name}</h3>
                <p className="flex items-center gap-1 truncate font-mono text-xs text-slate-500"><Mail className="size-3 shrink-0" />{user.email}</p>
                {user.phone ? <p className="flex items-center gap-1 font-mono text-xs text-slate-500"><Phone className="size-3 shrink-0" />{user.phone}</p> : null}
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <X className="size-5" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip tone={user.role === 'SUPER_ADMIN' ? 'dark' : user.role === 'SUPPLIER' ? 'blue' : 'slate'}>{user.role}</Chip>
            <Chip tone={statusTone(user.status)} icon={user.status === 'ACTIVE' ? CheckCircle2 : XCircle}>{user.status === 'DEACTIVATED' ? 'DELETED' : user.status}</Chip>
            {isBuyer || isSupplier ? <Chip tone={kycTone(user.kycStatus)} icon={ShieldCheck}>KYC {user.kycStatus || 'PENDING'}</Chip> : null}
            {user.aadhaarVerifications?.length ? <Chip tone="green" icon={Fingerprint}>Aadhaar verified</Chip> : null}
            {user.panAadhaarStatus === 'LINKED' ? <Chip tone="green" icon={FileText}>PAN linked</Chip> : null}
            {user.shopProfile ? <Chip tone="green" icon={Store}>Shop verified (live)</Chip> : null}
            <Chip icon={Calendar}>Joined {formatDate(user.createdAt)}</Chip>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3 sm:px-4" role="tablist" aria-label="User details">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-bold transition-colors ${
                tab === t.id ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <t.icon className="size-3.5" />
              {t.label}
            </button>
          ))}
        </nav>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5" role="tabpanel" aria-busy={loading || undefined}>
          {error ? (
            <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">{error}</p>
          ) : null}
          {loading ? (
            <div className="space-y-3" role="status" aria-label="Loading details">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
                  <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
                </div>
              ))}
            </div>
          ) : null}
          {loading ? null : (
            <>
              {tab === 'overview' ? <OverviewTab user={user} /> : null}
              {tab === 'identity' ? <IdentityTab user={user} /> : null}
              {tab === 'shop' ? (user.shopProfile ? <ShopProfileCard shop={user.shopProfile} /> : <Empty>No live shop verification (this buyer signed up before shop photos were required).</Empty>) : null}
              {tab === 'business' ? <BusinessTab user={user} /> : null}
              {tab === 'activity' ? <ActivityTab recentOrders={recentOrders} auditTrail={auditTrail} /> : null}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 p-3 sm:p-4">
          {canVerify ? (
            <button
              type="button"
              onClick={() => onVerify(user)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              <ShieldCheck className="size-4" />
              Verify {isBuyer ? 'buyer' : 'supplier'} &amp; issue certificate
            </button>
          ) : <span />}
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">
            Close
          </button>
        </div>
      </aside>
    </div>
  );
}
