import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import Tabs, { TabPanel } from '../components/common/Tabs';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import { TableSkeleton } from '../components/common/Skeleton';
import InquiryForm from '../components/forms/InquiryForm';
import InquiryList from '../components/forms/InquiryList';
import useAuth from '../hooks/useAuth';
import useProducts from '../hooks/useProducts';
import useInquiries from '../hooks/useInquiries';
import useDocumentTitle from '../hooks/useDocumentTitle';

const STEPS = ['Describe the product, quantity and target price.', 'The request is saved with the status “Submitted”.', 'Follow its status here or in your buyer dashboard.'];

export default function RequestQuote() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { getProduct, getCompany, loading: catalogLoading } = useProducts();
  const { inquiries, loading, error, reload } = useInquiries();
  useDocumentTitle('Request a Quote');

  const tab = searchParams.get('tab') === 'history' ? 'history' : 'new';
  const product = getProduct(searchParams.get('product') ?? '');
  const company = product ? null : getCompany(searchParams.get('company') ?? '');
  const mine = useMemo(() => inquiries.filter((item) => item.buyerId === (user?.id ?? 'guest')), [inquiries, user]);

  const setTab = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'history') params.set('tab', 'history'); else params.delete('tab');
    setSearchParams(params);
  };

  return (
    <>
      <PageHeader breadcrumbs={[{ label: 'Request a Quote' }]} title="Request a Quote" description="Tell suppliers what you need and track the status of every request." />
      <div className="ts-container py-6 sm:py-8">
        <Tabs tabs={[{ id: 'new', label: 'New request' }, { id: 'history', label: 'My requests', count: mine.length }]} active={tab} onChange={setTab} idPrefix="rfq" />
        <TabPanel id={tab} idPrefix="rfq" className="pt-6">
          {tab === 'new' ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <section className="ts-card p-5 sm:p-7">
                {catalogLoading ? <TableSkeleton rows={6} /> : <InquiryForm key={`${product?.id ?? ''}-${company?.id ?? ''}-${searchParams.get('name') ?? ''}`} product={product} company={company} initialName={searchParams.get('name') ?? ''} initialQuantity={searchParams.get('qty') ?? ''} />}
                {product ? <p className="mt-4 text-sm text-muted">Need something different? <Link to="/rfq" className="font-semibold text-brand-600">Start a blank request</Link>.</p> : null}
              </section>
              <aside className="space-y-5">
                <section className="ts-card p-5">
                  <h2 className="text-base font-bold">How quote requests work</h2>
                  <ol className="mt-3 space-y-3">
                    {STEPS.map((step, index) => (
                      <li key={step} className="flex gap-3 text-sm text-ink">
                        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">{index + 1}</span>{step}
                      </li>
                    ))}
                  </ol>
                </section>
                <section className="rounded-2xl bg-navy-50 p-5 text-sm text-navy-800">
                  <h2 className="text-base font-bold">See the supplier side</h2>
                  <p className="mt-1.5">Suppliers answer quotation requests from their dashboard. Register as a supplier to list products and send quotes.</p>
                  <Button to="/login" variant="white" size="sm" className="mt-3">Open sign in</Button>
                </section>
              </aside>
            </div>
          ) : error ? <div className="ts-card"><ErrorState text={error} onRetry={reload} /></div> : loading ? <div className="ts-card"><TableSkeleton /></div> : mine.length ? (
            <InquiryList inquiries={mine} />
          ) : (
            <div className="ts-card">
              <EmptyState icon={FileText} title="No quote requests yet" text={user ? 'Requests you submit will be listed here with their status.' : 'Requests you submit in this browser will be listed here. Sign in to see the requests linked to your account.'} action={<Button variant="navy" onClick={() => setTab('new')}>Create a request</Button>} />
            </div>
          )}
        </TabPanel>
      </div>
    </>
  );
}
