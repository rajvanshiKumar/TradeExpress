import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Award, Building2, Mail, MapPin, MessageSquare, Phone, UserRound } from 'lucide-react';
import Breadcrumbs from '../components/common/Breadcrumbs';
import Button from '../components/common/Button';
import Rating from '../components/common/Rating';
import Image from '../components/common/Image';
import Tabs, { TabPanel } from '../components/common/Tabs';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import { PageSkeleton } from '../components/common/Skeleton';
import SupplierHeader from '../components/suppliers/SupplierHeader';
import SupplierProductList from '../components/suppliers/SupplierProductList';
import InquiryForm from '../components/forms/InquiryForm';
import useProducts from '../hooks/useProducts';
import useContactSupplier from '../hooks/useContactSupplier';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { formatDate } from '../utils/formatDate';

export default function SupplierDetails() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const { getCompany, products, loading, error, reload } = useProducts();
  const contact = useContactSupplier();
  const company = getCompany(slug);
  const [tab, setTab] = useState(searchParams.get('tab') ?? 'products');
  useDocumentTitle(company?.name ?? 'Supplier');

  useEffect(() => setTab(searchParams.get('tab') ?? 'products'), [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <PageSkeleton />;
  if (error) return <div className="ts-container py-12"><div className="ts-card"><ErrorState text={error} onRetry={reload} /></div></div>;
  if (!company || company.status === 'Suspended') {
    return (
      <div className="ts-container py-12">
        <div className="ts-card"><EmptyState icon={Building2} headingLevel={1} title="Supplier not found" text="This company profile does not exist or is not currently available." action={<Button to="/suppliers" variant="navy">Browse suppliers</Button>} /></div>
      </div>
    );
  }

  const productCount = products.filter((product) => product.companyId === company.id && product.status === 'Active').length;
  const tabs = [
    { id: 'products', label: 'Products', count: productCount },
    { id: 'profile', label: 'Company Profile' },
    { id: 'reviews', label: 'Reviews', count: company.reviews?.length ?? 0 },
    { id: 'contact', label: 'Contact' },
  ];
  const contactRows = [
    { icon: UserRound, label: 'Contact person', value: company.contact?.person },
    { icon: Mail, label: 'Email', value: company.contact?.email },
    { icon: Phone, label: 'Phone', value: company.contact?.phone },
    { icon: MapPin, label: 'Address', value: company.contact?.address },
  ].filter((row) => row.value);

  return (
    <div className="ts-container py-6 sm:py-8">
      <Breadcrumbs className="mb-5" items={[{ label: 'Suppliers', to: '/suppliers' }, { label: company.name }]} />
      <SupplierHeader company={company} productCount={productCount} />

      <div className="mt-6">
        <Tabs tabs={tabs} active={tabs.some((item) => item.id === tab) ? tab : 'products'} onChange={setTab} idPrefix="supplier" />
        <TabPanel id={tab} idPrefix="supplier" className="pt-6">
          {tab === 'products' ? <SupplierProductList company={company} /> : null}

          {tab === 'profile' ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="space-y-6">
                <section className="ts-card p-5 sm:p-6">
                  <h2 className="text-lg font-bold">About {company.name}</h2>
                  <p className="mt-2 text-ink">{company.description}</p>
                  {company.mainProducts?.length ? (
                    <>
                      <h3 className="mt-5 text-sm font-bold">Main products</h3>
                      <ul className="mt-2 flex flex-wrap gap-2">{company.mainProducts.map((item) => <li key={item} className="rounded-full bg-surface px-3 py-1 text-sm">{item}</li>)}</ul>
                    </>
                  ) : null}
                  <h3 className="mt-5 text-sm font-bold">Minimum order</h3>
                  <p className="mt-1 text-sm text-ink">{company.moqInfo}</p>
                </section>
                {company.gallery?.length ? (
                  <section className="ts-card p-5 sm:p-6">
                    <h2 className="text-lg font-bold">Gallery</h2>
                    <ul className="mt-3 grid grid-cols-3 gap-3">
                      {company.gallery.map((photo, index) => (
                        <li key={photo}><Image photo={photo} illustration="product-generic" width={400} height={300} alt={`${company.name} sample product image ${index + 1}`} className="aspect-[4/3] w-full rounded-xl bg-surface object-cover" /></li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
              <div className="space-y-6">
                <section className="ts-card p-5">
                  <h2 className="text-lg font-bold">Company facts</h2>
                  <dl className="mt-3 space-y-2.5 text-sm">
                    {[['Business type', company.businessType], ['Industry', company.industry], ['Location', `${company.city ? `${company.city}, ` : ''}${company.country}`], ['Established', company.established], ['Employees', company.employees], ['Response time', company.responseTime]].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4"><dt className="text-muted">{label}</dt><dd className="text-right font-semibold text-ink">{value}</dd></div>
                    ))}
                  </dl>
                </section>
                <section className="ts-card p-5">
                  <h2 className="text-lg font-bold">Certificates</h2>
                  <p className="mt-1 rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning">Certificates are declared by the supplier as examples and have not been verified by TradeSphere.</p>
                  {company.certificates?.length ? (
                    <ul className="mt-3 space-y-2">
                      {company.certificates.map((certificate) => (
                        <li key={certificate} className="flex items-start gap-2.5 text-sm text-ink"><Award className="mt-0.5 size-4 shrink-0 text-navy-700" aria-hidden="true" />{certificate}</li>
                      ))}
                    </ul>
                  ) : <p className="mt-3 text-sm text-muted">No example certificates listed.</p>}
                </section>
              </div>
            </div>
          ) : null}

          {tab === 'reviews' ? (
            <section className="ts-card p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold">Buyer reviews</h2>
                <Rating value={company.rating} count={company.reviewCount} size="lg" />
              </div>
              <p className="mt-3 rounded-lg bg-navy-50 px-4 py-3 text-[0.8125rem] text-navy-800">Sample reviews shown for illustration.</p>
              {company.reviews?.length ? (
                <ul className="mt-2 divide-y">
                  {company.reviews.map((review) => (
                    <li key={review.id} className="py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-ink">{review.author}</p>
                        <p className="text-xs text-muted">{formatDate(review.date)}</p>
                      </div>
                      <Rating value={review.rating} showValue={false} className="mt-1" />
                      <p className="mt-1.5 text-sm text-ink">{review.text}</p>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState title="No reviews yet" text="This company has no reviews yet." />}
            </section>
          ) : null}

          {tab === 'contact' ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <section className="ts-card h-fit p-5">
                <h2 className="text-lg font-bold">Contact details</h2>
                <p className="mt-1 text-xs text-muted">Contact details are provided by the supplier and have not been verified.</p>
                {contactRows.length ? (
                  <dl className="mt-4 space-y-3.5">
                    {contactRows.map((row) => (
                      <div key={row.label} className="flex gap-3">
                        <row.icon className="mt-0.5 size-4 shrink-0 text-navy-700" aria-hidden="true" />
                        <div className="min-w-0"><dt className="text-xs text-muted">{row.label}</dt><dd className="break-words text-sm font-semibold text-ink">{row.value}</dd></div>
                      </div>
                    ))}
                  </dl>
                ) : <p className="mt-4 text-sm text-muted">No contact details have been added.</p>}
                <Button icon={MessageSquare} full className="mt-5" onClick={() => contact(company)}>Contact Supplier</Button>
                <p className="mt-2 text-center text-xs text-muted">Opens a conversation in your message centre.</p>
              </section>
              <section className="ts-card p-5 sm:p-6">
                <h2 className="text-lg font-bold">Request a quote from {company.name}</h2>
                <p className="mb-5 mt-1 text-sm text-muted">Pick one of their products or describe what you need.</p>
                <InquiryForm company={company} idPrefix="sd-rfq-" />
              </section>
            </div>
          ) : null}
        </TabPanel>
      </div>
    </div>
  );
}
