import { useState } from 'react';
import { FileText, Info, Plus, Send, Trash2 } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button, { IconButton } from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import VerificationBadge from '../../components/common/VerificationBadge';
import EmptyState from '../../components/common/EmptyState';
import SupplierGuard from './SupplierGuard';
import useProducts from '../../hooks/useProducts';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { DOCUMENT_TYPES, getVerification } from '../../utils/verification';
import { formatDate } from '../../utils/formatDate';
import makeId from '../../utils/ids';

const EMPTY = { type: DOCUMENT_TYPES[0], reference: '', fileName: '' };

function Verification({ company }) {
  const { submitVerification } = useProducts();
  const { showToast, addNotification } = useNotifications();
  const info = getVerification(company);
  const locked = info.status === 'under-review';
  const [documents, setDocuments] = useState(info.documents ?? []);
  const [draft, setDraft] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  const addDocument = (event) => {
    event.preventDefault();
    const found = {};
    if (draft.reference.trim().length < 3) found.reference = 'Enter the document or registration number (at least 3 characters).';
    if (!draft.fileName) found.fileName = 'Choose the document file.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setDocuments((previous) => [...previous, { id: makeId('TS-DOC'), type: draft.type, reference: draft.reference.trim(), fileName: draft.fileName }]);
    setDraft(EMPTY);
    // Reset the native file input so the same file can be chosen again.
    const input = document.getElementById('doc-file');
    if (input) input.value = '';
  };

  const submit = () => {
    if (!documents.length) {
      showToast('Add at least one document before submitting.', 'error');
      return;
    }
    submitVerification(company.id, documents);
    addNotification({ audience: 'role:admin', type: 'quotes', title: 'Verification request', body: `${company.name} submitted ${documents.length} document(s) for review.`, link: '/admin/verification' });
    showToast('Documents submitted for admin review.');
  };

  return (
    <div className="space-y-6">
      <SectionHeading title="Verification" description="Submit business documents for review by the TradeSphere admin team." />

      <section className="ts-card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6" aria-label="Current status">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Current status</p>
          <div className="mt-2"><VerificationBadge company={company} size="md" /></div>
          <p className="mt-2 text-sm text-muted">{info.description}{info.reviewedAt ? ` Updated ${formatDate(info.reviewedAt)}.` : info.submittedAt ? ` Submitted ${formatDate(info.submittedAt)}.` : ''}</p>
          {info.note ? <p className="mt-2 rounded-lg bg-ivory px-3 py-2 text-sm text-ink"><span className="font-semibold">Admin note: </span>{info.note}</p> : null}
        </div>
      </section>

      <p className="flex gap-2.5 rounded-2xl bg-white p-4 text-[0.8125rem] text-muted ring-1 ring-navy-900/[0.06]">
        <Info className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />
        Files are not uploaded in this version of TradeSphere: only the document type, number and file name are recorded for the admin to review. A “Documents reviewed” badge means a TradeSphere admin reviewed these details; it is not a legal or third-party certification.
      </p>

      <section className="ts-card overflow-hidden" aria-labelledby="documents-title">
        <h2 id="documents-title" className="px-5 pt-5 text-lg font-bold sm:px-6">Business documents</h2>
        {documents.length ? (
          <ul className="mt-3 divide-y divide-navy-900/[0.06] border-t border-navy-900/[0.06]">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-ivory text-brand-600"><FileText className="size-5" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{doc.type}</p>
                  <p className="truncate text-xs text-muted">No. {doc.reference} · {doc.fileName}</p>
                </div>
                {!locked ? <IconButton icon={Trash2} size="sm" tone="danger" label={`Remove ${doc.type}`} onClick={() => setDocuments((previous) => previous.filter((item) => item.id !== doc.id))} /> : null}
              </li>
            ))}
          </ul>
        ) : <EmptyState icon={FileText} className="!py-10" title="No documents yet" text="Add your business registration, tax registration or other documents below." />}

        {!locked ? (
          <form onSubmit={addDocument} noValidate className="grid grid-cols-1 gap-4 border-t border-navy-900/[0.06] bg-ivory/60 p-5 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-end sm:p-6">
            <Select id="doc-type" label="Document type" options={DOCUMENT_TYPES} value={draft.type} onChange={(event) => setDraft((previous) => ({ ...previous, type: event.target.value }))} />
            <Input id="doc-reference" label="Document number" value={draft.reference} onChange={(event) => setDraft((previous) => ({ ...previous, reference: event.target.value }))} error={errors.reference} />
            <div>
              <label htmlFor="doc-file" className="ts-label">File</label>
              <input id="doc-file" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setDraft((previous) => ({ ...previous, fileName: event.target.files?.[0]?.name ?? '' }))} aria-invalid={errors.fileName ? 'true' : undefined} className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-navy-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" />
              {errors.fileName ? <p role="alert" className="mt-1.5 text-[0.8125rem] font-medium text-danger">{errors.fileName}</p> : null}
            </div>
            <Button type="submit" variant="outline" icon={Plus}>Add</Button>
          </form>
        ) : null}
      </section>

      <div className="flex justify-end">
        {locked
          ? <p className="text-sm text-muted">Your documents are waiting for admin review.</p>
          : <Button icon={Send} onClick={submit} disabled={!documents.length}>{info.status === 'not-submitted' ? 'Submit for review' : 'Resubmit for review'}</Button>}
      </div>
    </div>
  );
}

export default function SupplierVerification() {
  useDocumentTitle('Verification');
  return <SupplierGuard>{(company) => <Verification key={`${company.id}-${company.verification?.status}`} company={company} />}</SupplierGuard>;
}
