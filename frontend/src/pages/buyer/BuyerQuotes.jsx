import { useEffect, useMemo, useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Tabs, { TabPanel } from '../../components/common/Tabs';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import { TableSkeleton } from '../../components/common/Skeleton';
import InquiryList from '../../components/forms/InquiryList';
import useAuth from '../../hooks/useAuth';
import useInquiries from '../../hooks/useInquiries';
import useDocumentTitle from '../../hooks/useDocumentTitle';

export default function BuyerQuotes() {
  const { user } = useAuth();
  const { inquiries, loading, error, reload, refresh } = useInquiries();
  // Opening this page refreshes only its own data (quote requests), quietly and without duplicate requests
  useEffect(() => { refresh(); }, [refresh]);
  const [tab, setTab] = useState('all');
  useDocumentTitle('My quotes');

  const mine = useMemo(() => inquiries.filter((inquiry) => inquiry.buyerId === user.id), [inquiries, user.id]);
  const groups = {
    all: mine,
    waiting: mine.filter((inquiry) => !inquiry.quote && inquiry.status !== 'Closed' && inquiry.status !== 'Accepted'),
    quoted: mine.filter((inquiry) => inquiry.quote && inquiry.status !== 'Closed' && inquiry.status !== 'Accepted'),
    accepted: mine.filter((inquiry) => inquiry.status === 'Accepted'),
    closed: mine.filter((inquiry) => inquiry.status === 'Closed' || inquiry.status === 'Declined'),
  };
  const tabs = [
    { id: 'all', label: 'My RFQs', count: groups.all.length },
    { id: 'waiting', label: 'Sent Requests', count: groups.waiting.length },
    { id: 'quoted', label: 'Received Quotations', count: groups.quoted.length },
    { id: 'accepted', label: 'Accepted Quotations', count: groups.accepted.length },
    { id: 'closed', label: 'Closed / Expired', count: groups.closed.length },
  ];

  return (
    <div>
      <SectionHeading
        title="Quotes"
        description="Quote requests you have submitted and their current status."
        actions={
          <Button to="/products" size="sm" icon={Plus}>
            New request
          </Button>
        }
      />
      {error ? <div className="ts-card"><ErrorState text={error} onRetry={reload} /></div> : loading ? <div className="ts-card"><TableSkeleton /></div> : mine.length === 0 ? (
        <div className="ts-card"><EmptyState icon={FileText} title="No quote requests yet" text="Send a request to a supplier and follow its status here." action={<Button to="/products" variant="navy">Browse Products to Request Quote</Button>} /></div>
      ) : (
        <>
          <Tabs tabs={tabs} active={tab} onChange={setTab} idPrefix="quotes" />
          <TabPanel id={tab} idPrefix="quotes" className="pt-5">
            {groups[tab].length ? <InquiryList inquiries={groups[tab]} /> : <div className="ts-card"><EmptyState icon={FileText} title="Nothing in this view" text="No quote requests have this status right now." /></div>}
          </TabPanel>
        </>
      )}
    </div>
  );
}
