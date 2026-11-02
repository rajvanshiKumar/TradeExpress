import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, FileText, ShieldCheck, X, ExternalLink, Building2, Landmark, MapPin } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Tabs, { TabPanel } from '../../components/common/Tabs';
import Modal from '../../components/common/Modal';
import { Textarea } from '../../components/common/Input';
import CompanyLogo from '../../components/common/CompanyLogo';
import VerificationBadge from '../../components/common/VerificationBadge';
import EmptyState from '../../components/common/EmptyState';
import { TableSkeleton } from '../../components/common/Skeleton';
import useProducts from '../../hooks/useProducts';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { getVerification } from '../../utils/verification';
import { formatDate } from '../../utils/formatDate';
import { apiGet, apiPost } from '../../services/apiClient';

const TABS = [
  { id: 'under-review', label: 'Pending review' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'rejected', label: 'Declined' },
  { id: 'not-submitted', label: 'Not submitted' },
];

export default function AdminVerification() {
  const { companies, loading, reviewVerification } = useProducts();
  const { showToast, addNotification } = useNotifications();
  const [tab, setTab] = useState('under-review');
  const [deciding, setDeciding] = useState(null); // { company, decision }
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [backendKycList, setBackendKycList] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  useDocumentTitle('Admin: verification');

  const fetchKyc = () => {
    apiGet('admin/kyc')
      .then((res) => {
        if (res.data && Array.isArray(res.data)) {
          setBackendKycList(res.data);
        }
      })
      .catch(() => {
        // Fall back to context companies
      });
  };

  useEffect(() => {
    fetchKyc();
  }, []);

  const mergedCompanies = useMemo(() => {
    return companies.map((comp) => {
      const match = backendKycList.find((k) => k.id === comp.id || k.email === comp.contact?.email || k.companyName === comp.name);
      if (match) {
        return {
          ...comp,
          backendUserId: match.id,
          gstin: match.gstin || comp.gstin,
          pan: match.pan || comp.pan,
          bankAccountNumber: match.bankAccountNumber || comp.bankAccountNumber,
          bankIfsc: match.bankIfsc || comp.bankIfsc,
          bankName: match.bankName || comp.bankName,
          warehouseAddress: match.warehouseAddress || comp.warehouseAddress,
          warehouseState: match.warehouseState || comp.warehouseState,
          verification: {
            ...comp.verification,
            status: match.kycStatus === 'APPROVED' ? 'reviewed' : match.kycStatus === 'REJECTED' ? 'rejected' : match.kycStatus === 'PENDING' ? 'under-review' : comp.verification?.status,
            note: match.kycRejectionReason || comp.verification?.note,
            documents: match.kycDocuments?.map((d) => ({
              id: d.id,
              type: d.type,
              reference: d.documentNumber,
              fileName: d.fileName || d.documentNumber,
              fileUrl: d.fileUrl,
            })) || comp.verification?.documents,
          },
        };
      }
      return comp;
    });
  }, [companies, backendKycList]);

  const groups = useMemo(() => Object.fromEntries(TABS.map((item) => [item.id, mergedCompanies.filter((company) => getVerification(company).status === item.id)])), [mergedCompanies]);

  const confirm = async () => {
    if (deciding.decision === 'decline' && note.trim().length < 5) {
      setNoteError('Tell the supplier what to change (at least 5 characters).');
      return;
    }

    setActionLoading(true);
    const decisionKey = deciding.decision === 'approve' ? 'approve' : 'reject';
    const targetId = deciding.company.backendUserId || deciding.company.id;

    try {
      await apiPost(`admin/kyc/${targetId}/review`, {
        decision: decisionKey,
        rejectionReason: note.trim(),
      });
    } catch {
      // Local fallback
    }

    reviewVerification(deciding.company.id, deciding.decision === 'approve' ? 'approve' : 'decline', note.trim());
    addNotification({
      audience: `company:${deciding.company.id}`,
      type: 'quotes',
      title: deciding.decision === 'approve' ? 'KYC Verified' : 'KYC Verification Declined',
      body: deciding.decision === 'approve' ? 'A TradeExpress admin reviewed and approved your business KYC documents.' : `The admin requested changes: ${note.trim()}`,
      link: '/supplier/verification',
    });
    showToast(deciding.decision === 'approve' ? `${deciding.company.name} KYC verified.` : `Verification declined for ${deciding.company.name}.`, 'info');

    setActionLoading(false);
    setDeciding(null);
    setNote('');
    setNoteError('');
    fetchKyc();
  };

  return (
    <div>
      <SectionHeading title="Verification review" description="Review supplier GSTIN, PAN, Bank details, and business documents. Approving grants the “Documents reviewed” trust badge." />
      {loading ? <div className="ts-card"><TableSkeleton /></div> : (
        <>
          <Tabs tabs={TABS.map((item) => ({ ...item, count: groups[item.id].length }))} active={tab} onChange={setTab} idPrefix="verify" />
          <TabPanel id={tab} idPrefix="verify" className="pt-5">
            {groups[tab].length === 0 ? (
              <div className="ts-card"><EmptyState icon={ShieldCheck} title="Nothing here" text="No companies have this verification status right now." /></div>
            ) : (
              <ul className="space-y-4">
                {groups[tab].map((company) => {
                  const info = getVerification(company);
                  return (
                    <li key={company.id} className="ts-card p-5 sm:p-6 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <CompanyLogo company={company} />
                          <div className="min-w-0">
                            <h2 className="truncate font-display text-lg font-bold"><Link to={`/suppliers/${company.slug}`} className="hover:text-brand-600">{company.name}</Link></h2>
                            <p className="text-[0.8125rem] text-muted">{company.city ? `${company.city}, ` : ''}{company.country} · {company.businessType}{info.submittedAt ? ` · submitted ${formatDate(info.submittedAt)}` : ''}</p>
                          </div>
                        </div>
                        <VerificationBadge company={company} size="md" />
                      </div>

                      {/* Statutory & Banking overview */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl bg-surface/50 p-3.5 text-xs">
                        <div>
                          <span className="text-muted block">GSTIN / Tax ID:</span>
                          <span className="font-bold text-ink">{company.gstin || 'Not submitted'}</span>
                        </div>
                        <div>
                          <span className="text-muted block">PAN:</span>
                          <span className="font-bold text-ink">{company.pan || 'Not submitted'}</span>
                        </div>
                        <div>
                          <span className="text-muted block">Bank Settlement:</span>
                          <span className="font-bold text-ink">{company.bankName ? `${company.bankName} (IFSC: ${company.bankIfsc})` : 'Not submitted'}</span>
                        </div>
                      </div>

                      {info.documents?.length ? (
                        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {info.documents.map((doc) => (
                            <li key={doc.id} className="flex items-center justify-between gap-3 rounded-xl bg-ivory px-3.5 py-2.5 text-sm border border-navy-900/[0.06]">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <FileText className="size-4 shrink-0 text-brand-600" aria-hidden="true" />
                                <span className="min-w-0">
                                  <span className="block truncate font-semibold text-ink">{doc.type}</span>
                                  <span className="block truncate text-xs text-muted">No. {doc.reference} · {doc.fileName}</span>
                                </span>
                              </div>
                              {doc.fileUrl ? (
                                <a
                                  href={doc.fileUrl.startsWith('http') ? doc.fileUrl : `http://localhost:5000${doc.fileUrl}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 bg-white px-2 py-1 rounded border shadow-xs"
                                >
                                  <ExternalLink className="size-3" /> View
                                </a>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : <p className="text-sm text-muted">No documents submitted.</p>}

                      {info.note ? <p className="text-sm text-rose-800 bg-rose-50 p-2.5 rounded-lg border border-rose-200"><span className="font-semibold">Declined reason: </span>{info.note}</p> : null}

                      {info.status === 'under-review' ? (
                        <div className="pt-2 flex flex-wrap gap-2">
                          <Button size="sm" variant="navy" icon={Check} onClick={() => setDeciding({ company, decision: 'approve' })}>Approve Verification</Button>
                          <Button size="sm" variant="dangerOutline" icon={X} onClick={() => setDeciding({ company, decision: 'decline' })}>Decline</Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </TabPanel>
        </>
      )}

      <Modal
        open={Boolean(deciding)} onClose={() => { setDeciding(null); setNote(''); setNoteError(''); }} size="sm"
        title={deciding?.decision === 'approve' ? 'Approve & verify supplier?' : 'Decline verification?'} description={deciding?.company.name}
        footer={<><Button variant="outline" onClick={() => setDeciding(null)} disabled={actionLoading}>Cancel</Button><Button variant={deciding?.decision === 'approve' ? 'navy' : 'danger'} onClick={confirm} disabled={actionLoading}>{actionLoading ? 'Processing...' : deciding?.decision === 'approve' ? 'Confirm Approval' : 'Decline'}</Button></>}
      >
        <p className="mb-4 text-sm text-muted">{deciding?.decision === 'approve' ? 'The supplier will be marked as verified and will display the trust badge across all marketplace listings.' : 'The supplier will see your rejection reason and will be asked to resubmit corrected documents.'}</p>
        <Textarea id="verify-note" label={deciding?.decision === 'approve' ? 'Approval note (optional)' : 'Reason for rejection'} rows={3} value={note} onChange={(event) => { setNote(event.target.value); setNoteError(''); }} error={noteError} placeholder={deciding?.decision === 'approve' ? 'e.g. All documents verified against MCA & GST portal' : 'e.g. GST certificate expired or blurred'} />
      </Modal>
    </div>
  );
}

