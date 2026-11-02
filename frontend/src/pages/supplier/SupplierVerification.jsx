import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Building2, CheckCircle2, CircleAlert, ExternalLink, FileText, Info, Landmark, Lock, MapPin, Plus, Save, Send, ShieldCheck, Trash2,
} from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button, { IconButton } from '../../components/common/Button';
import Input, { Field } from '../../components/common/Input';
import Select from '../../components/common/Select';
import CustomSelect from '../../components/common/CustomSelect';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import SupplierGuard from './SupplierGuard';
import useAuth from '../../hooks/useAuth';
import useProducts from '../../hooks/useProducts';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { DOCUMENT_TYPES } from '../../utils/verification';
import { INDIA_STATES, SUPPLIER_BUSINESS_TYPES } from '../../utils/constants';
import { formatDate } from '../../utils/formatDate';
import { photoUrl } from '../../utils/images';
import makeId from '../../utils/ids';
import { authorizedRequest, uploadFile } from '../../services/authorizedApi';

const EMPTY_DOC = { type: DOCUMENT_TYPES[0], reference: '', fileName: '', fileUrl: '' };

const STATUS_META = {
  NOT_SUBMITTED: { label: 'Pending submission', tone: 'bg-slate-50 text-slate-700 border-slate-200', text: 'Your details are saved but have not been submitted for verification yet.' },
  PENDING: { label: 'In review', tone: 'bg-amber-50 text-amber-800 border-amber-200', text: 'Submitted and waiting for review by the TradeExpress team. Details are locked until the review is complete.' },
  VERIFIED: { label: 'Verified', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200', text: 'Your business has been verified by TradeExpress. Verified tax and bank details are locked.' },
  REJECTED: { label: 'Rejected', tone: 'bg-rose-50 text-rose-800 border-rose-200', text: 'Verification was declined. Update your details and documents, then submit again.' },
  RESUBMISSION_REQUESTED: { label: 'Changes requested', tone: 'bg-rose-50 text-rose-800 border-rose-200', text: 'The reviewer asked for changes. Update your details and documents, then submit again.' },
};

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PIN_RE = /^[1-9][0-9]{5}$/;

/** Turns the API response into editable form state (empty string for anything not on file). */
const toForm = (data) => ({ business: { ...data.business }, statutory: { ...data.statutory }, warehouse: { ...data.warehouse } });

function validate(form, { submitting, documentCount }) {
  const errors = {};
  const { business, statutory, warehouse } = form;
  if (submitting && business.companyName.trim().length < 2) errors.companyName = 'Business name is required.';
  if (submitting && business.contactName.trim().length < 2) errors.contactName = 'Contact person name is required.';
  if (statutory.gstin && !GSTIN_RE.test(statutory.gstin.trim())) errors.gstin = 'Enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5).';
  if (statutory.pan && !PAN_RE.test(statutory.pan.trim())) errors.pan = 'Enter a valid 10-character PAN (e.g. ABCDE1234F).';
  if (statutory.bankIfsc && !IFSC_RE.test(statutory.bankIfsc.trim())) errors.bankIfsc = 'Enter a valid 11-character IFSC (e.g. HDFC0001234).';
  if (statutory.bankAccountNumber && !/^\d{9,18}$/.test(statutory.bankAccountNumber.replace(/\s/g, ''))) errors.bankAccountNumber = 'Account number must be 9 to 18 digits.';
  if (warehouse.pincode && !PIN_RE.test(warehouse.pincode.trim())) errors.warehousePincode = 'Enter a valid 6-digit PIN code.';
  if (business.country === 'India' && business.postalCode && !PIN_RE.test(business.postalCode.trim())) errors.postalCode = 'Enter a valid 6-digit PIN code.';
  if (business.yearEstablished) {
    const year = Number(business.yearEstablished);
    if (!Number.isInteger(year) || year < 1800 || year > new Date().getFullYear()) errors.yearEstablished = `Enter a year between 1800 and ${new Date().getFullYear()}.`;
  }
  if (submitting && !statutory.gstin.trim() && documentCount === 0) errors.documents = 'Add your GSTIN or at least one business document before submitting.';
  return errors;
}

function Section({ icon: Icon, title, description, children, id }) {
  return (
    <section className="ts-card space-y-5 p-5 sm:p-6" aria-labelledby={id}>
      <div className="border-b border-navy-900/[0.06] pb-3">
        <div className="flex items-center gap-2">
          <Icon className="size-5 text-brand-600" aria-hidden="true" />
          <h2 id={id} className="text-base font-bold text-ink">{title}</h2>
        </div>
        {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Verification({ company }) {
  const { updateProfile } = useAuth();
  const { submitVerification } = useProducts();
  const { showToast } = useNotifications();

  const [data, setData] = useState(null); // last response from the server
  const [form, setForm] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(null); // 'save' | 'submit' | null
  const [draftDoc, setDraftDoc] = useState(EMPTY_DOC);
  const [uploadingFile, setUploadingFile] = useState(false);
  const inFlight = useRef(false);

  const applyServerData = useCallback((next) => {
    setData(next);
    setForm(toForm(next));
    setDocuments(next.documents);
  }, []);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      applyServerData(await authorizedRequest('GET', 'auth/kyc'));
    } catch (error) {
      setLoadError(error.message);
    }
  }, [applyServerData]);

  useEffect(() => { load(); }, [load]);

  if (loadError) {
    return <div className="ts-card"><ErrorState title="We couldn't load your business details" text={loadError} onRetry={load} /></div>;
  }
  if (!data || !form) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading business details">
        {[0, 1, 2].map((key) => <div key={key} className="ts-card h-40 animate-pulse bg-navy-50/60" />)}
      </div>
    );
  }

  const status = STATUS_META[data.status] ? data.status : 'NOT_SUBMITTED';
  const meta = STATUS_META[status];
  const profileLocked = !data.editable.profile || Boolean(saving);
  const statutoryLocked = !data.editable.statutory || Boolean(saving);

  const setField = (group, field, transform = (v) => v) => (event) => {
    const value = transform(event.target.value);
    setForm((prev) => ({ ...prev, [group]: { ...prev[group], [field]: value } }));
    const key = group === 'warehouse' && field === 'pincode' ? 'warehousePincode' : field;
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
    setFormError('');
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    setErrors((prev) => ({ ...prev, fileName: '' }));
    try {
      const uploaded = await uploadFile(file);
      setDraftDoc((prev) => ({ ...prev, fileName: file.name, fileUrl: uploaded.fileUrl }));
    } catch (error) {
      // Nothing is attached unless the server stored the file
      setDraftDoc((prev) => ({ ...prev, fileName: '', fileUrl: '' }));
      setErrors((prev) => ({ ...prev, fileName: error.message }));
      event.target.value = '';
    } finally {
      setUploadingFile(false);
    }
  };

  const addDocument = (event) => {
    event.preventDefault();
    const found = {};
    if (draftDoc.reference.trim().length < 3) found.reference = 'Enter the document or registration number (at least 3 characters).';
    if (!draftDoc.fileUrl) found.fileName = 'Choose and upload a document file.';
    setErrors((prev) => ({ ...prev, ...found }));
    if (Object.keys(found).length) return;
    // New documents carry a local key only; the server assigns the real id when saved
    setDocuments((prev) => [...prev, { localKey: makeId('DOC'), type: draftDoc.type, reference: draftDoc.reference.trim(), fileName: draftDoc.fileName, fileUrl: draftDoc.fileUrl, status: 'NEW' }]);
    setDraftDoc(EMPTY_DOC);
    setErrors((prev) => ({ ...prev, documents: '' }));
    const input = document.getElementById('doc-file');
    if (input) input.value = '';
  };

  const save = async (submit) => {
    if (inFlight.current) return;
    const found = validate(form, { submitting: submit, documentCount: documents.length });
    setErrors(found);
    if (Object.keys(found).length) {
      setFormError('Please correct the highlighted fields.');
      return;
    }

    inFlight.current = true;
    setSaving(submit ? 'submit' : 'save');
    setFormError('');
    try {
      const next = await authorizedRequest('POST', 'auth/kyc', {
        submit,
        business: form.business,
        statutory: form.statutory,
        warehouse: form.warehouse,
        documents: documents.map((doc) => (doc.id ? { id: doc.id } : { type: doc.type, reference: doc.reference, fileName: doc.fileName, fileUrl: doc.fileUrl })),
      }, { timeoutMs: 30000 });
      applyServerData(next);
      // Keep the signed-in session's display name and company in step with the saved record
      updateProfile({ name: next.business.contactName, company: next.business.companyName });
      if (submit) submitVerification(company.id, next.documents);
      showToast(submit ? 'Submitted for verification. Status: In review.' : 'Business details saved.');
    } catch (error) {
      if (error.fieldErrors && Object.keys(error.fieldErrors).length) setErrors((prev) => ({ ...prev, ...error.fieldErrors }));
      setFormError(error.message);
    } finally {
      inFlight.current = false;
      setSaving(null);
    }
  };

  const { business, statutory, warehouse } = form;
  const isIndia = (business.country || 'India') === 'India';
  const panAadhaar = data.identity;

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Business Verification"
        description="Your details from signup are filled in below. Complete anything missing, then submit for review by TradeExpress."
      />

      <section className="ts-card flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6" aria-label="Verification status">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Verification status</p>
          <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${meta.tone}`}>
            {status === 'VERIFIED' ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : null}{meta.label}
          </span>
          <p className="mt-2 text-sm text-muted">{meta.text}</p>
          {data.rejectionReason && ['REJECTED', 'RESUBMISSION_REQUESTED'].includes(status) ? (
            <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><span className="font-semibold">Reviewer note: </span>{data.rejectionReason}</p>
          ) : null}
        </div>
        {data.supplierCode ? <p className="text-xs text-muted">Supplier ID <span className="font-mono font-semibold text-navy-900">{data.supplierCode}</span></p> : null}
      </section>

      {status !== 'VERIFIED' ? (
        <p className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Information carried over from signup is not verification. Your business is verified only after the TradeExpress team reviews your submission.
        </p>
      ) : null}

      <Section id="business-profile-title" icon={Building2} title="Business profile" description="Taken from your seller signup. Empty fields were not provided at signup.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input id="kyc-company" label="Business name" required value={business.companyName} onChange={setField('business', 'companyName')} disabled={profileLocked} error={errors.companyName} />
          <Input id="kyc-contact" label="Owner / contact person" required value={business.contactName} onChange={setField('business', 'contactName')} disabled={profileLocked} error={errors.contactName} />
          <Input id="kyc-email" label="Business email" value={business.email} disabled icon={Lock} hint="Your sign-in email, confirmed with OTP at signup. Change it from Settings." />
          <Input id="kyc-phone" label="Mobile number" value={business.phone} disabled icon={Lock} hint="Your sign-in mobile, confirmed with OTP at signup." />
          <Select
            id="kyc-business-type" label="Business type"
            options={business.businessType && !SUPPLIER_BUSINESS_TYPES.includes(business.businessType) ? [business.businessType, ...SUPPLIER_BUSINESS_TYPES] : SUPPLIER_BUSINESS_TYPES}
            placeholder="Select business type"
            value={business.businessType} onChange={setField('business', 'businessType')} disabled={profileLocked}
          />
          {business.businessType === 'Other' ? (
            <Input id="kyc-business-type-other" label="Describe your business type" value={business.businessTypeOther} onChange={setField('business', 'businessTypeOther')} disabled={profileLocked} />
          ) : (
            <Input id="kyc-year" label="Year established" inputMode="numeric" maxLength={4} value={business.yearEstablished} onChange={setField('business', 'yearEstablished', (v) => v.replace(/\D/g, ''))} disabled={profileLocked} error={errors.yearEstablished} />
          )}
          <Input id="kyc-address" label="Business address" value={business.businessAddress} onChange={setField('business', 'businessAddress')} disabled={profileLocked} wrapperClassName="sm:col-span-2" />
          <Input id="kyc-city" label="City" value={business.city} onChange={setField('business', 'city')} disabled={profileLocked} />
          {isIndia ? (
            <Field id="kyc-state" label="State">
              <CustomSelect id="kyc-state" value={business.state} onChange={setField('business', 'state')} options={INDIA_STATES} placeholder="Select state" disabled={profileLocked} />
            </Field>
          ) : (
            <Input id="kyc-state" label="State / province" value={business.state} onChange={setField('business', 'state')} disabled={profileLocked} />
          )}
          <Input id="kyc-postal" label={isIndia ? 'PIN code' : 'Postal code'} inputMode={isIndia ? 'numeric' : 'text'} value={business.postalCode} onChange={setField('business', 'postalCode')} disabled={profileLocked} error={errors.postalCode} />
          <Input id="kyc-country" label="Country" value={business.country} disabled icon={Lock} />
          {business.businessType === 'Other' ? (
            <Input id="kyc-year" label="Year established" inputMode="numeric" maxLength={4} value={business.yearEstablished} onChange={setField('business', 'yearEstablished', (v) => v.replace(/\D/g, ''))} disabled={profileLocked} error={errors.yearEstablished} />
          ) : null}
          <Input id="kyc-business-phone" label="Business landline / alternate phone" value={business.businessPhone} onChange={setField('business', 'businessPhone')} disabled={profileLocked} />
          <Input id="kyc-factory" label="Factory address" value={business.factoryAddress} onChange={setField('business', 'factoryAddress')} disabled={profileLocked} wrapperClassName="sm:col-span-2" />
        </div>
      </Section>

      <Section id="statutory-title" icon={ShieldCheck} title="Tax details" description={status === 'VERIFIED' ? 'Verified details are locked. Contact TradeExpress support to change them.' : undefined}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input id="kyc-gstin" label="GSTIN (15 characters)" placeholder="e.g. 27ABCDE1234F1Z5" value={statutory.gstin} onChange={setField('statutory', 'gstin', (v) => v.toUpperCase())} disabled={statutoryLocked} error={errors.gstin} hint={business.gstStatus ? `GST status at signup: ${business.gstStatus}` : undefined} />
          <Input id="kyc-pan" label="PAN (10 characters)" placeholder="e.g. ABCDE1234F" value={statutory.pan} onChange={setField('statutory', 'pan', (v) => v.toUpperCase())} disabled={statutoryLocked} error={errors.pan}
            hint={panAadhaar.panAadhaarLinked ? `Aadhaar (••••${panAadhaar.aadhaarLast4 || ''}) linked with this PAN, confirmed at signup. Changing the PAN clears this check.` : 'PAN–Aadhaar link not verified.'} />
        </div>
      </Section>

      <Section id="bank-title" icon={Landmark} title="Settlement bank account" description="Not collected at signup. Payouts are sent to this account after verification.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input id="kyc-bank-name" label="Bank name" placeholder="e.g. HDFC Bank" value={statutory.bankName} onChange={setField('statutory', 'bankName')} disabled={statutoryLocked} />
          <Input id="kyc-bank-acc" label="Account number" inputMode="numeric" value={statutory.bankAccountNumber} onChange={setField('statutory', 'bankAccountNumber', (v) => v.replace(/[^\d]/g, ''))} disabled={statutoryLocked} error={errors.bankAccountNumber} />
          <Input id="kyc-bank-ifsc" label="IFSC code" placeholder="e.g. HDFC0001234" value={statutory.bankIfsc} onChange={setField('statutory', 'bankIfsc', (v) => v.toUpperCase())} disabled={statutoryLocked} error={errors.bankIfsc} />
        </div>
      </Section>

      <Section id="warehouse-title" icon={MapPin} title="Primary warehouse / dispatch location">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input id="kyc-warehouse-address" label="Street address / industrial area" value={warehouse.address} onChange={setField('warehouse', 'address')} disabled={profileLocked} />
          <Field id="kyc-warehouse-state" label="State (for GST calculation)">
            <CustomSelect id="kyc-warehouse-state" value={warehouse.state} onChange={setField('warehouse', 'state')} options={INDIA_STATES} placeholder="Select state" disabled={profileLocked} />
          </Field>
          <Input id="kyc-warehouse-pincode" label="PIN code" inputMode="numeric" maxLength={6} value={warehouse.pincode} onChange={setField('warehouse', 'pincode', (v) => v.replace(/\D/g, ''))} disabled={profileLocked} error={errors.warehousePincode} />
        </div>
      </Section>

      <section className="ts-card overflow-hidden" aria-labelledby="documents-title">
        <div className="border-b border-navy-900/[0.06] p-5 sm:p-6">
          <h2 id="documents-title" className="text-base font-bold text-ink">Supporting business documents</h2>
          <p className="mt-1 text-xs text-muted">GST certificate, registration certificate, cancelled cheque or IEC. Documents uploaded at signup appear here.</p>
        </div>
        {documents.length ? (
          <ul className="divide-y divide-navy-900/[0.06]">
            {documents.map((doc) => (
              <li key={doc.id || doc.localKey} className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-ivory text-brand-600"><FileText className="size-5" aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{doc.type}</p>
                    <p className="truncate text-xs text-muted">{doc.reference ? `No. ${doc.reference} · ` : ''}{doc.fileName}{doc.createdAt ? ` · ${formatDate(doc.createdAt)}` : ''}{doc.status === 'NEW' ? ' · not saved yet' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {doc.fileUrl ? (
                    <a href={photoUrl(doc.fileUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-navy-900/[0.1] px-2.5 py-1 text-xs font-medium text-brand-600 hover:bg-slate-50">
                      <ExternalLink className="size-3.5" aria-hidden="true" />View
                    </a>
                  ) : null}
                  {!profileLocked && doc.status !== 'APPROVED' ? (
                    <IconButton icon={Trash2} size="sm" tone="danger" label={`Remove ${doc.type}`} onClick={() => setDocuments((prev) => prev.filter((item) => item !== doc))} />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={FileText} className="!py-8" title="No documents attached yet" text="Add your GST certificate, PAN card copy or business registration certificate below." />
        )}

        {!profileLocked ? (
          <form onSubmit={addDocument} noValidate className="grid grid-cols-1 gap-4 border-t border-navy-900/[0.06] bg-ivory/60 p-5 sm:grid-cols-[1.2fr_1fr_1.2fr_auto] sm:items-end sm:p-6">
            <Select id="doc-type" label="Document type" options={DOCUMENT_TYPES} value={draftDoc.type} onChange={(e) => setDraftDoc((prev) => ({ ...prev, type: e.target.value }))} />
            <Input id="doc-reference" label="Document number" placeholder="e.g. Certificate No." value={draftDoc.reference} onChange={(e) => setDraftDoc((prev) => ({ ...prev, reference: e.target.value }))} error={errors.reference} />
            <div>
              <label htmlFor="doc-file" className="ts-label">Upload file (PDF, JPG, PNG)</label>
              <input id="doc-file" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} disabled={uploadingFile}
                className="block w-full text-xs text-muted file:mr-2 file:rounded-md file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white" />
              {uploadingFile ? <p className="mt-1 text-xs text-brand-600">Uploading…</p> : null}
              {draftDoc.fileUrl ? <p className="mt-1 truncate text-xs font-medium text-emerald-600">Uploaded: {draftDoc.fileName}</p> : null}
              {errors.fileName ? <p role="alert" className="mt-1 text-[0.8125rem] font-medium text-danger">{errors.fileName}</p> : null}
            </div>
            <Button type="submit" variant="outline" icon={Plus} disabled={uploadingFile}>Add</Button>
          </form>
        ) : null}
      </section>

      {errors.documents ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.documents}</p> : null}
      {formError ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{formError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {status === 'PENDING' ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">Your submission is in review. Details can be changed once the review is complete.</p>
        ) : (
          <>
            <Button variant="outline" icon={Save} onClick={() => save(false)} loading={saving === 'save'} disabled={Boolean(saving) || uploadingFile}>
              {saving === 'save' ? 'Saving…' : 'Save details'}
            </Button>
            {data.editable.canSubmit ? (
              <Button icon={Send} size="lg" onClick={() => save(true)} loading={saving === 'submit'} disabled={Boolean(saving) || uploadingFile}>
                {saving === 'submit' ? 'Submitting…' : status === 'NOT_SUBMITTED' ? 'Submit for verification' : 'Resubmit for verification'}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export default function SupplierVerification() {
  useDocumentTitle('Business verification');
  return <SupplierGuard>{(company) => <Verification key={company.id} company={company} />}</SupplierGuard>;
}
