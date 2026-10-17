import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, FileText, ShieldCheck, X } from 'lucide-react';
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
  useDocumentTitle('Admin: verification');

  const groups = useMemo(() => Object.fromEntries(TABS.map((item) => [item.id, companies.filter((company) => getVerification(company).status === item.id)])), [companies]);

  const confirm = () => {
    if (deciding.decision === 'decline' && note.trim().length < 5) {
      setNoteError('Tell the supplier what to change (at least 5 characters).');
      return;
    }
    reviewVerification(deciding.company.id, deciding.decision === 'approve' ? 'approve' : 'decline', note.trim());
    addNotification({ audience: `company:${deciding.company.id}`, type: 'quotes', title: deciding.decision === 'approve' ? 'Documents reviewed' : 'Verification declined', body: deciding.decision === 'approve' ? 'A TradeSphere admin reviewed your business documents.' : `The admin asked for changes: ${note.trim()}`, link: '/supplier/verification' });
    showToast(deciding.decision === 'approve' ? `${deciding.company.name} marked as documents reviewed.` : `Verification declined for ${deciding.company.name}.`, 'info');
    setDeciding(null);
    setNote('');
    setNoteError('');
  };

  return (
    <div>
      <SectionHeading title="Verification review" description="Review supplier business documents. Approving shows a “Documents reviewed” badge; it does not certify the company legally." />
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
                    <li key={company.id} className="ts-card p-5 sm:p-6">
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
                      {info.documents?.length ? (
                        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {info.documents.map((doc) => (
                            <li key={doc.id} className="flex items-center gap-3 rounded-xl bg-ivory px-3.5 py-2.5 text-sm">
                              <FileText className="size-4 shrink-0 text-brand-600" aria-hidden="true" />
                              <span className="min-w-0"><span className="block truncate font-semibold text-ink">{doc.type}</span><span className="block truncate text-xs text-muted">No. {doc.reference} · {doc.fileName}</span></span>
                            </li>
                          ))}
                        </ul>
                      ) : <p className="mt-4 text-sm text-muted">No documents submitted.</p>}
                      {info.note ? <p className="mt-3 text-sm text-muted"><span className="font-semibold text-ink">Note: </span>{info.note}</p> : null}
                      {info.status === 'under-review' ? (
                        <div className="mt-5 flex flex-wrap gap-2">
                          <Button size="sm" variant="navy" icon={Check} onClick={() => setDeciding({ company, decision: 'approve' })}>Mark documents reviewed</Button>
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
        title={deciding?.decision === 'approve' ? 'Mark documents as reviewed?' : 'Decline verification?'} description={deciding?.company.name}
        footer={<><Button variant="outline" onClick={() => setDeciding(null)}>Cancel</Button><Button variant={deciding?.decision === 'approve' ? 'navy' : 'danger'} onClick={confirm}>{deciding?.decision === 'approve' ? 'Confirm review' : 'Decline'}</Button></>}
      >
        <p className="mb-4 text-sm text-muted">{deciding?.decision === 'approve' ? 'The supplier will show a “Documents reviewed” badge. Only confirm after checking the documents yourself.' : 'The supplier will see your note and can resubmit.'}</p>
        <Textarea id="verify-note" label={deciding?.decision === 'approve' ? 'Note (optional)' : 'What should the supplier change?'} rows={3} value={note} onChange={(event) => { setNote(event.target.value); setNoteError(''); }} error={noteError} />
      </Modal>
    </div>
  );
}
