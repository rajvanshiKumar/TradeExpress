import { useCallback, useEffect, useState } from 'react';
import { Building2, ClipboardList, FileWarning, Plus, ScrollText } from 'lucide-react';
import Button from '../common/Button';
import ConfirmDialog from '../common/ConfirmDialog';
import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import { TableSkeleton } from '../common/Skeleton';
import useNotifications from '../../hooks/useNotifications';
import { transportApi } from '../../api/transportApi';
import ShipmentActionModal from './ShipmentActionModal';
import { approveRequestAction, rejectRequestAction } from './shipmentActions';
import { useShipmentRefresh } from './ShipmentsBoard';
import { ShipmentStatus, StatTile, addressLine, humanize, inr, num, when } from './transportUi';

const REQUEST_TONE = { PENDING: 'bg-amber-50 text-amber-900', APPROVED: 'bg-emerald-50 text-emerald-800', REJECTED: 'bg-rose-50 text-rose-700', CANCELLED: 'bg-slate-100 text-slate-600' };

function useList(loader) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async (silent = false) => {
    if (!silent) setRows(null);
    setError('');
    try {
      setRows((await loader()) || []);
    } catch (err) {
      setError(err.message || 'Could not load.');
      setRows([]);
    }
  }, [loader]);
  useEffect(() => { load(); }, [load]);
  return { rows, error, load };
}

/** Supplier: their requests to TradeExpress. Admin: every supplier's requests with approve / reject. */
export function RequestsPanel({ admin = false, onChanged }) {
  const { showToast } = useNotifications();
  const [status, setStatus] = useState(admin ? 'PENDING' : '');
  const loader = useCallback(() => transportApi.requests(status ? { status } : {}), [status]);
  const { rows, error, load } = useList(loader);
  const [action, setAction] = useState(null);
  const [withdraw, setWithdraw] = useState(null);
  const [busy, setBusy] = useState(false);
  useShipmentRefresh(load);

  const done = (message) => { setAction(null); showToast(message, 'success'); load(true); onChanged?.(); };
  const doWithdraw = async () => {
    setBusy(true);
    try {
      await transportApi.cancelRequest(withdraw.id);
      setWithdraw(null);
      done('Request withdrawn.');
    } catch (err) {
      showToast(err.message || 'Could not withdraw the request.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {['', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((s) => (
          <button key={s || 'all'} type="button" onClick={() => setStatus(s)} className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${status === s ? 'bg-emerald-800 text-white' : 'bg-white text-slate-700 ring-1 ring-line hover:bg-surface'}`}>{s ? humanize(s) : 'All'}</button>
        ))}
      </div>
      {rows === null ? <TableSkeleton rows={4} /> : error ? <ErrorState title="Requests unavailable" text={error} onRetry={load} /> : !rows.length ? (
        <EmptyState icon={ClipboardList} title="No transport requests" text={admin ? 'Supplier requests for TradeExpress trucks appear here.' : 'When you do not have a truck, open a shipment and choose "Request truck from TradeExpress".'} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((r) => (
            <article key={r.id} className="rounded-2xl border border-line bg-white p-4 shadow-2xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-sm font-bold">{r.requestNumber}</p>
                  <p className="text-[12px] text-muted">{admin ? `${r.supplier?.name} · ` : ''}Order #{r.order?.orderNumber} · shipment {r.shipment?.shipmentNumber}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${REQUEST_TONE[r.status] || ''}`}>{humanize(r.status)}</span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
                <div><dt className="text-[11px] text-muted">Ready for pickup</dt><dd className="font-medium">{when(r.pickupDate)}</dd></div>
                <div><dt className="text-[11px] text-muted">Deliver by</dt><dd className="font-medium">{when(r.expectedDeliveryDate)}</dd></div>
                <div><dt className="text-[11px] text-muted">Cargo</dt><dd className="font-medium">{r.cargoDetails?.totalWeightKg ? `${num(r.cargoDetails.totalWeightKg)} kg` : '—'}{r.cargoDetails?.totalPackages ? ` · ${num(r.cargoDetails.totalPackages)} pkgs` : ''}</dd></div>
                <div><dt className="text-[11px] text-muted">Preferred truck</dt><dd className="font-medium">{humanize(r.cargoDetails?.preferredVehicleType)}</dd></div>
                <div className="col-span-2"><dt className="text-[11px] text-muted">Route</dt><dd className="font-medium">{addressLine(r.pickupAddress)} → {addressLine(r.deliveryAddress)}</dd></div>
                {r.loadingRequirements ? <div className="col-span-2"><dt className="text-[11px] text-muted">Requirements</dt><dd>{r.loadingRequirements}</dd></div> : null}
                <div><dt className="text-[11px] text-muted">Target freight</dt><dd className="font-medium">{r.targetFreight !== null ? inr(r.targetFreight) : '—'}</dd></div>
                <div><dt className="text-[11px] text-muted">Approved freight</dt><dd className="font-medium">{r.approvedFreight !== null ? `${inr(r.approvedFreight)} · ${humanize(r.freightPayer)} pays` : '—'}</dd></div>
              </dl>
              {r.rejectionReason ? <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-[13px] text-rose-800">Rejected: {r.rejectionReason}</p> : null}
              {r.notes ? <p className="mt-2 text-[13px] text-muted">Note: {r.notes}</p> : null}
              {r.status === 'PENDING' ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {admin ? (
                    <>
                      <Button size="sm" onClick={() => setAction(approveRequestAction(r))}>Approve & assign truck</Button>
                      <Button size="sm" variant="outline" onClick={() => setAction(rejectRequestAction(r))}>Reject</Button>
                    </>
                  ) : <Button size="sm" variant="outline" onClick={() => setWithdraw(r)}>Withdraw request</Button>}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
      {action ? <ShipmentActionModal action={action} onClose={() => setAction(null)} onDone={() => done(action.key === 'approve-request' ? 'Truck assigned and supplier notified.' : 'Request rejected and supplier notified.')} /> : null}
      <ConfirmDialog open={Boolean(withdraw)} title="Withdraw transport request?" text="The shipment goes back to awaiting transport. You can assign your own truck or request again." confirmLabel="Withdraw" onConfirm={doWithdraw} onCancel={() => setWithdraw(null)} loading={busy} />
    </div>
  );
}

/** Delivery issues: damage, shortages, delays, failed deliveries. Admin resolves them. */
export function IssuesPanel({ admin = false }) {
  const { showToast } = useNotifications();
  const [status, setStatus] = useState('OPEN,IN_REVIEW');
  const loader = useCallback(() => transportApi.issues({ status }), [status]);
  const { rows, error, load } = useList(loader);
  const [action, setAction] = useState(null);

  const resolve = (issue) => ({
    key: 'resolve', label: 'Save', title: `${humanize(issue.issueType)} — ${issue.shipment.shipmentNumber}`, intro: issue.description,
    fields: [
      { name: 'status', label: 'Outcome', type: 'select', required: true, options: [{ value: 'IN_REVIEW', label: 'Under review' }, { value: 'RESOLVED', label: 'Resolved' }, { value: 'REJECTED', label: 'Rejected (not valid)' }] },
      { name: 'resolution', label: 'Resolution (shared with buyer and supplier)', type: 'textarea' },
    ],
    submit: (body) => transportApi.resolveIssue(issue.id, body),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[['OPEN,IN_REVIEW', 'Open'], ['RESOLVED,REJECTED', 'Closed'], ['', 'All']].map(([value, label]) => (
          <button key={label} type="button" onClick={() => setStatus(value)} className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${status === value ? 'bg-emerald-800 text-white' : 'bg-white text-slate-700 ring-1 ring-line hover:bg-surface'}`}>{label}</button>
        ))}
      </div>
      {rows === null ? <TableSkeleton rows={4} /> : error ? <ErrorState title="Issues unavailable" text={error} onRetry={load} /> : !rows.length ? <EmptyState icon={FileWarning} title="No delivery issues" text="Damage, shortages, delays and failed deliveries appear here." /> : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <div className="ts-slim-scrollbar overflow-x-auto">
            <table className="ts-table [&_td]:px-3 [&_th]:px-3">
              <thead><tr><th>Issue</th><th>Shipment</th><th>Reported</th><th>Status</th>{admin ? <th className="text-right">Action</th> : null}</tr></thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id}>
                    <td className="max-w-md"><p className="font-semibold">{humanize(i.issueType)}{i.quantity ? ` × ${num(i.quantity)}` : ''}</p><p className="text-[12px] text-muted">{i.description}</p>{i.resolution ? <p className="text-[12px]">Resolution: {i.resolution}</p> : null}{i.photoUrls?.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer" className="mr-2 text-[12px] font-semibold text-navy-700 hover:underline">Photo</a>)}</td>
                    <td className="whitespace-nowrap text-[13px]"><span className="font-mono">{i.shipment.shipmentNumber}</span><p className="text-[11px] text-muted">#{i.shipment.orderNumber} · {i.shipment.supplier}</p><ShipmentStatus status={i.shipment.status} /></td>
                    <td className="whitespace-nowrap text-[12px]">{humanize(i.reportedByRole)}<p className="text-muted">{when(i.createdAt)}</p></td>
                    <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${['RESOLVED', 'REJECTED'].includes(i.status) ? 'bg-slate-100 text-slate-700' : 'bg-rose-50 text-rose-700'}`}>{humanize(i.status)}</span></td>
                    {admin ? <td className="text-right">{['OPEN', 'IN_REVIEW'].includes(i.status) ? <Button size="sm" variant="outline" onClick={() => setAction(resolve(i))}>Resolve</Button> : null}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {action ? <ShipmentActionModal action={action} onClose={() => setAction(null)} onDone={() => { setAction(null); showToast('Issue updated.', 'success'); load(true); }} /> : null}
    </div>
  );
}

/** External transporters and the TradeExpress fleet (Super Admin). */
export function ProvidersPanel() {
  const { showToast } = useNotifications();
  const loader = useCallback(() => transportApi.providers(), []);
  const { rows, error, load } = useList(loader);
  const [action, setAction] = useState(null);

  const providerForm = (p) => ({
    key: 'provider', label: p ? 'Save provider' : 'Add provider', title: p ? `Edit ${p.name}` : 'Add transport provider', size: 'lg',
    fields: [
      { name: 'name', label: 'Company name', type: 'text', required: true, default: p?.name },
      { name: 'contactPerson', label: 'Contact person', type: 'text', required: true, half: true, default: p?.contactPerson },
      { name: 'phone', label: 'Phone', type: 'text', required: true, half: true, default: p?.phone },
      { name: 'email', label: 'Email', type: 'text', required: true, half: true, default: p?.email },
      { name: 'gstin', label: 'GSTIN', type: 'text', half: true, default: p?.gstin },
      { name: 'city', label: 'City', type: 'text', half: true, default: p?.city },
      { name: 'state', label: 'State', type: 'text', half: true, default: p?.state },
      ...(p ? [{ name: 'status', label: 'Status', type: 'select', half: true, default: p.status, options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'SUSPENDED', label: 'Suspended' }] }] : []),
    ],
    submit: (body) => (p ? transportApi.updateProvider(p.id, body) : transportApi.createProvider(body)),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button icon={Plus} onClick={() => setAction(providerForm(null))}>Add provider</Button></div>
      {rows === null ? <TableSkeleton rows={3} /> : error ? <ErrorState title="Providers unavailable" text={error} onRetry={load} /> : !rows.length ? <EmptyState icon={Building2} title="No transport providers" text="Add the transport companies TradeExpress hires trucks from." /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => (
            <article key={p.id} className="rounded-2xl border border-line bg-white p-4 shadow-2xs">
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-bold">{p.name}</p><p className="text-[12px] text-muted">{p.type === 'PLATFORM' ? 'TradeExpress fleet' : 'External transporter'}{p.city ? ` · ${p.city}` : ''}</p></div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${p.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>{humanize(p.status)}</span>
              </div>
              <p className="mt-2 text-[13px]">{p.contactPerson} · {p.phone}<br /><span className="text-muted">{p.email}{p.gstin ? ` · ${p.gstin}` : ''}</span></p>
              <p className="mt-2 text-[12px] text-muted">{num(p.vehicles)} trucks · {num(p.drivers)} drivers · {num(p.shipments)} shipments</p>
              {p.type !== 'PLATFORM' ? <Button className="mt-3" size="sm" variant="outline" onClick={() => setAction(providerForm(p))}>Edit</Button> : null}
            </article>
          ))}
        </div>
      )}
      {action ? <ShipmentActionModal action={action} onClose={() => setAction(null)} onDone={() => { setAction(null); showToast('Provider saved.', 'success'); load(true); }} /> : null}
    </div>
  );
}

/** Reports and audit trail (Super Admin). */
export function ReportsPanel() {
  const [report, setReport] = useState(null);
  const [audit, setAudit] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      const [r, a] = await Promise.all([transportApi.reports(), transportApi.audit({ limit: 50 })]);
      setReport(r);
      setAudit(a);
    } catch (err) {
      setError(err.message || 'Could not load reports.');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorState title="Reports unavailable" text={error} onRetry={load} />;
  if (!report) return <TableSkeleton rows={5} />;
  const totalFreight = report.freightByPayer.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Delivered" value={num(report.delivered)} tone="emerald" />
        <StatTile label="On-time rate" value={report.onTimeRate === null ? '—' : `${report.onTimeRate}%`} hint="Delivered by the estimated date" tone="sky" />
        <StatTile label="Avg. transit" value={report.averageTransitHours === null ? '—' : `${report.averageTransitHours} h`} hint="Dispatch to delivery" tone="indigo" />
        <StatTile label="Freight booked" value={inr(totalFreight)} tone="amber" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-line bg-white p-4">
          <h4 className="mb-2 text-sm font-bold">Shipments by status</h4>
          <ul className="space-y-1 text-[13px]">{Object.entries(report.byStatus).map(([s, c]) => <li key={s} className="flex justify-between"><span>{humanize(s)}</span><span className="font-bold">{num(c)}</span></li>)}</ul>
        </section>
        <section className="rounded-2xl border border-line bg-white p-4">
          <h4 className="mb-2 text-sm font-bold">Freight</h4>
          <ul className="space-y-1 text-[13px]">
            {report.freightByPayer.map((r) => <li key={r.payer} className="flex justify-between"><span>{humanize(r.payer)} pays ({num(r.shipments)})</span><span className="font-bold">{inr(r.amount)}</span></li>)}
            {report.freightByPaymentStatus.map((r) => <li key={r.status} className="flex justify-between text-muted"><span>{humanize(r.status)}</span><span>{inr(r.amount)}</span></li>)}
          </ul>
        </section>
        <section className="rounded-2xl border border-line bg-white p-4">
          <h4 className="mb-2 text-sm font-bold">Top suppliers by shipments</h4>
          <ul className="space-y-1 text-[13px]">{report.topSuppliers.map((s) => <li key={s.supplierId} className="flex justify-between"><span className="truncate">{s.supplier}</span><span className="font-bold">{num(s.shipments)}</span></li>)}</ul>
          {report.issues.length ? <><h4 className="mb-1 mt-4 text-sm font-bold">Issues</h4><ul className="space-y-1 text-[13px]">{report.issues.map((i) => <li key={`${i.issueType}-${i.status}`} className="flex justify-between"><span>{humanize(i.issueType)} · {humanize(i.status)}</span><span className="font-bold">{num(i.count)}</span></li>)}</ul></> : null}
        </section>
      </div>
      <section className="rounded-2xl border border-line bg-white p-4">
        <h4 className="mb-3 flex items-center gap-1.5 text-sm font-bold"><ScrollText className="size-4" />Audit trail</h4>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">Admin actions</p>
            <ul className="max-h-96 space-y-2 overflow-y-auto text-[13px]">
              {audit.adminActions.length ? audit.adminActions.map((a) => <li key={a.id} className="rounded-xl border border-line px-3 py-2"><span className="font-semibold">{humanize(a.action)}</span> <span className="text-muted">by {a.actorEmail} · {when(a.createdAt)}</span>{a.details?.reason ? <p className="text-muted">{a.details.reason}</p> : null}</li>) : <li className="text-muted">No admin actions yet.</li>}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">Shipment events</p>
            <ul className="max-h-96 space-y-2 overflow-y-auto text-[13px]">
              {audit.shipmentEvents.length ? audit.shipmentEvents.map((e) => <li key={e.id} className="rounded-xl border border-line px-3 py-2"><span className="font-mono">{e.shipmentNumber}</span> · <span className="font-semibold">{e.title}</span>{e.location ? ` · ${e.location}` : ''}<p className="text-muted">{e.actorName} ({humanize(e.actorRole)}) · {when(e.recordedAt)} · {e.source.toLowerCase()}</p></li>) : <li className="text-muted">No events yet.</li>}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
