import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowDownUp, Building2, CalendarClock, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign, ClipboardList,
  ExternalLink, FileText, Layers, PauseCircle, Play, RefreshCw, RotateCcw, Search, ShieldAlert, ShieldCheck, Truck, UserX, X, XCircle,
} from 'lucide-react';
import superAdminApi from '../../api/superAdminApi';
import Button from '../../components/common/Button';
import CustomSelect from '../../components/common/CustomSelect';
import DatePicker from '../../components/common/DatePicker';
import Modal from '../../components/common/Modal';
import Input, { Textarea } from '../../components/common/Input';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import { TableSkeleton } from '../../components/common/Skeleton';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import useCurrency from '../../hooks/useCurrency';
import { formatDate, formatDateTime } from '../../utils/formatDate';

/* Status colours: pending amber, on hold orange, approved green, rejected red, completed neutral */
const STATUS = {
  PENDING: ['Pending review', 'bg-amber-50 text-amber-800 ring-amber-600/25'],
  ON_HOLD: ['On hold', 'bg-orange-50 text-orange-800 ring-orange-600/25'],
  APPROVED: ['Approved · grace period', 'bg-emerald-50 text-emerald-800 ring-emerald-600/25'],
  PROCESSING: ['Closing account', 'bg-emerald-50 text-emerald-800 ring-emerald-600/25'],
  FAILED: ['Failed · needs attention', 'bg-rose-50 text-rose-700 ring-rose-600/25'],
  REJECTED: ['Rejected', 'bg-rose-50 text-rose-700 ring-rose-600/25'],
  CANCELLED: ['Cancelled by supplier', 'bg-slate-100 text-slate-700 ring-slate-500/20'],
  COMPLETED: ['Completed', 'bg-slate-100 text-slate-700 ring-slate-500/20'],
};
const FILTERS = [['ALL', 'All requests'], ['PENDING', 'Pending review'], ['ON_HOLD', 'On hold'], ['APPROVED', 'Approved'], ['REJECTED', 'Rejected'], ['COMPLETED', 'Completed']];
const SORTS = [['createdAt:desc', 'Newest first'], ['createdAt:asc', 'Oldest first'], ['updatedAt:desc', 'Recently updated']];
const PAGE_SIZE = 15;
const CARD = 'rounded-2xl border border-line bg-white shadow-card';

// Shared look for the filter row (matches the custom dropdown: 42px, rounded-xl, soft border and shadow)
const FILTER_LABEL = 'mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-navy-800';
const FILTER_CONTROL = 'h-[2.625rem] w-full rounded-xl border border-slate-200/90 bg-white text-sm font-semibold text-navy-950 shadow-2xs transition-all hover:border-slate-300 focus:border-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/10';

/** Date filter: the custom calendar picker (same look as the dropdowns; full date always visible). */
function DateFilter({ id, label, value, onChange, min, max }) {
  return (
    <div>
      <label htmlFor={id} className={FILTER_LABEL}><CalendarDays className="size-3.5" aria-hidden="true" />{label}</label>
      <DatePicker id={id} value={value} min={min} max={max} onChange={onChange} placement="top" aria-label={`${label} date`} />
    </div>
  );
}

function StatusBadge({ status }) {
  const [label, tone] = STATUS[status] || [status, 'bg-slate-100 text-slate-700 ring-slate-500/20'];
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${tone}`}>{label}</span>;
}

/** Super Admin → Supplier Management → Account Deletion Requests. Every figure comes from the backend. */
export default function SuperAdminDeletionRequests() {
  useDocumentTitle('Account Deletion Requests');
  const [filter, setFilter] = useState('PENDING');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('createdAt:desc');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  // Search runs when Search is pressed (or Enter); clearing the box shows all results again
  useEffect(() => { setPage(1); }, [filter, search, from, to, sort]);

  const load = useCallback(async () => {
    setError('');
    const [sortField, order] = sort.split(':');
    try {
      setData(await superAdminApi.getDeletionRequests({ status: filter, search, from, to, sort: sortField, order, page, limit: PAGE_SIZE }));
    } catch (err) {
      setError(err.message || 'Requests could not be loaded.');
    }
  }, [filter, search, from, to, sort, page]);
  useEffect(() => { load(); }, [load]);

  const summary = data?.summary;
  const cards = [
    ['ALL', 'Total requests', summary?.total, Layers, 'text-navy-800 bg-surface'],
    ['PENDING', 'Pending review', summary?.pending, ClipboardList, 'text-amber-700 bg-amber-50'],
    ['ON_HOLD', 'On hold', summary?.onHold, PauseCircle, 'text-orange-700 bg-orange-50'],
    ['APPROVED', 'Approved / scheduled', summary?.approved, CalendarClock, 'text-emerald-700 bg-emerald-50'],
    ['REJECTED', 'Rejected', summary?.rejected, XCircle, 'text-rose-700 bg-rose-50'],
    ['COMPLETED', 'Completed', summary?.completed, CheckCircle2, 'text-slate-700 bg-slate-100'],
  ];
  const pagination = data?.pagination;
  // Search, From, To and a non-default sort each count as one active filter
  const activeFilters = [searchInput || search, from, to, sort !== SORTS[0][0]].filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-navy-900">Account Deletion Requests</h1>
          <p className="mt-1 text-sm text-muted">Review supplier requests to close their account. Obligations are checked live; approved accounts close after the grace period.</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map(([id, label, value, Icon, tone]) => (
          <button key={id} type="button" onClick={() => setFilter(id)} aria-pressed={filter === id}
            className={`${CARD} flex items-center gap-3 p-3.5 text-left transition-shadow hover:shadow-lift ${filter === id ? 'ring-2 ring-success/40' : ''}`}>
            <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="size-5" aria-hidden="true" /></span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-muted">{label}</span>
              <span className="block font-display text-xl font-extrabold text-navy-900">{value ?? '–'}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className={`${CARD} space-y-3 p-4`}>
        {/* Status tabs on the left, Clear on the right */}
        <div className="flex items-center justify-between gap-3">
          <div role="tablist" aria-label="Filter by status" className="ts-no-scrollbar -mx-1 flex min-w-0 gap-2 overflow-x-auto px-1">
            {FILTERS.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${filter === id ? 'bg-navy-900 text-white' : 'bg-white text-navy-800 ring-1 ring-line hover:bg-surface'}`}>
                {label}
              </button>
            ))}
          </div>
          {/* Always visible: light burgundy with a count when filters are set, quiet grey when there is nothing to clear */}
          <button
            type="button"
            disabled={!activeFilters}
            onClick={() => { setSearchInput(''); setSearch(''); setFrom(''); setTo(''); setSort(SORTS[0][0]); }}
            aria-label={activeFilters ? `Clear ${activeFilters} active filter${activeFilters === 1 ? '' : 's'}` : 'No filters to clear'}
            className={`group inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border py-1 pl-1.5 pr-3 text-xs font-semibold shadow-2xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8C2541] ${
              activeFilters ? 'border-[#E8C6CE] bg-[#FBF1F3] text-[#7A1F35] hover:border-[#D9A5B2] hover:bg-[#F6E3E8]' : 'cursor-default border-slate-200 bg-white text-slate-400'
            }`}
          >
            <span className={`inline-flex size-5 items-center justify-center rounded-full ring-1 transition-transform ${activeFilters ? 'bg-white text-[#8C2541] ring-[#E8C6CE] group-hover:rotate-90' : 'bg-slate-50 text-slate-400 ring-slate-200'}`}>
              <X className="size-3" aria-hidden="true" />
            </span>
            Clear filters
            {activeFilters ? <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#8C2541] px-1.5 text-[10px] font-bold leading-5 text-white">{activeFilters}</span> : null}
          </button>
        </div>
        {/* One row: every control has the same label row and the same 42px height, so they line up */}
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3 lg:grid-cols-[11.5rem_11.5rem_12.5rem_minmax(0,1fr)]">
          <DateFilter id="filter-from" label="From" value={from} max={to || undefined} onChange={setFrom} />
          <DateFilter id="filter-to" label="To" value={to} min={from || undefined} onChange={setTo} />
          <div>
            <span className={FILTER_LABEL}><ArrowDownUp className="size-3.5" aria-hidden="true" />Sort by</span>
            <CustomSelect id="filter-sort" value={sort} onChange={(e) => setSort(e.target.value)} searchable={false} options={SORTS.map(([value, label]) => ({ value, label }))} />
          </div>
          {/* Search at the end of the row, on the right: type, then press Search (or Enter) */}
          <form role="search" className="sm:col-span-3 lg:col-span-1" onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); }}>
            <label htmlFor="filter-search" className={FILTER_LABEL}><Search className="size-3.5" aria-hidden="true" />Search</label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <input id="filter-search" type="search" value={searchInput} onChange={(e) => { setSearchInput(e.target.value); if (!e.target.value) setSearch(''); }}
                  placeholder="Company, email, supplier ID or DR-…" className={`${FILTER_CONTROL} px-3.5 placeholder:font-normal placeholder:text-slate-400`} />
              </div>
              <Button type="submit" variant="primary" icon={Search} className="h-[2.625rem] shrink-0 whitespace-nowrap">Search</Button>
            </div>
          </form>
        </div>
      </div>

      {/* Table */}
      <div className={`${CARD} overflow-hidden`}>
        {error ? <ErrorState text={error} onRetry={load} /> : !data ? <TableSkeleton rows={5} /> : data.items.length === 0 ? (
          <EmptyState icon={UserX} title="No requests found" text={search || from || to ? 'No requests match these filters.' : 'There are no supplier deletion requests with this status.'} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface text-xs font-semibold uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">Request</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Supplier ID</th><th className="px-4 py-3">Requested</th>
                    <th className="px-4 py-3">Status</th><th className="px-4 py-3">Obligations</th><th className="px-4 py-3">Last updated</th><th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.items.map((r) => (
                    <tr key={r.id} className="hover:bg-surface/60">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-navy-900">{r.reference}</td>
                      <td className="px-4 py-3"><p className="font-semibold text-navy-900">{r.supplier?.company || r.supplier?.name}</p><p className="text-xs text-muted">{r.supplier?.email}</p></td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{r.supplier?.supplierCode || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(r.createdAt)}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-xs">{r.obligations?.length ? <span className="font-semibold text-amber-700">{r.obligations.length} at last check</span> : <span className="text-muted">None at last check</span>}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{formatDateTime(r.updatedAt)}</td>
                      <td className="px-4 py-3 text-right"><Button variant="outline" size="sm" onClick={() => setOpenId(r.id)}>Review</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line md:hidden">
              {data.items.map((r) => (
                <li key={r.id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><p className="font-semibold text-navy-900">{r.supplier?.company || r.supplier?.name}</p><p className="font-mono text-xs text-muted">{r.reference} · {r.supplier?.supplierCode || '—'}</p></div>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-xs text-muted">Requested {formatDate(r.createdAt)} · updated {formatDateTime(r.updatedAt)}</p>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => setOpenId(r.id)}>Review</Button>
                </li>
              ))}
            </ul>
            {pagination && pagination.totalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm">
                <span className="text-muted">Page {pagination.page} of {pagination.totalPages} · {pagination.total} requests</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" icon={ChevronLeft} disabled={pagination.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
                  <Button variant="outline" size="sm" iconRight={ChevronRight} disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {openId ? <RequestDetail id={openId} onClose={() => setOpenId(null)} onChanged={load} /> : null}
    </div>
  );
}

/* ---------------- Detail ---------------- */

function Fact({ label, children }) {
  return <div className="min-w-0"><dt className="text-xs text-muted">{label}</dt><dd className="mt-0.5 break-words text-sm font-medium text-ink">{children ?? '—'}</dd></div>;
}

function ObligationCard({ icon: Icon, title, rows }) {
  const anyOpen = rows.some(([, value, blocking]) => blocking && Number(value) > 0);
  return (
    <section className={`rounded-xl border p-3.5 ${anyOpen ? 'border-warning/40 bg-warning-50/50' : 'border-line bg-white'}`}>
      <h4 className="flex items-center gap-2 text-sm font-bold text-navy-900"><Icon className="size-4 text-success" aria-hidden="true" />{title}</h4>
      <dl className="mt-2 space-y-1 text-[13px]">
        {rows.map(([label, value, blocking]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-muted">{label}</dt>
            <dd className={`font-semibold ${blocking && Number(value) > 0 ? 'text-danger' : 'text-ink'}`}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const ACTION_TEXT = {
  APPROVE: ['Approve deletion request', 'Listings are hidden now and the account closes after the grace period, unless the supplier cancels. Historical orders and financial records are kept.'],
  REJECT: ['Reject deletion request', 'The supplier keeps their account and can send a new request later. Your reason is sent to the supplier.'],
  HOLD: ['Place request on hold', 'The account is not suspended. Your reason is sent to the supplier; the request stays open for review.'],
  REOPEN: ['Resume review', 'The request goes back to Pending review and the supplier is notified.'],
};

function RequestDetail({ id, onClose, onChanged }) {
  const { money } = useCurrency();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [action, setAction] = useState(null);
  const [form, setForm] = useState({ note: '', internalNote: '', password: '', nextReviewAt: '', acknowledge: false });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const load = useCallback(async () => {
    setChecking(true);
    setError('');
    try { setData(await superAdminApi.getDeletionRequest(id)); } catch (err) { setError(err.message || 'The request could not be loaded.'); } finally { setChecking(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const startAction = (a) => { setFeedback(null); setForm({ note: '', internalNote: '', password: '', nextReviewAt: '', acknowledge: false }); setAction(a); };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const next = await superAdminApi.decideDeletionRequest(id, {
        action, note: form.note, internalNote: form.internalNote || undefined,
        adminPassword: action === 'APPROVE' ? form.password : undefined,
        nextReviewAt: action === 'HOLD' && form.nextReviewAt ? form.nextReviewAt : undefined,
        acknowledgeWarnings: action === 'APPROVE' ? form.acknowledge : undefined,
      });
      setData(next);
      setAction(null);
      setFeedback({ type: 'success', text: 'Decision saved. The supplier has been notified.' });
      onChanged();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'The decision could not be saved.' });
      if (err.status === 409) load(); // someone else changed it, or obligations changed: show the latest state
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    setBusy(true);
    try { setData(await superAdminApi.retryDeletionRequest(id)); setFeedback({ type: 'success', text: 'Final deletion will be retried on the next run.' }); onChanged(); }
    catch (err) { setFeedback({ type: 'error', text: err.message || 'Could not retry.' }); }
    finally { setBusy(false); }
  };

  const report = data?.obligationsReport;
  const state = data?.eligibility?.state;
  const s = data?.supplier || {};
  const noteValid = action === 'REOPEN' ? true : action === 'APPROVE' ? form.note.trim().length >= 5 : form.note.trim().length >= 10;
  const canSubmit = noteValid && (action !== 'APPROVE' || (form.password && (!data?.eligibility?.warnings?.length || form.acknowledge)));
  const lastReview = data?.history?.filter((h) => h.actorRole === 'SUPER_ADMIN').at(-1);

  return (
    <Modal open onClose={() => { if (!busy) onClose(); }} title="Account deletion request" size="xl">
      {error && !data ? <ErrorState text={error} onRetry={load} /> : !data ? <TableSkeleton rows={6} /> : (
        <div className="space-y-5 text-sm">
          {feedback ? <p role={feedback.type === 'error' ? 'alert' : 'status'} className={`rounded-xl px-4 py-3 font-medium ${feedback.type === 'error' ? 'bg-danger-50 text-danger' : 'bg-success-50 text-success'}`}>{feedback.text}</p> : null}

          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-surface p-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-success ring-1 ring-line"><Building2 className="size-5" aria-hidden="true" /></span>
              <div className="min-w-0">
                <p className="font-display text-lg font-bold text-navy-900">{s.company || s.name}</p>
                <p className="font-mono text-xs text-muted">{s.supplierCode || 'No supplier ID'} · {data.reference}</p>
                <p className="mt-1 text-xs text-muted">Submitted {formatDateTime(data.createdAt)}{lastReview ? ` · last reviewed ${formatDateTime(lastReview.at)}` : ''}</p>
              </div>
            </div>
            <StatusBadge status={data.status} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Supplier */}
            <section className="rounded-xl border border-line p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-navy-900">Supplier</h3>
                <Link to={`/super-admin/users?search=${encodeURIComponent(s.email || s.supplierCode || '')}`} className="inline-flex items-center gap-1 text-xs font-semibold text-success hover:underline">View supplier profile <ExternalLink className="size-3" aria-hidden="true" /></Link>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                <Fact label="Email">{s.email}</Fact>
                <Fact label="Phone">{s.phone}</Fact>
                <Fact label="Joined">{s.createdAt ? formatDate(s.createdAt) : null}</Fact>
                <Fact label="Location">{[s.city, s.state, s.country].filter(Boolean).join(', ') || null}</Fact>
                <Fact label="KYC">{String(s.kycStatus || 'NOT_SUBMITTED').replace(/_/g, ' ').toLowerCase()}</Fact>
                <Fact label="Account">{String(s.status || '').toLowerCase()}{s.isActive === false ? ' (inactive)' : ''}</Fact>
                <Fact label="Products: listed (active)">{report ? `${report.products.total} (${report.products.active})${report.products.deleted ? ` · ${report.products.deleted} deleted` : ''}` : null}</Fact>
                <Fact label="Orders (in progress)">{report ? `${report.orders.total} (${report.orders.active})` : null}</Fact>
                <Fact label="Held in escrow">{report ? money(report.payments.escrowHeldAmount) : null}</Fact>
                <Fact label="Pending settlements">{report ? money(report.payments.pendingSettlementAmount + report.payments.pendingPayoutAmount) : null}</Fact>
              </dl>
            </section>

            {/* Request */}
            <section className="rounded-xl border border-line p-4">
              <h3 className="font-bold text-navy-900">Request</h3>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                <Fact label="Request ID">{data.reference}</Fact>
                <Fact label="Status"><StatusBadge status={data.status} /></Fact>
                <Fact label="Submitted">{formatDateTime(data.createdAt)}</Fact>
                <Fact label="Last updated">{formatDateTime(data.updatedAt)}</Fact>
                {data.graceEndsAt ? <Fact label="Grace period ends">{formatDateTime(data.graceEndsAt)}</Fact> : null}
                {data.decisionNote ? <Fact label="Reason sent to supplier">{data.decisionNote}</Fact> : null}
              </dl>
              <div className="mt-3 rounded-lg bg-surface p-3">
                <p className="text-xs font-semibold text-muted">Supplier's reason (as written)</p>
                <p className="mt-1 whitespace-pre-wrap text-ink">{data.reason || 'No reason given.'}</p>
              </div>
            </section>
          </div>

          {/* Live obligations */}
          {report ? (
            <section className="space-y-3">
              <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 ${state === 'ELIGIBLE' ? 'border-success/30 bg-success-50' : state === 'BLOCKED' ? 'border-danger/30 bg-danger-50' : 'border-warning/40 bg-warning-50'}`}>
                <p className="flex items-center gap-2 font-semibold text-navy-900">
                  {state === 'ELIGIBLE' ? <ShieldCheck className="size-5 text-success" aria-hidden="true" /> : state === 'BLOCKED' ? <ShieldAlert className="size-5 text-danger" aria-hidden="true" /> : <AlertTriangle className="size-5 text-warning" aria-hidden="true" />}
                  {state === 'ELIGIBLE' ? 'Eligible for approval' : state === 'BLOCKED' ? 'Blocked by outstanding obligations' : 'Needs review before approval'}
                  <span className="font-normal text-muted">· checked {formatDateTime(report.checkedAt)}</span>
                </p>
                <Button variant="outline" size="sm" icon={RefreshCw} loading={checking} onClick={load}>Recheck obligations</Button>
              </div>
              {[...data.eligibility.blockers, ...data.eligibility.warnings].length ? (
                <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink">
                  {data.eligibility.blockers.map((b) => <li key={b.type} className="text-danger">{b.message}</li>)}
                  {data.eligibility.warnings.map((w) => <li key={w.type} className="text-amber-800">{w.message}</li>)}
                </ul>
              ) : null}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ObligationCard icon={FileText} title="Orders" rows={[
                  ['Pending', report.orders.pending, true], ['Processing', report.orders.processing, true], ['Shipped', report.orders.shipped, true],
                  ['Disputed', report.orders.disputed, true], ['Delivered', report.orders.delivered], ['Cancelled', report.orders.cancelled], ['Refunded', report.orders.refunded],
                ]} />
                <ObligationCard icon={CircleDollarSign} title="Payments" rows={[
                  ['Escrow payments held', report.payments.escrowHeldCount, true], ['Escrow amount', money(report.payments.escrowHeldAmount)],
                  ['Pending payouts', report.payments.pendingPayoutCount, true], ['Payout amount', money(report.payments.pendingPayoutAmount)],
                ]} />
                <ObligationCard icon={Layers} title="Products" rows={[
                  ['Current listings', report.products.total], ['Active (approved)', report.products.active], ['Hidden', report.products.hidden],
                  ['Pending moderation', report.products.pendingModeration], ['Deleted (history kept)', report.products.deleted],
                  ['Will be hidden on approval', report.products.toDeactivate],
                ]} />
                <ObligationCard icon={Truck} title="Other" rows={[
                  ['Shipments in progress', report.other.activeShipments, true], ['Open quotations (withdrawn at closure)', report.other.openQuotations],
                  ['Open support tickets', report.other.openSupportTickets],
                ]} />
              </div>
            </section>
          ) : null}

          {/* Timeline */}
          <section>
            <h3 className="font-bold text-navy-900">History</h3>
            <ol className="mt-3 space-y-4 border-l-2 border-line pl-5">
              {data.history.map((h, i) => (
                <li key={`${h.at}-${i}`} className="relative">
                  <span className="absolute -left-[1.6rem] top-1 size-3 rounded-full bg-white ring-2 ring-success" aria-hidden="true" />
                  <div className="flex flex-wrap items-center gap-2">
                    {h.fromStatus && h.fromStatus !== h.status ? <><StatusBadge status={h.fromStatus} /><span className="text-muted" aria-label="to">→</span></> : null}
                    <StatusBadge status={h.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted">{formatDateTime(h.at)} · {h.actorRole === 'SYSTEM' ? 'System' : h.actorRole === 'SUPER_ADMIN' ? (h.actorName || 'Super Admin') : 'Supplier'}</p>
                  {h.note ? <p className="mt-1 text-ink">{h.note}</p> : null}
                  {h.nextReviewAt ? <p className="mt-0.5 text-xs text-ink">Next review: {formatDate(h.nextReviewAt)}</p> : null}
                  {h.internalNote ? <p className="mt-1 rounded-lg bg-surface px-2.5 py-1.5 text-xs text-muted"><strong>Admin only:</strong> {h.internalNote}</p> : null}
                </li>
              ))}
            </ol>
          </section>

          {/* Actions */}
          {!action && ['PENDING', 'ON_HOLD'].includes(data.status) ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
              {data.status === 'ON_HOLD' ? <Button variant="outline" icon={Play} onClick={() => startAction('REOPEN')}>Resume review</Button> : null}
              {data.status === 'PENDING' ? <Button variant="outline" icon={PauseCircle} onClick={() => startAction('HOLD')}>Place on hold</Button> : null}
              <Button variant="outline" icon={XCircle} onClick={() => startAction('REJECT')}>Reject</Button>
              <Button variant="primary" icon={CheckCircle2} disabled={state === 'BLOCKED'} title={state === 'BLOCKED' ? 'Resolve the outstanding obligations first' : undefined} onClick={() => startAction('APPROVE')}>Approve</Button>
            </div>
          ) : null}

          {action ? (
            <form onSubmit={submit} className="space-y-3 rounded-xl border border-line p-4">
              <p className="font-bold text-navy-900">{ACTION_TEXT[action][0]}</p>
              <p className="text-muted">{ACTION_TEXT[action][1]}{action === 'APPROVE' ? ` Grace period: ${data.graceDays} days.` : ''}</p>
              {action !== 'REOPEN' ? (
                <Textarea id="decision-note" rows={3} maxLength={1000} required value={form.note} onChange={set('note')}
                  label={action === 'APPROVE' ? 'Approval remark (admin only)' : 'Reason (sent to the supplier)'}
                  hint={action === 'APPROVE' ? 'At least 5 characters.' : 'At least 10 characters. Do not include confidential details.'} />
              ) : null}
              {action === 'HOLD' ? <div className="max-w-xs"><Input id="decision-review" type="date" label="Next review date (optional)" value={form.nextReviewAt} onChange={set('nextReviewAt')} /></div> : null}
              {action !== 'APPROVE' ? <Textarea id="decision-internal" rows={2} maxLength={1000} label="Internal note (admin only, optional)" value={form.internalNote} onChange={set('internalNote')} /> : null}
              {action === 'APPROVE' && data.eligibility.warnings.length ? (
                <label className="flex items-start gap-2.5 rounded-lg bg-warning-50 p-3 text-[13px] text-ink">
                  <input type="checkbox" checked={form.acknowledge} onChange={set('acknowledge')} className="mt-0.5 size-4" />
                  I have reviewed: {data.eligibility.warnings.map((w) => w.message).join(' ')}
                </label>
              ) : null}
              {action === 'APPROVE' ? <div className="max-w-sm"><Input id="decision-password" type="password" autoComplete="current-password" required label="Confirm with your Super Admin password" value={form.password} onChange={set('password')} /></div> : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" disabled={busy} onClick={() => setAction(null)}>Back</Button>
                <Button type="submit" variant={action === 'REJECT' ? 'danger' : 'primary'} loading={busy} disabled={busy || !canSubmit}>
                  {{ APPROVE: 'Approve request', REJECT: 'Reject request', HOLD: 'Place on hold', REOPEN: 'Resume review' }[action]}
                </Button>
              </div>
            </form>
          ) : null}

          {data.status === 'FAILED' ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
              <p className="text-danger">Final deletion failed{data.lastError ? `: ${data.lastError}` : '.'}</p>
              <Button variant="outline" icon={RotateCcw} loading={busy} onClick={retry}>Retry final deletion</Button>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
