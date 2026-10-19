import { useState, useEffect } from 'react';
import { FileText, Info, Plus, Send, Trash2, ExternalLink, Building2, Landmark, MapPin } from 'lucide-react';
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
import { apiGet, apiPost } from '../../services/apiClient';

const EMPTY_DOC = { type: DOCUMENT_TYPES[0], reference: '', fileName: '', fileUrl: '' };

function Verification({ company }) {
  const { submitVerification } = useProducts();
  const { showToast, addNotification } = useNotifications();
  const initialInfo = getVerification(company);

  const [kycData, setKycData] = useState({
    gstin: company.gstin || '',
    pan: company.pan || '',
    bankAccountNumber: company.bankAccountNumber || '',
    bankIfsc: company.bankIfsc || '',
    bankName: company.bankName || '',
    warehouseAddress: company.warehouseAddress || '',
    warehouseState: company.warehouseState || 'Maharashtra',
    warehousePincode: company.warehousePincode || '',
    kycStatus: company.kycStatus || initialInfo.status,
    kycRejectionReason: company.kycRejectionReason || initialInfo.note || '',
  });

  const [documents, setDocuments] = useState(initialInfo.documents ?? []);
  const [draftDoc, setDraftDoc] = useState(EMPTY_DOC);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const locked = kycData.kycStatus === 'under-review' || kycData.kycStatus === 'PENDING';

  // Fetch latest KYC from backend MySQL
  useEffect(() => {
    let active = true;
    apiGet('auth/kyc')
      .then((res) => {
        if (!active || !res?.data) return;
        const d = res.data;
        setKycData((prev) => ({
          ...prev,
          gstin: d.gstin || prev.gstin,
          pan: d.pan || prev.pan,
          bankAccountNumber: d.bankAccountNumber || prev.bankAccountNumber,
          bankIfsc: d.bankIfsc || prev.bankIfsc,
          bankName: d.bankName || prev.bankName,
          warehouseAddress: d.warehouseAddress || prev.warehouseAddress,
          warehouseState: d.warehouseState || prev.warehouseState,
          warehousePincode: d.warehousePincode || prev.warehousePincode,
          kycStatus: d.kycStatus ? d.kycStatus.toLowerCase().replace('_', '-') : prev.kycStatus,
          kycRejectionReason: d.kycRejectionReason || prev.kycRejectionReason,
        }));
        if (Array.isArray(d.documents) && d.documents.length) {
          setDocuments(
            d.documents.map((doc) => ({
              id: doc.id,
              type: doc.type,
              reference: doc.documentNumber,
              fileName: doc.fileName || doc.documentNumber,
              fileUrl: doc.fileUrl,
            }))
          );
        }
      })
      .catch(() => {
        // Fall back to context data
      });
    return () => { active = false; };
  }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setErrors((prev) => ({ ...prev, fileName: '' }));

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiPost('upload', formData);
      const fileUrl = res?.data?.url || (res?.url ?? '');
      setDraftDoc((prev) => ({
        ...prev,
        fileName: file.name,
        fileUrl,
      }));
    } catch {
      // In case offline, record filename locally
      setDraftDoc((prev) => ({
        ...prev,
        fileName: file.name,
        fileUrl: '',
      }));
    } finally {
      setUploadingFile(false);
    }
  };

  const addDocument = (event) => {
    event.preventDefault();
    const found = {};
    if (draftDoc.reference.trim().length < 3) found.reference = 'Enter the document or registration number (at least 3 characters).';
    if (!draftDoc.fileName) found.fileName = 'Choose a document file.';
    setErrors(found);
    if (Object.keys(found).length) return;

    setDocuments((previous) => [
      ...previous,
      {
        id: makeId('TS-DOC'),
        type: draftDoc.type,
        reference: draftDoc.reference.trim(),
        fileName: draftDoc.fileName,
        fileUrl: draftDoc.fileUrl,
      },
    ]);
    setDraftDoc(EMPTY_DOC);
    const input = document.getElementById('doc-file');
    if (input) input.value = '';
  };

  const submit = async () => {
    const errs = {};
    const gstinClean = kycData.gstin.trim().toUpperCase();
    const panClean = kycData.pan.trim().toUpperCase();

    if (gstinClean && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstinClean)) {
      errs.gstin = 'Invalid GSTIN format (e.g. 27ABCDE1234F1Z5).';
    }
    if (panClean && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panClean)) {
      errs.pan = 'Invalid PAN format (e.g. ABCDE1234F).';
    }
    if (!documents.length && !gstinClean) {
      errs.docs = 'Provide GSTIN or add at least one business document.';
    }

    if (Object.keys(errs).length) {
      setErrors(errs);
      showToast('Please correct the validation errors in the form.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await apiPost('auth/kyc', {
        gstin: gstinClean,
        pan: panClean,
        bankAccountNumber: kycData.bankAccountNumber.trim(),
        bankIfsc: kycData.bankIfsc.trim().toUpperCase(),
        bankName: kycData.bankName.trim(),
        warehouseAddress: kycData.warehouseAddress.trim(),
        warehouseState: kycData.warehouseState.trim(),
        warehousePincode: kycData.warehousePincode.trim(),
        documents: documents.map((doc) => ({
          type: doc.type,
          documentNumber: doc.reference,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
        })),
      });

      setKycData((prev) => ({ ...prev, kycStatus: 'under-review' }));
      submitVerification(company.id, documents);
      addNotification({
        audience: 'role:admin',
        type: 'quotes',
        title: 'KYC & Verification Request',
        body: `${company.name} submitted KYC details and ${documents.length} document(s) for review.`,
        link: '/admin/verification',
      });
      showToast('KYC and business documents submitted for admin review.');
    } catch (err) {
      // Fallback
      submitVerification(company.id, documents);
      setKycData((prev) => ({ ...prev, kycStatus: 'under-review' }));
      showToast('Verification submitted for admin review.');
    } finally {
      setSubmitting(false);
    }
  };

  const statusTone =
    kycData.kycStatus === 'reviewed' || kycData.kycStatus === 'approved' || company.isVerified
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : kycData.kycStatus === 'under-review' || kycData.kycStatus === 'pending'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : kycData.kycStatus === 'rejected'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : 'bg-slate-50 text-slate-700 border-slate-200';

  const statusLabel =
    kycData.kycStatus === 'reviewed' || kycData.kycStatus === 'approved' || company.isVerified
      ? 'Verified'
      : kycData.kycStatus === 'under-review' || kycData.kycStatus === 'pending'
      ? 'Under Review'
      : kycData.kycStatus === 'rejected'
      ? 'Verification Declined'
      : 'Not Submitted';

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Supplier Verification & KYC"
        description="Submit GSTIN, PAN, Bank, Warehouse location, and business documents for review by TradeSphere admin."
      />

      <section className="ts-card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6" aria-label="Current status">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Current status</p>
          <div className="mt-2 flex items-center gap-3">
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusTone}`}>
              {statusLabel}
            </span>
            <VerificationBadge company={company} size="md" />
          </div>
          <p className="mt-2 text-sm text-muted">
            {initialInfo.description}
            {initialInfo.reviewedAt ? ` Updated ${formatDate(initialInfo.reviewedAt)}.` : initialInfo.submittedAt ? ` Submitted ${formatDate(initialInfo.submittedAt)}.` : ''}
          </p>
          {kycData.kycRejectionReason ? (
            <p className="mt-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800 border border-rose-200">
              <span className="font-semibold">Rejection reason: </span>
              {kycData.kycRejectionReason}
            </p>
          ) : null}
        </div>
      </section>

      {/* Statutory Details Form */}
      <section className="ts-card p-5 sm:p-6 space-y-5" aria-labelledby="statutory-title">
        <div className="flex items-center gap-2 border-b border-navy-900/[0.06] pb-3">
          <Building2 className="size-5 text-brand-600" />
          <h2 id="statutory-title" className="text-base font-bold text-ink">Statutory & Tax Details</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="kyc-gstin"
            label="GSTIN (15 characters)"
            placeholder="e.g. 27ABCDE1234F1Z5"
            disabled={locked}
            value={kycData.gstin}
            onChange={(e) => {
              setKycData((prev) => ({ ...prev, gstin: e.target.value.toUpperCase() }));
              setErrors((prev) => ({ ...prev, gstin: '' }));
            }}
            error={errors.gstin}
          />
          <Input
            id="kyc-pan"
            label="PAN Number (10 characters)"
            placeholder="e.g. ABCDE1234F"
            disabled={locked}
            value={kycData.pan}
            onChange={(e) => {
              setKycData((prev) => ({ ...prev, pan: e.target.value.toUpperCase() }));
              setErrors((prev) => ({ ...prev, pan: '' }));
            }}
            error={errors.pan}
          />
        </div>
      </section>

      {/* Bank Account Details */}
      <section className="ts-card p-5 sm:p-6 space-y-5" aria-labelledby="bank-title">
        <div className="flex items-center gap-2 border-b border-navy-900/[0.06] pb-3">
          <Landmark className="size-5 text-brand-600" />
          <h2 id="bank-title" className="text-base font-bold text-ink">Settlement Bank Account</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            id="kyc-bank-name"
            label="Bank Name"
            placeholder="e.g. HDFC Bank"
            disabled={locked}
            value={kycData.bankName}
            onChange={(e) => setKycData((prev) => ({ ...prev, bankName: e.target.value }))}
          />
          <Input
            id="kyc-bank-acc"
            label="Account Number"
            placeholder="e.g. 50100234567890"
            disabled={locked}
            value={kycData.bankAccountNumber}
            onChange={(e) => setKycData((prev) => ({ ...prev, bankAccountNumber: e.target.value }))}
          />
          <Input
            id="kyc-bank-ifsc"
            label="IFSC Code"
            placeholder="e.g. HDFC0001234"
            disabled={locked}
            value={kycData.bankIfsc}
            onChange={(e) => setKycData((prev) => ({ ...prev, bankIfsc: e.target.value.toUpperCase() }))}
          />
        </div>
      </section>

      {/* Warehouse Dispatch Location */}
      <section className="ts-card p-5 sm:p-6 space-y-5" aria-labelledby="warehouse-title">
        <div className="flex items-center gap-2 border-b border-navy-900/[0.06] pb-3">
          <MapPin className="size-5 text-brand-600" />
          <h2 id="warehouse-title" className="text-base font-bold text-ink">Primary Warehouse / Dispatch Location</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <Input
              id="kyc-warehouse-address"
              label="Street Address / Industrial Area"
              placeholder="Plot No. 42, MIDC Phase II"
              disabled={locked}
              value={kycData.warehouseAddress}
              onChange={(e) => setKycData((prev) => ({ ...prev, warehouseAddress: e.target.value }))}
            />
          </div>
          <div>
            <Input
              id="kyc-warehouse-state"
              label="State (for GST calculation)"
              placeholder="e.g. Maharashtra"
              disabled={locked}
              value={kycData.warehouseState}
              onChange={(e) => setKycData((prev) => ({ ...prev, warehouseState: e.target.value }))}
            />
          </div>
          <div>
            <Input
              id="kyc-warehouse-pincode"
              label="Pincode"
              placeholder="e.g. 400001"
              disabled={locked}
              value={kycData.warehousePincode}
              onChange={(e) => setKycData((prev) => ({ ...prev, warehousePincode: e.target.value }))}
            />
          </div>
        </div>
      </section>

      {/* Uploaded Documents List */}
      <section className="ts-card overflow-hidden" aria-labelledby="documents-title">
        <div className="p-5 sm:p-6 border-b border-navy-900/[0.06]">
          <h2 id="documents-title" className="text-base font-bold text-ink">Supporting Business Documents</h2>
          <p className="mt-1 text-xs text-muted">Upload registration certificates, GST certificates, cancelled cheque, or IEC certificate.</p>
        </div>

        {documents.length ? (
          <ul className="divide-y divide-navy-900/[0.06]">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-ivory text-brand-600">
                    <FileText className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{doc.type}</p>
                    <p className="truncate text-xs text-muted">No. {doc.reference} · {doc.fileName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {doc.fileUrl ? (
                    <a
                      href={doc.fileUrl.startsWith('http') ? doc.fileUrl : `http://localhost:5000${doc.fileUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-navy-900/[0.1] px-2.5 py-1 text-xs font-medium text-brand-600 hover:bg-slate-50"
                    >
                      <ExternalLink className="size-3.5" />
                      View
                    </a>
                  ) : null}
                  {!locked ? (
                    <IconButton
                      icon={Trash2}
                      size="sm"
                      tone="danger"
                      label={`Remove ${doc.type}`}
                      onClick={() => setDocuments((previous) => previous.filter((item) => item.id !== doc.id))}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={FileText}
            className="!py-8"
            title="No documents attached yet"
            text="Add your GST certificate, PAN card copy, or business registration certificate below."
          />
        )}

        {!locked ? (
          <form
            onSubmit={addDocument}
            noValidate
            className="grid grid-cols-1 gap-4 border-t border-navy-900/[0.06] bg-ivory/60 p-5 sm:grid-cols-[1.2fr_1fr_1.2fr_auto] sm:items-end sm:p-6"
          >
            <Select
              id="doc-type"
              label="Document type"
              options={DOCUMENT_TYPES}
              value={draftDoc.type}
              onChange={(event) => setDraftDoc((previous) => ({ ...previous, type: event.target.value }))}
            />
            <Input
              id="doc-reference"
              label="Document number"
              placeholder="e.g. Certificate No."
              value={draftDoc.reference}
              onChange={(event) => setDraftDoc((previous) => ({ ...previous, reference: event.target.value }))}
              error={errors.reference}
            />
            <div>
              <label htmlFor="doc-file" className="ts-label">
                Upload File (PDF, JPG, PNG)
              </label>
              <input
                id="doc-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
                disabled={uploadingFile}
                className="block w-full text-xs text-muted file:mr-2 file:rounded-md file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
              />
              {uploadingFile ? <p className="mt-1 text-xs text-brand-600">Uploading to server...</p> : null}
              {draftDoc.fileName ? (
                <p className="mt-1 text-xs text-emerald-600 font-medium truncate">Selected: {draftDoc.fileName}</p>
              ) : null}
              {errors.fileName ? (
                <p role="alert" className="mt-1 text-[0.8125rem] font-medium text-danger">
                  {errors.fileName}
                </p>
              ) : null}
            </div>
            <Button type="submit" variant="outline" icon={Plus} disabled={uploadingFile}>
              Add
            </Button>
          </form>
        ) : null}
      </section>

      {errors.docs && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {errors.docs}
        </div>
      )}

      <div className="flex justify-end">
        {locked ? (
          <p className="text-sm font-medium text-amber-700 bg-amber-50 px-4 py-2 rounded-xl border border-amber-200">
            Your verification request is currently under review by TradeSphere administrators.
          </p>
        ) : (
          <Button icon={Send} onClick={submit} disabled={submitting || uploadingFile} size="lg">
            {submitting ? 'Submitting...' : kycData.kycStatus === 'not-submitted' ? 'Submit KYC for Review' : 'Resubmit KYC for Review'}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function SupplierVerification() {
  useDocumentTitle('Verification');
  return (
    <SupplierGuard>
      {(company) => <Verification key={`${company.id}-${company.verification?.status}`} company={company} />}
    </SupplierGuard>
  );
}

