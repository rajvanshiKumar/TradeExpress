import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, LoaderCircle, Trash2, X } from 'lucide-react';
import CustomSelect from '../common/CustomSelect';
import superAdminApi from '../../api/superAdminApi';

const REASONS = [
  { value: 'POLICY_VIOLATION', label: 'Policy violation' },
  { value: 'FRAUDULENT_ACCOUNT', label: 'Fraudulent account' },
  { value: 'USER_REQUESTED', label: 'User requested account deletion' },
  { value: 'DUPLICATE_ACCOUNT', label: 'Duplicate account' },
];

const ROLE_LABEL = { BUYER: 'Buyer', SUPPLIER: 'Supplier' };

/**
 * Super Admin: delete a Buyer or Supplier account.
 * Eligibility check -> reason, own password and typed DELETE -> final review -> delete.
 */
export default function AdminDeleteUserModal({ user, onClose, onDeleted }) {
  const [check, setCheck] = useState(null);
  const [checkError, setCheckError] = useState('');
  const [step, setStep] = useState('form');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    superAdminApi.getUserDeletionCheck(user.id)
      .then((data) => { if (!cancelled) setCheck(data); })
      .catch((err) => { if (!cancelled) setCheckError(err.message || 'Eligibility could not be checked.'); });
    return () => { cancelled = true; };
  }, [user.id]);

  // Escape closes the dialog (unless the deletion is running)
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !deleting) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [deleting, onClose]);

  const ready = Boolean(check?.canDelete && reason && password && typed.trim() === 'DELETE');
  const reasonLabel = REASONS.find((r) => r.value === reason)?.label;

  const submit = async () => {
    if (deleting) return;
    setDeleting(true);
    setError('');
    try {
      await superAdminApi.deleteUser(user.id, { reason, note: note.trim(), confirmation: typed.trim(), adminPassword: password });
      onDeleted();
    } catch (err) {
      setError(err.message || 'The account could not be deleted.');
      setStep('form');
      if (err.status === 401) setPassword('');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="delete-user-title" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-rose-100 p-2.5 text-rose-700"><Trash2 className="size-5" aria-hidden="true" /></span>
            <div>
              <h3 id="delete-user-title" className="text-base font-bold text-slate-900">Delete User Account</h3>
              <p className="mt-0.5 text-xs text-slate-500">{user.name} · <span className="font-mono">{user.email}</span></p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={deleting} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 p-5 text-sm">
          <p className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              You are requesting deletion of a <strong>{ROLE_LABEL[user.role] || user.role}</strong> account. This action may be irreversible after the
              deletion process completes. Personal data is removed; legally required order, invoice and tax records are retained.
            </span>
          </p>

          {error ? <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p> : null}

          {!check && !checkError ? (
            <p className="flex items-center gap-2 text-xs text-slate-500" role="status"><LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> Checking pending orders, payments, disputes and settlements…</p>
          ) : null}
          {checkError ? <p role="alert" className="text-xs font-semibold text-rose-700">{checkError}</p> : null}
          {check && !check.canDelete ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-bold">This account can’t be deleted yet:</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4">
                {check.blockers.map((blocker) => <li key={blocker.type}>{blocker.message}</li>)}
              </ul>
              <p className="mt-2">Resolve these first, or suspend the account instead.</p>
            </div>
          ) : null}

          {check?.canDelete && step === 'form' ? (
            <form
              noValidate
              className="space-y-3.5"
              onSubmit={(event) => { event.preventDefault(); if (ready) { setError(''); setStep('review'); } }}
            >
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Reason for deletion <span className="text-rose-600">*</span></label>
                <CustomSelect
                  id="delete-user-reason"
                  value={reason}
                  onChange={(val) => setReason(typeof val === 'string' ? val : (val?.target?.value ?? ''))}
                  options={REASONS}
                  placeholder="Select a reason"
                  searchable={false}
                />
              </div>
              <div>
                <label htmlFor="delete-user-note" className="mb-1 block text-xs font-bold text-slate-700">Internal note (optional)</label>
                <textarea id="delete-user-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Visible in the audit log only" />
              </div>
              <div>
                <label htmlFor="delete-user-password" className="mb-1 block text-xs font-bold text-slate-700">Confirm with your Super Admin password <span className="text-rose-600">*</span></label>
                <input id="delete-user-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
              </div>
              <div>
                <label htmlFor="delete-user-confirm" className="mb-1 block text-xs font-bold text-slate-700">Type <span className="font-mono">DELETE</span> to confirm <span className="text-rose-600">*</span></label>
                <input id="delete-user-confirm" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={10} className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button type="submit" disabled={!ready} className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40">Continue</button>
              </div>
            </form>
          ) : null}

          {check?.canDelete && step === 'review' ? (
            <div className="space-y-3">
              <p className="font-semibold text-slate-900">Delete {user.name}’s account now?</p>
              <dl className="space-y-1 rounded-xl bg-slate-50 p-3 text-xs">
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Account</dt><dd className="font-mono text-slate-900">{user.email}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Type</dt><dd className="text-slate-900">{ROLE_LABEL[user.role]}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Reason</dt><dd className="text-slate-900">{reasonLabel}</dd></div>
              </dl>
              <p className="text-xs text-slate-600">The user will be signed out everywhere and notified by email. This is recorded in the audit log with your name and the reason.</p>
              <div className="flex justify-between gap-2 pt-1">
                <button type="button" onClick={() => setStep('form')} disabled={deleting} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                  <ArrowLeft className="size-3.5" aria-hidden="true" /> Back
                </button>
                <button type="button" onClick={submit} disabled={deleting} className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60">
                  {deleting ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3.5" aria-hidden="true" />}
                  {deleting ? 'Deleting…' : 'Delete account'}
                </button>
              </div>
            </div>
          ) : null}

          {check && !check.canDelete ? (
            <div className="flex justify-end"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Close</button></div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
