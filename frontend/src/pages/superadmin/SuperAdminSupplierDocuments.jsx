import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, Ban, CheckCircle2, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, LoaderCircle, PenLine, QrCode, RefreshCw, RotateCcw, Search, UserRound, X, XCircle,
} from 'lucide-react';
import superAdminApi from '../../api/superAdminApi';
import Button from '../../components/common/Button';
import CustomSelect from '../../components/common/CustomSelect';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import { DocumentImage, ProfilePhotoField, VerificationBadge } from '../../components/suppliers/SupplierDocumentParts';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import useNotifications from '../../hooks/useNotifications';
import {
  adminCertificatePdf, adminGet, adminGetSignatory, adminIdCardPdf, adminList, adminPhoto, adminPreview, adminRegenerate, adminReplacePhoto, adminUpdateSignatory, adminUpdateValidity,
} from '../../services/supplierDocumentApi';
import { formatDate } from '../../utils/formatDate';
import { saveBlob } from '../../utils/profilePhoto';

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

const dateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

/** A supplier's photograph, which needs a signed-in request. */
function PhotoThumb({ userId, hasPhoto, version = 0, className }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!hasPhoto) return undefined;
    let active = true;
    let created = '';
    adminPhoto(userId)
      .then(({ blob }) => {
        if (!active) return;
        created = URL.createObjectURL(blob);
        setUrl(created);
      })
      .catch(() => {});
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [userId, hasPhoto, version]);
  return (
    <span className={`flex items-center justify-center overflow-hidden bg-slate-100 ${className}`}>
      {url ? <img src={url} alt="Supplier" className="h-full w-full object-cover" /> : <UserRound className="size-5 text-slate-400" aria-hidden="true" />}
    </span>
  );
}

/** Asks for a reason before a decision that needs one. */
function ReasonDialog({ dialog, onClose, onConfirm, busy }) {
  const [reason, setReason] = useState('');
  if (!dialog) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="doc-reason-title">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 id="doc-reason-title" className="text-base font-bold text-slate-900">{dialog.title}</h3>
        <p className="mt-1 text-sm text-slate-600">{dialog.text}</p>
        <label htmlFor="doc-reason" className="mt-3 block text-xs font-semibold text-slate-700">Reason <span className="text-red-500">*</span></label>
        <textarea id="doc-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30" />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" variant="danger" size="sm" disabled={busy || !reason.trim()} onClick={() => onConfirm(reason.trim())}>{busy ? 'Saving…' : dialog.confirm}</Button>
        </div>
      </div>
    </div>
  );
}

function DocumentDrawer({ userId, onClose, onChanged }) {
  const { showToast } = useNotifications();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [version, setVersion] = useState(0);
  const [validity, setValidity] = useState({ validUntil: '', idCardValidUntil: '' });
  const [dialog, setDialog] = useState(null);

  const apply = useCallback((data) => {
    setDoc(data);
    setValidity({ validUntil: dateInput(data.validUntil), idCardValidUntil: dateInput(data.idCardValidUntil) });
    setVersion((n) => n + 1);
  }, []);

  const load = useCallback(async () => {
    setError('');
    try {
      apply(await adminGet(userId));
    } catch (problem) {
      setError(problem.message);
    }
  }, [apply, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (name, action, message) => {
    if (busy) return;
    setBusy(name);
    try {
      await action();
      await load();
      onChanged();
      if (message) showToast(message, 'success');
      setDialog(null);
    } catch (problem) {
      showToast(problem.message || 'That action could not be completed.', 'error');
    } finally {
      setBusy('');
    }
  };

  const download = async (name, fetcher) => {
    if (busy) return;
    setBusy(name);
    try {
      const { blob, fileName } = await fetcher(userId);
      saveBlob(blob, fileName);
    } catch (problem) {
      showToast(problem.message || 'The document could not be downloaded.', 'error');
    } finally {
      setBusy('');
    }
  };

  const review = (status, reason) => run(status, () => superAdminApi.reviewSupplierKyc(userId, { status, rejectionReason: reason, notes: reason }), status === 'VERIFIED' ? 'Supplier verified. Documents issued.' : 'Supplier verification rejected.');
  const setSuspended = (suspended, reason) => run('status', () => superAdminApi.updateUserStatus(userId, { status: suspended ? 'SUSPENDED' : 'ACTIVE', isActive: !suspended, reason }), suspended ? 'Supplier suspended.' : 'Supplier reactivated.');

  const confirmDialog = (reason) => (dialog.kind === 'reject' ? review('REJECTED', reason) : setSuspended(true, reason));

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-slate-900/40" role="dialog" aria-modal="true" aria-label="Supplier documents">
      <button type="button" className="hidden flex-1 cursor-default sm:block" aria-label="Close" onClick={onClose} />
      <div className="h-full w-full max-w-4xl overflow-y-auto bg-[#f4f7f5] p-4 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 [overflow-wrap:anywhere]">{doc?.account.company || doc?.account.name || 'Supplier documents'}</h2>
            {doc ? <p className="text-xs text-slate-500">{doc.supplierId} · {doc.certificateNumber}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-200" aria-label="Close"><X className="size-5" aria-hidden="true" /></button>
        </div>

        {error ? <ErrorState text={error} onRetry={load} /> : null}
        {!doc && !error ? <div className="flex justify-center py-16 text-slate-400" role="status" aria-label="Loading"><LoaderCircle className="size-7 animate-spin" aria-hidden="true" /></div> : null}

        {doc ? (
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-3">
                <VerificationBadge status={doc.documentStatus} />
                {doc.verifiedAt ? <span className="text-xs text-slate-500">Verified {formatDate(doc.verifiedAt)}</span> : null}
                <span className="text-xs text-slate-500">Revision {doc.revision}</span>
              </div>
              {doc.suspensionReason ? <p className="mt-2 text-sm text-slate-700">Suspension reason: {doc.suspensionReason}</p> : null}
              {doc.rejectionReason && doc.verificationStatus === 'REJECTED' ? <p className="mt-2 text-sm text-rose-800">Rejection reason: {doc.rejectionReason}</p> : null}
              {doc.detailsChanged ? (
                <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="status">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  This supplier&apos;s details have changed since approval. The documents still show the approved details until you regenerate them.
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {doc.verificationStatus !== 'VERIFIED' ? <Button type="button" size="sm" variant="navy" icon={CheckCircle2} disabled={Boolean(busy) || doc.account.status === 'SUSPENDED'} onClick={() => review('VERIFIED', '')}>Approve &amp; verify</Button> : null}
                {doc.verificationStatus !== 'REJECTED' && doc.account.status !== 'SUSPENDED' ? <Button type="button" size="sm" variant="dangerOutline" icon={XCircle} disabled={Boolean(busy)} onClick={() => setDialog({ kind: 'reject', title: 'Reject verification', text: 'The supplier sees this reason, and their documents will show REJECTED.', confirm: 'Reject' })}>Reject</Button> : null}
                {doc.account.status === 'SUSPENDED'
                  ? <Button type="button" size="sm" variant="outline" icon={RotateCcw} disabled={Boolean(busy)} onClick={() => setSuspended(false, 'Reactivated from Supplier Documents')}>Reactivate</Button>
                  : <Button type="button" size="sm" variant="dangerOutline" icon={Ban} disabled={Boolean(busy)} onClick={() => setDialog({ kind: 'suspend', title: 'Suspend supplier', text: 'They cannot sign in, and their documents and public profile will show SUSPENDED.', confirm: 'Suspend' })}>Suspend</Button>}
                <Button type="button" size="sm" variant="outline" icon={RefreshCw} disabled={Boolean(busy) || doc.missingDetails.length > 0} onClick={() => run('regenerate', () => adminRegenerate(userId), 'Documents regenerated with the current details.')}>Regenerate documents</Button>
              </div>
            </section>

            <div className="grid gap-5 md:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-bold text-slate-900">Registration information</h3>
                <dl className="mt-2 space-y-1.5 text-sm">
                  {[
                    ['Supplier name', doc.details.supplierName],
                    ['Business name', doc.details.businessName],
                    ['Business address', doc.details.businessAddress],
                    ['Business type', doc.details.businessType],
                    ['Registration number', doc.details.registrationNumber],
                    ['GSTIN', doc.details.gstin],
                    ['Email', doc.account.email],
                    ['Mobile', doc.account.phone],
                    ['Registered', formatDate(doc.account.createdAt)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3">
                      <dt className="shrink-0 text-slate-500">{label}</dt>
                      <dd className="text-right font-medium text-slate-900 [overflow-wrap:anywhere]">{value || 'Not provided'}</dd>
                    </div>
                  ))}
                </dl>
                {doc.detailsChanged ? <p className="mt-2 text-xs text-slate-500">Current profile: {doc.currentDetails.businessName}, {doc.currentDetails.businessAddress}</p> : null}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-bold text-slate-900">Photograph and QR code</h3>
                <div className="mt-3 flex flex-wrap items-start gap-4">
                  <PhotoThumb userId={userId} hasPhoto={doc.hasPhoto} version={version} className="h-32 w-24 rounded-xl border border-slate-200" />
                  <div>
                    <img src={doc.qrCodeDataUrl} alt={`QR code for ${doc.supplierId}`} className="size-32 rounded-xl border border-slate-200" />
                    <a href={`/supplier/${doc.supplierId}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline">Public profile <ExternalLink className="size-3" aria-hidden="true" /></a>
                  </div>
                </div>
                <div className="mt-3">
                  <ProfilePhotoField id="admin-replace-photo" showPreview={false} value="" onSelect={(photo) => run('photo', () => adminReplacePhoto(userId, photo), 'Photograph replaced.')} saving={busy === 'photo'} buttonLabel={doc.hasPhoto ? 'Replace photograph' : 'Add photograph'} hint="Replaces the photograph on this supplier's ID card." />
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">Registration Certificate</h3>
                <Button type="button" size="sm" variant="outline" icon={busy === 'certificate' ? LoaderCircle : Download} disabled={Boolean(busy) || doc.missingDetails.length > 0} onClick={() => download('certificate', adminCertificatePdf)}>Download PDF</Button>
              </div>
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                {doc.missingDetails.length ? <p className="p-6 text-center text-sm text-slate-500">Missing: {doc.missingDetails.join(', ')}.</p> : <DocumentImage load={() => adminPreview(userId, 'certificate').then((r) => r.blob)} loadKey={version} alt="Registration Certificate" className="min-h-48" />}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">Supplier ID Card</h3>
                <Button type="button" size="sm" variant="outline" icon={busy === 'card' ? LoaderCircle : Download} disabled={Boolean(busy) || !doc.hasPhoto || doc.missingDetails.length > 0} onClick={() => download('card', adminIdCardPdf)}>Download PDF</Button>
              </div>
              {!doc.hasPhoto ? <p className="mt-2 text-xs font-medium text-amber-800">No photograph yet, so the card cannot be downloaded.</p> : null}
              {doc.missingDetails.length ? null : (
                <div className="mt-3 grid max-w-xl grid-cols-2 gap-3 rounded-xl bg-slate-100 p-3">
                  <DocumentImage load={() => adminPreview(userId, 'id-card-front').then((r) => r.blob)} loadKey={version} alt="Front of ID card" className="min-h-48" />
                  <DocumentImage load={() => adminPreview(userId, 'id-card-back').then((r) => r.blob)} loadKey={version} alt="Back of ID card" className="min-h-48" />
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-bold text-slate-900">Certificate validity</h3>
              {doc.verifiedAt ? (
                <form
                  className="mt-3 flex flex-wrap items-end gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    run('validity', () => adminUpdateValidity(userId, validity), 'Validity updated.');
                  }}
                >
                  <div>
                    <label htmlFor="doc-valid-cert" className="block text-xs font-semibold text-slate-700">Certificate valid until</label>
                    <input id="doc-valid-cert" type="date" value={validity.validUntil} onChange={(e) => setValidity((v) => ({ ...v, validUntil: e.target.value }))} className="mt-1 rounded-xl border border-slate-300 p-2 text-sm" />
                  </div>
                  <div>
                    <label htmlFor="doc-valid-card" className="block text-xs font-semibold text-slate-700">ID card valid until</label>
                    <input id="doc-valid-card" type="date" value={validity.idCardValidUntil} onChange={(e) => setValidity((v) => ({ ...v, idCardValidUntil: e.target.value }))} className="mt-1 rounded-xl border border-slate-300 p-2 text-sm" />
                  </div>
                  <Button type="submit" size="sm" variant="outline" disabled={Boolean(busy)}>Save validity</Button>
                </form>
              ) : <p className="mt-1 text-sm text-slate-600">Validity starts when the supplier is approved.</p>}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-bold text-slate-900">Submitted business documents</h3>
              {doc.kycDocuments.length ? (
                <ul className="mt-2 divide-y divide-slate-100">
                  {doc.kycDocuments.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2"><FileText className="size-4 shrink-0 text-slate-400" aria-hidden="true" /><span className="font-medium text-slate-800">{item.docType}</span><span className="truncate text-slate-500">{item.docNumber || item.fileName}</span></span>
                      <span className="flex items-center gap-3"><span className="text-xs text-slate-500">{item.status}</span><a href={item.fileUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-emerald-800 hover:underline">Open</a></span>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-sm text-slate-600">No documents were uploaded.</p>}
            </section>
          </div>
        ) : null}
      </div>
      <ReasonDialog key={dialog?.kind || 'none'} dialog={dialog} busy={Boolean(busy)} onClose={() => setDialog(null)} onConfirm={confirmDialog} />
    </div>
  );
}

function SignatoryPanel() {
  const { showToast } = useNotifications();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || form) return;
    adminGetSignatory().then(setForm).catch((error) => showToast(error.message, 'error'));
  }, [open, form, showToast]);

  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      setForm(await adminUpdateSignatory({
        name: form.name,
        title: form.title,
        signatureDataUrl: form.signatureDataUrl?.startsWith('data:') ? form.signatureDataUrl : undefined,
        removeSignature: !form.signatureDataUrl,
      }));
      showToast('Signatory saved. It now appears on all documents.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const readSignature = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) { showToast('Please use a PNG or JPG signature image.', 'error'); return; }
    if (file.size > 512 * 1024) { showToast('The signature image must be smaller than 512 KB.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, signatureDataUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="flex items-center gap-2 text-sm font-bold text-slate-900"><PenLine className="size-4 text-emerald-700" aria-hidden="true" /> Authorised signatory on documents</span>
        <span className="text-xs font-semibold text-emerald-800">{open ? 'Hide' : 'Edit'}</span>
      </button>
      {open && form ? (
        <form onSubmit={save} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="signatory-name" className="block text-xs font-semibold text-slate-700">Name</label>
            <input id="signatory-name" maxLength={80} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm" />
          </div>
          <div>
            <label htmlFor="signatory-title" className="block text-xs font-semibold text-slate-700">Designation</label>
            <input id="signatory-title" maxLength={80} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-semibold text-slate-700">Signature image (PNG with a transparent background works best)</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              {form.signatureDataUrl ? <img src={form.signatureDataUrl} alt="Signature" className="h-14 rounded-lg border border-slate-200 bg-white object-contain p-1" /> : null}
              <label htmlFor="signatory-image" className="cursor-pointer rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">{form.signatureDataUrl ? 'Replace' : 'Upload'}</label>
              <input id="signatory-image" type="file" accept="image/png,image/jpeg" className="sr-only" onChange={readSignature} />
              {form.signatureDataUrl ? <button type="button" onClick={() => setForm((f) => ({ ...f, signatureDataUrl: '' }))} className="text-xs font-medium text-rose-700 hover:underline">Remove</button> : null}
            </div>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" variant="navy" disabled={saving}>{saving ? 'Saving…' : 'Save signatory'}</Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

export default function SuperAdminSupplierDocuments() {
  useDocumentTitle('Supplier Documents');
  const [state, setState] = useState({ loading: true, error: '', suppliers: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await adminList({ page, status, search });
      setState({ loading: false, error: '', suppliers: data.suppliers, pagination: data.pagination });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error: error.message }));
    }
  }, [page, status, search]);

  useEffect(() => {
    load();
  }, [load]);

  const { suppliers, pagination } = state;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Supplier Documents</h1>
        <p className="mt-1 text-sm text-slate-600">Supplier IDs, certificates, ID cards and QR codes. Open a supplier to review, approve and manage their documents.</p>
      </header>

      <SignatoryPanel />

      <form
        className="flex flex-wrap items-center gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
      >
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input aria-label="Search suppliers" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Business, name, email, Supplier ID or certificate number" className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30" />
        </div>
        <div className="w-44">
          <CustomSelect id="documents-status-filter" value={status} onChange={(val) => { setPage(1); setStatus(typeof val === 'string' ? val : val?.target?.value ?? 'ALL'); }} options={STATUS_FILTERS} searchable={false} />
        </div>
        <Button type="submit" size="sm" variant="navy">Search</Button>
      </form>

      {state.error ? <ErrorState text={state.error} onRetry={load} /> : null}
      {state.loading && !suppliers.length ? <div className="flex justify-center py-16 text-slate-400" role="status" aria-label="Loading"><LoaderCircle className="size-7 animate-spin" aria-hidden="true" /></div> : null}
      {!state.loading && !state.error && !suppliers.length ? <EmptyState icon={QrCode} title="No suppliers found" text="Try a different search or status." /> : null}

      {suppliers.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {suppliers.map((item) => (
            <button key={item.userId} type="button" onClick={() => setSelected(item.userId)} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-600/60 hover:shadow-sm">
              <PhotoThumb userId={item.userId} hasPhoto={item.hasPhoto} className="h-20 w-[3.75rem] shrink-0 rounded-lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-900">{item.company || item.name}</span>
                <span className="block truncate text-xs text-slate-500">{item.name} · {item.email}</span>
                <span className="mt-1 block text-xs font-semibold text-slate-800">{item.supplierId}</span>
                <span className="block text-xs text-slate-600">{item.certificateNumber}</span>
                <span className="mt-1.5 flex flex-wrap items-center gap-2">
                  <VerificationBadge status={item.documentStatus} />
                  {!item.hasPhoto ? <span className="text-[11px] font-medium text-amber-800">No photograph</span> : null}
                  {item.detailsChanged ? <span className="text-[11px] font-medium text-amber-800">Details changed</span> : null}
                </span>
              </span>
              <img src={item.qrCodeDataUrl} alt="" className="hidden size-14 shrink-0 rounded-md border border-slate-200 sm:block" />
            </button>
          ))}
        </div>
      ) : null}

      {pagination.totalPages > 1 ? (
        <nav className="flex items-center justify-center gap-3" aria-label="Pages">
          <Button type="button" size="sm" variant="outline" icon={ChevronLeft} disabled={page <= 1 || state.loading} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm text-slate-600">Page {pagination.page} of {pagination.totalPages}</span>
          <Button type="button" size="sm" variant="outline" icon={ChevronRight} disabled={page >= pagination.totalPages || state.loading} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </nav>
      ) : null}

      {selected ? <DocumentDrawer userId={selected} onClose={() => setSelected(null)} onChanged={load} /> : null}
    </div>
  );
}
