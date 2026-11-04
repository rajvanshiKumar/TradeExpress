import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Download, ExternalLink, FileBadge2, IdCard, LoaderCircle, QrCode, ShieldCheck } from 'lucide-react';
import Button from '../../components/common/Button';
import CustomSelect from '../../components/common/CustomSelect';
import ErrorState from '../../components/common/ErrorState';
import { PageSkeleton } from '../../components/common/Skeleton';
import { DocumentImage, ProfilePhotoField, VerificationBadge } from '../../components/suppliers/SupplierDocumentParts';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import useNotifications from '../../hooks/useNotifications';
import {
  getMyDocuments, myCertificatePdf, myIdCardPdf, myPhoto, myPreview, updateMyDetails, updateMyPhoto, updateMyPrivacy,
} from '../../services/supplierDocumentApi';
import { formatDate } from '../../utils/formatDate';
import { saveBlob } from '../../utils/profilePhoto';

const STATUS_NOTICE = {
  PENDING: { title: 'Your documents are not verified yet', text: 'They show PENDING and are not proof of verification. Once TradeExpress approves your business documents, they update to VERIFIED automatically.', className: 'border-amber-200 bg-amber-50 text-amber-900' },
  REJECTED: { title: 'Your verification was rejected', text: 'These documents are not valid. Please review your submission under Business Verification.', className: 'border-rose-200 bg-rose-50 text-rose-900' },
  SUSPENDED: { title: 'Your account is suspended', text: 'These documents are not valid while your account is suspended. Please contact TradeExpress support.', className: 'border-slate-300 bg-slate-100 text-slate-800' },
  EXPIRED: { title: 'Your certificate has expired', text: 'Please contact TradeExpress support to renew it.', className: 'border-orange-200 bg-orange-50 text-orange-900' },
};

const Row = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
    <dt className="text-xs text-slate-500">{label}</dt>
    <dd className="text-right text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">{value}</dd>
  </div>
);

function DownloadButton({ label, download, disabled }) {
  const { showToast } = useNotifications();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { blob, fileName } = await download();
      saveBlob(blob, fileName);
    } catch (error) {
      showToast(error.message || 'The document could not be downloaded.', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button type="button" variant="navy" full onClick={run} disabled={busy || disabled} icon={busy ? LoaderCircle : Download}>
      {busy ? 'Preparing PDF…' : label}
    </Button>
  );
}

const PRIVACY_OPTIONS = [
  { key: 'showBusinessAddress', label: 'Full business address', hint: 'Otherwise only your city, state and country are shown.' },
  { key: 'showBusinessPhone', label: 'Business phone number', hint: 'Shown only if you added one to your profile.' },
  { key: 'showBusinessEmail', label: 'Business email address', hint: 'Buyers can always reach you with Contact Supplier.' },
];

export default function SupplierDocuments() {
  useDocumentTitle('My TradeExpress Documents');
  const { showToast } = useNotifications();
  const [doc, setDoc] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [previewKey, setPreviewKey] = useState(0);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [details, setDetails] = useState({ legalStructure: '', registrationNumber: '' });
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);

  const apply = useCallback((data) => {
    setDoc(data);
    setDetails({ legalStructure: data.legalStructure || '', registrationNumber: data.registrationNumber || '' });
    setPreviewKey((n) => n + 1);
  }, []);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      apply(await getMyDocuments());
    } catch (error) {
      setLoadError(error.message || 'Your documents could not be loaded.');
    }
  }, [apply]);

  useEffect(() => {
    load();
  }, [load]);

  // Shows the saved photograph, which needs a signed-in request
  const hasPhoto = Boolean(doc?.hasPhoto);
  useEffect(() => {
    if (!hasPhoto) return undefined;
    let active = true;
    myPhoto()
      .then(({ blob }) => {
        const reader = new FileReader();
        reader.onload = () => { if (active) setPhotoPreview(String(reader.result)); };
        reader.readAsDataURL(blob);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [hasPhoto]);

  const savePhoto = async (photo) => {
    setPhotoPreview(photo);
    setPhotoBusy(true);
    setPhotoError('');
    try {
      apply(await updateMyPhoto(photo));
      showToast('Profile photograph saved.', 'success');
    } catch (error) {
      setPhotoError(error.message);
      load();
    } finally {
      setPhotoBusy(false);
    }
  };

  const saveDetails = async (event) => {
    event.preventDefault();
    if (detailsBusy) return;
    setDetailsBusy(true);
    try {
      apply(await updateMyDetails(details));
      showToast('Business details saved.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setDetailsBusy(false);
    }
  };

  const togglePrivacy = async (key) => {
    if (privacyBusy) return;
    setPrivacyBusy(true);
    try {
      setDoc(await updateMyPrivacy({ ...doc.privacy, [key]: !doc.privacy[key] }));
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setPrivacyBusy(false);
    }
  };

  if (loadError) return <div className="ts-card"><ErrorState text={loadError} onRetry={load} /></div>;
  if (!doc) return <PageSkeleton />;

  const notice = STATUS_NOTICE[doc.documentStatus];
  const printable = doc.missingDetails.length === 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">My TradeExpress Documents</h1>
          <p className="mt-1 text-sm text-slate-600">Your Registration Certificate and Supplier ID Card. Download them at any time.</p>
        </div>
        <VerificationBadge status={doc.documentStatus} className="text-sm" />
      </header>

      {notice ? (
        <div className={`flex items-start gap-3 rounded-2xl border p-4 ${notice.className}`} role="status">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold">{notice.title}</p>
            <p className="mt-0.5 text-sm">{notice.text}</p>
            {doc.documentStatus === 'REJECTED' && doc.rejectionReason ? <p className="mt-1 text-sm font-medium">Reason: {doc.rejectionReason}</p> : null}
          </div>
        </div>
      ) : null}

      {!printable ? (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900" role="alert">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p className="text-sm">Please add these details to your Company Profile so your documents can be generated: <strong>{doc.missingDetails.join(', ')}</strong>.</p>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="certificate-heading" className="ts-card flex flex-col p-4 sm:p-5">
          <h2 id="certificate-heading" className="flex items-center gap-2 text-base font-bold text-navy-900">
            <FileBadge2 className="size-5 text-emerald-700" aria-hidden="true" /> Supplier Registration Certificate
          </h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            {printable
              ? <DocumentImage load={() => myPreview('certificate').then((r) => r.blob)} loadKey={previewKey} alt="Your Registration Certificate" className="min-h-48" />
              : <div className="flex min-h-48 items-center justify-center bg-slate-50 p-4 text-center text-sm text-slate-500">Available once your details are complete.</div>}
          </div>
          <dl className="mt-3 flex-1">
            <Row label="Certificate Number" value={doc.certificateNumber} />
            <Row label="Supplier ID" value={doc.supplierId} />
            <Row label="Verification Status" value={<VerificationBadge status={doc.documentStatus} />} />
            <Row label="Issue Date" value={formatDate(doc.issueDate)} />
            <Row label="Valid Until" value={doc.validUntil ? formatDate(doc.validUntil) : 'Set once verified'} />
          </dl>
          <div className="mt-4">
            <DownloadButton label="Download Registration Certificate" download={myCertificatePdf} disabled={!printable} />
          </div>
        </section>

        <section aria-labelledby="id-card-heading" className="ts-card flex flex-col p-4 sm:p-5">
          <h2 id="id-card-heading" className="flex items-center gap-2 text-base font-bold text-navy-900">
            <IdCard className="size-5 text-emerald-700" aria-hidden="true" /> Supplier Digital ID Card
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-slate-100 p-3">
            {printable ? (
              <>
                <DocumentImage load={() => myPreview('id-card-front').then((r) => r.blob)} loadKey={previewKey} alt="Front of your Supplier ID Card" className="min-h-48" />
                <DocumentImage load={() => myPreview('id-card-back').then((r) => r.blob)} loadKey={previewKey} alt="Back of your Supplier ID Card" className="min-h-48" />
              </>
            ) : <div className="col-span-2 flex min-h-48 items-center justify-center p-4 text-center text-sm text-slate-500">Available once your details are complete.</div>}
          </div>
          <dl className="mt-3 flex-1">
            <Row label="Supplier Name" value={doc.details.supplierName || 'Not provided'} />
            <Row label="Supplier ID" value={doc.supplierId} />
            <Row label="Verification Status" value={<VerificationBadge status={doc.documentStatus} />} />
            <Row label="Valid Until" value={doc.idCardValidUntil ? formatDate(doc.idCardValidUntil) : 'Set once verified'} />
          </dl>
          {!doc.hasPhoto ? (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-900" role="alert">
              Your ID card needs your photograph. Please upload it below to download the card.
            </p>
          ) : null}
          <div className="mt-4">
            <DownloadButton label="Download Supplier ID Card" download={myIdCardPdf} disabled={!printable || !doc.hasPhoto} />
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="qr-heading" className="ts-card p-4 sm:p-5">
          <h2 id="qr-heading" className="flex items-center gap-2 text-base font-bold text-navy-900">
            <QrCode className="size-5 text-emerald-700" aria-hidden="true" /> Your QR code and public profile
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <img src={doc.qrCodeDataUrl} alt={`QR code for ${doc.supplierId}`} className="size-32 rounded-xl border border-slate-200" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-600">Anyone who scans this code opens your public profile. It stays the same as your products change.</p>
              <a href={`/supplier/${doc.supplierId}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800 hover:underline">
                View public profile <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
          <fieldset className="mt-4 border-t border-slate-100 pt-3">
            <legend className="pt-3 text-sm font-bold text-navy-900">Show on your public profile</legend>
            <div className="mt-2 space-y-2">
              {PRIVACY_OPTIONS.map((option) => (
                <label key={option.key} className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 rounded border-slate-300 accent-emerald-700"
                    checked={Boolean(doc.privacy[option.key])}
                    disabled={privacyBusy}
                    onChange={() => togglePrivacy(option.key)}
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-800">{option.label}</span>
                    <span className="block text-xs text-slate-500">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section aria-labelledby="details-heading" className="ts-card space-y-5 p-4 sm:p-5">
          <h2 id="details-heading" className="flex items-center gap-2 text-base font-bold text-navy-900">
            <ShieldCheck className="size-5 text-emerald-700" aria-hidden="true" /> Details on your documents
          </h2>
          {!doc.verifiedAt || !doc.hasPhoto ? (
            <ProfilePhotoField
              id="documents-photo"
              value={photoPreview}
              onSelect={savePhoto}
              saving={photoBusy}
              error={photoError}
              required={!doc.hasPhoto}
            />
          ) : (
            <p className="text-sm text-slate-600">Your photograph and details are locked because your documents are verified. To change them, please contact TradeExpress support.</p>
          )}

          {doc.canEditDetails ? (
            <form onSubmit={saveDetails} className="space-y-3 border-t border-slate-100 pt-4">
              <div>
                <label htmlFor="documents-legal-structure" className="mb-1 block text-xs font-semibold text-slate-700">Business Type <span className="text-red-500">*</span></label>
                <CustomSelect
                  id="documents-legal-structure"
                  value={details.legalStructure}
                  onChange={(val) => setDetails((d) => ({ ...d, legalStructure: typeof val === 'string' ? val : val?.target?.value ?? '' }))}
                  options={doc.legalStructures}
                  placeholder="Select business type"
                  searchable={false}
                />
              </div>
              <div>
                <label htmlFor="documents-registration" className="mb-1 block text-xs font-semibold text-slate-700">Business Registration Number (if applicable)</label>
                <input
                  id="documents-registration"
                  type="text"
                  maxLength={64}
                  value={details.registrationNumber}
                  onChange={(e) => setDetails((d) => ({ ...d, registrationNumber: e.target.value.toUpperCase() }))}
                  placeholder="e.g. UDYAM-UP-12-3456789"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                />
              </div>
              <Button type="submit" variant="outline" size="sm" disabled={detailsBusy || !details.legalStructure}>
                {detailsBusy ? 'Saving…' : 'Save details'}
              </Button>
            </form>
          ) : null}
        </section>
      </div>
    </div>
  );
}
