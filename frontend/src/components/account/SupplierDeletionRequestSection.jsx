import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, CircleCheck, Clock3, RefreshCw, Send, XCircle } from 'lucide-react';
import Button from '../common/Button';
import Input, { Textarea } from '../common/Input';
import ConfirmDialog from '../common/ConfirmDialog';
import { AccountCard } from './AccountUi';
import { CodeStep, Notice, Steps } from './AccountVerificationFlows';
import { cancelDeletionRequest, createDeletionRequest, getDeletionRequest, sendAccountCode, verifyAccountCode } from '../../services/accountApi';
import { formatDate, formatDateTime } from '../../utils/formatDate';

const STATUS = {
  PENDING: { label: 'Waiting for review', tone: 'bg-amber-50 text-amber-800', icon: Clock3 },
  ON_HOLD: { label: 'On hold', tone: 'bg-amber-50 text-amber-800', icon: AlertTriangle },
  APPROVED: { label: 'Approved — closing after the grace period', tone: 'bg-danger-50 text-danger', icon: Clock3 },
  PROCESSING: { label: 'Closing your account', tone: 'bg-danger-50 text-danger', icon: Clock3 },
  FAILED: { label: 'Being handled by TradeExpress', tone: 'bg-amber-50 text-amber-800', icon: AlertTriangle },
  REJECTED: { label: 'Rejected', tone: 'bg-slate-100 text-slate-700', icon: XCircle },
  CANCELLED: { label: 'Cancelled', tone: 'bg-slate-100 text-slate-700', icon: XCircle },
  COMPLETED: { label: 'Account closed', tone: 'bg-slate-100 text-slate-700', icon: CircleCheck },
};
const ACTIVE = ['PENDING', 'ON_HOLD', 'APPROVED', 'PROCESSING', 'FAILED'];
const BLOCKER_LINKS = { ACTIVE_ORDERS: '/supplier/orders', ESCROW_HELD: '/supplier/payments', OPEN_DISPUTES: '/supplier/orders', PENDING_PAYOUTS: '/supplier/payments', ACTIVE_SHIPMENTS: '/supplier/transport' };

/**
 * Supplier: Request Account Deletion. A Super Admin reviews the request; if approved, the account closes after a
 * grace period during which the supplier can still cancel. Nothing is deleted from this screen.
 */
export default function SupplierDeletionRequestSection({ settings }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState(0);
  const [grant, setGrant] = useState('');
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(async () => {
    setLoadError('');
    try { setData(await getDeletionRequest()); } catch (err) { setLoadError(err.message || 'We could not load your request. Please try again.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (event) => {
    event.preventDefault();
    if (busy || typed.trim() !== 'DELETE') return;
    setBusy(true);
    setMessage(null);
    try {
      await createDeletionRequest({ grant, confirmation: typed.trim(), reason });
      setStep(0); setGrant(''); setTyped(''); setReason('');
      setMessage({ type: 'success', text: 'Your request was sent. TradeExpress will review it and notify you.' });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Your request could not be sent. Please try again.' });
      if (/verify your email again/i.test(err.message || '')) { setGrant(''); setStep(1); }
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await cancelDeletionRequest();
      setConfirmCancel(false);
      setMessage({ type: 'success', text: 'Your request was cancelled. Your account stays open.' });
      await load();
    } catch (err) {
      setConfirmCancel(false);
      setMessage({ type: 'error', text: err.message || 'The request could not be cancelled.' });
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return <AccountCard title="Request account deletion"><div role="alert" className="rounded-xl bg-danger-50 p-4 text-sm text-danger">{loadError} <Button variant="ghost" size="sm" icon={RefreshCw} onClick={load}>Try again</Button></div></AccountCard>;
  }
  if (!data) return <AccountCard title="Request account deletion"><p className="text-sm text-muted" role="status">Loading…</p></AccountCard>;

  const request = data.request;
  const active = request && ACTIVE.includes(request.status);

  /* An open request: show its status, history and the cancel option */
  if (active) {
    const s = STATUS[request.status] || STATUS.PENDING;
    return (
      <AccountCard title="Your account deletion request" description={`Sent on ${formatDate(request.createdAt)}.`}>
        <Notice message={message} />
        <div className={`flex items-start gap-3 rounded-xl p-4 ${s.tone}`}>
          <s.icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-bold">{s.label}</p>
            {request.status === 'APPROVED' && request.graceEndsAt ? <p className="mt-0.5">Your products are hidden from buyers. Your account will be closed on <strong>{formatDate(request.graceEndsAt)}</strong>. You can cancel until then.</p> : null}
            {request.status === 'PENDING' ? <p className="mt-0.5">TradeExpress will review your request. You will be notified of the decision.</p> : null}
            {request.decisionNote ? <p className="mt-1">Note from TradeExpress: {request.decisionNote}</p> : null}
          </div>
        </div>
        {request.obligations?.length ? (
          <div className="mt-4 rounded-xl border border-warning/30 bg-warning-50 p-4 text-sm">
            <p className="font-semibold text-navy-900">Open items to finish first:</p>
            <ul className="mt-2 space-y-1.5">{request.obligations.map((b) => <li key={b.type}>{b.message}</li>)}</ul>
          </div>
        ) : null}
        <h3 className="mt-5 text-sm font-bold text-navy-900">History</h3>
        <ol className="mt-2 space-y-2 border-l-2 border-line pl-4 text-[13px]">
          {request.history.map((h, i) => (
            <li key={`${h.at}-${i}`}>
              <span className="font-semibold text-navy-900">{(STATUS[h.status] || { label: h.status }).label}</span>
              <span className="text-muted"> · {formatDateTime(h.at)}</span>
              {h.note ? <p className="text-muted">{h.note}</p> : null}
            </li>
          ))}
        </ol>
        {request.canCancel ? (
          <div className="mt-5 flex justify-end">
            <Button variant="outline" disabled={busy} onClick={() => setConfirmCancel(true)}>Cancel my request</Button>
          </div>
        ) : null}
        <ConfirmDialog open={confirmCancel} title="Cancel your deletion request?" text="Your account stays open, and any products hidden because of this request are shown to buyers again."
          confirmLabel="Cancel request" cancelLabel="Keep request" loading={busy} onConfirm={cancel} onCancel={() => setConfirmCancel(false)} />
      </AccountCard>
    );
  }

  /* No open request: review -> verify email -> reason + confirm */
  return (
    <AccountCard>
      <Steps steps={['Review', 'Verify your email', 'Send request']} current={step} />
      <Notice message={message} />
      {request && ['REJECTED', 'CANCELLED'].includes(request.status) ? (
        <p className="mb-4 rounded-xl bg-surface px-4 py-3 text-sm text-muted">
          Your previous request ({formatDate(request.createdAt)}) was {request.status.toLowerCase()}.{request.decisionNote ? ` Note: ${request.decisionNote}` : ''}
        </p>
      ) : null}

      {step === 0 ? (
        <div className="space-y-5">
          <div className="flex gap-3 rounded-xl border border-danger/20 bg-danger-50 p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
            <div>
              <h3 className="font-display text-base font-bold text-danger">Request to close your supplier account</h3>
              <p className="mt-1 text-sm text-navy-900">TradeExpress reviews every supplier closure. Nothing is deleted until the request is approved and the grace period ends.</p>
            </div>
          </div>
          <ul className="list-disc space-y-2 pl-5 text-sm text-ink marker:text-danger">
            <li>If approved, your products are hidden from buyers straight away and your account closes after <strong>{data.graceDays} days</strong>. You can cancel during that time.</li>
            <li>When it closes, you are signed out everywhere and your personal and business contact details are removed.</li>
            <li>Past orders, payments, invoices and shipment records are kept, as the law requires.</li>
            <li>Open orders, payments held in escrow, open disputes, pending payouts and shipments in progress must be finished first.</li>
          </ul>
          {data.blockers.length ? (
            <div className="rounded-xl border border-warning/30 bg-warning-50 p-4">
              <p className="text-sm font-semibold text-navy-900">These must be finished before your account can be closed (you can still send the request; it will wait until they are done):</p>
              <ul className="mt-3 space-y-2">
                {data.blockers.map((b) => (
                  <li key={b.type} className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink">
                    <span>{b.message}</span>
                    {BLOCKER_LINKS[b.type] ? <Link to={BLOCKER_LINKS[b.type]} className="inline-flex items-center gap-1 font-semibold text-success hover:underline">Review <ArrowRight className="size-3.5" aria-hidden="true" /></Link> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button to="/supplier/account-settings" variant="ghost">Keep my account</Button>
            <Button variant="danger" iconRight={ArrowRight} onClick={() => { setMessage(null); setStep(1); }}>Continue</Button>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <CodeStep
          title="Verify it’s you"
          description={`To protect your account, we will send a code to ${settings.profile.maskedEmail}.`}
          onBack={() => setStep(0)}
          send={() => sendAccountCode('ACCOUNT_DELETE')}
          verify={async (otp) => {
            const result = await verifyAccountCode('ACCOUNT_DELETE', otp);
            setGrant(result.grant);
            setMessage(null);
            setStep(2);
          }}
        />
      ) : null}

      {step === 2 ? (
        <form noValidate className="space-y-4" onSubmit={submit}>
          <Textarea id="deletion-reason" label="Reason (optional)" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} hint="Helps TradeExpress review your request." />
          <Input id="deletion-confirmation" label="Type DELETE to confirm" required autoComplete="off" maxLength={10} value={typed} onChange={(e) => setTyped(e.target.value)} />
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep(0)} disabled={busy}>Back</Button>
            <Button type="submit" variant="danger" icon={Send} loading={busy} disabled={busy || typed.trim() !== 'DELETE'}>Send deletion request</Button>
          </div>
        </form>
      ) : null}
    </AccountCard>
  );
}
