import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Package,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import Tabs, { TabPanel } from '../components/common/Tabs';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import { TableSkeleton } from '../components/common/Skeleton';
import ProductRfqForm from '../components/forms/ProductRfqForm';
import InquiryList from '../components/forms/InquiryList';
import useAuth from '../hooks/useAuth';
import useProducts from '../hooks/useProducts';
import useInquiries from '../hooks/useInquiries';
import useDocumentTitle from '../hooks/useDocumentTitle';

const HOW_IT_WORKS = [
  'Open any verified product in our catalog and click "Request a Quote".',
  'Specify required quantity, delivery location, and custom requirements.',
  'The supplier receives your RFQ in their dashboard and submits a quote.',
  'Review received quotes, compare landed costs, negotiate, or accept and place order.',
];

export default function RequestQuote() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { products, getProduct, getCompany, loading: catalogLoading } = useProducts();
  const { inquiries, loading, error, reload } = useInquiries();
  useDocumentTitle('Request a Quote');

  const tab = searchParams.get('tab') === 'history' ? 'history' : 'new';
  const productId = searchParams.get('product') ?? '';

  const product = useMemo(() => {
    if (!productId) return null;
    return getProduct(productId) || null;
  }, [getProduct, productId]);

  const company = product
    ? (getCompany(product.companyId) || (product.supplier?.company ? product.supplier : null))
    : null;

  const mine = useMemo(
    () => inquiries.filter((item) => item.buyerId === (user?.id ?? 'guest')),
    [inquiries, user]
  );

  const setTab = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'history') params.set('tab', 'history');
    else params.delete('tab');
    setSearchParams(params);
  };

  const pageTitle = product
    ? `Request a Quote: ${product.name}`
    : 'Request a Quote';

  const pageDescription = product
    ? 'Direct quotation request for this verified product. Product and supplier details are prefilled and locked.'
    : 'Quotations can only be requested directly from verified product listings. Browse our catalogue to select a product and request a quote.';

  return (
    <>
      <PageHeader
        breadcrumbs={
          product
            ? [
                { label: 'Products', to: '/products' },
                { label: product.name, to: `/products/${product.slug || product.id}` },
                { label: 'Request a Quote' },
              ]
            : [{ label: 'Request a Quote' }]
        }
        title={pageTitle}
        description={pageDescription}
      />
      <div className="ts-container py-6 sm:py-8 min-h-[550px] pb-24">
        <Tabs
          tabs={[
            { id: 'new', label: product ? 'Request Product Quote' : 'Request Quote' },
            { id: 'history', label: 'My RFQs', count: mine.length },
          ]}
          active={tab}
          onChange={setTab}
          idPrefix="rfq"
        />

        <TabPanel id={tab} idPrefix="rfq" className="pt-6">
          {tab === 'new' ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <section className="ts-card p-5 sm:p-7 relative z-20 overflow-visible">
                {catalogLoading ? (
                  <TableSkeleton rows={6} />
                ) : product ? (
                  <div className="space-y-4">
                    {/* Direct Product Header Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                      <Link
                        to={`/products/${product.slug || product.id}`}
                        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-brand-700 hover:text-brand-800 transition-colors"
                      >
                        <ArrowLeft className="size-4" />
                        <span>Back to Product Details</span>
                      </Link>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                        <Sparkles className="size-3 text-emerald-600" />
                        Product-Specific RFQ
                      </span>
                    </div>

                    <ProductRfqForm
                      key={product.id}
                      product={product}
                      company={company}
                      onDone={() => setTab('history')}
                    />
                  </div>
                ) : (
                  /* When no product is selected: Direct manual form removed. Buyer requests quote through products only */
                  <div className="py-6">
                    <EmptyState
                      icon={Package}
                      title="Select a Product to Request a Quote"
                      text="Quotations can only be requested directly from verified product listings. Please browse our product catalog, open the product you need, and click &quot;Request a Quote&quot;."
                      action={
                        <Button to="/products" variant="navy" icon={Search}>
                          Browse Products
                        </Button>
                      }
                    />

                    {products && products.length > 0 ? (
                      <div className="mt-8 border-t border-slate-200 pt-6">
                        <div className="flex items-center justify-between gap-2 mb-4">
                          <h3 className="text-sm font-bold text-navy-900">Popular Products Available for Quotation</h3>
                          <Link to="/products" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                            View All Products →
                          </Link>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {products.slice(0, 4).map((p) => (
                            <Link
                              key={p.id}
                              to={`/rfq?product=${p.id}`}
                              className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-brand-500 hover:bg-brand-50/40 transition-all text-left group"
                            >
                              <img
                                src={p.images?.[0] || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=200'}
                                alt={p.name}
                                className="size-12 rounded-lg object-cover bg-slate-100 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-navy-900 truncate group-hover:text-brand-700">{p.name}</p>
                                <p className="text-xs text-muted truncate">{p.supplier?.company || p.company || 'Verified Supplier'}</p>
                              </div>
                              <span className="text-xs font-semibold text-brand-600 shrink-0">Request Quote →</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </section>

              <aside className="space-y-5">
                {product ? (
                  <section className="rounded-2xl border border-brand-200 bg-brand-50/50 p-5 text-sm text-navy-900">
                    <div className="flex items-center gap-2 font-bold text-brand-800">
                      <Sparkles className="size-4" />
                      <span>Direct Product Mode Active</span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-700 leading-relaxed">
                      You are requesting a quote directly for{' '}
                      <strong className="font-semibold text-navy-900">{product.name}</strong>.
                      Product specifications and supplier assignment are prefilled and locked.
                    </p>
                    <Button
                      to="/products"
                      variant="white"
                      size="sm"
                      icon={Search}
                      className="mt-3 text-xs"
                    >
                      Browse Other Products
                    </Button>
                  </section>
                ) : null}

                <section className="ts-card p-5">
                  <h2 className="text-base font-bold text-navy-900">How TradeExpress RFQs Work</h2>
                  <ol className="mt-3.5 space-y-3.5">
                    {HOW_IT_WORKS.map((step, index) => (
                      <li key={index} className="flex gap-3 text-xs sm:text-sm text-ink leading-relaxed">
                        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </section>

                <section className="rounded-2xl bg-navy-900 p-5 text-sm text-white">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-5 text-emerald-400" />
                    <h2 className="text-base font-bold">100% Escrow Protection</h2>
                  </div>
                  <p className="mt-2 text-xs text-navy-200 leading-relaxed">
                    Once a quote is agreed and accepted, funds are held securely in TradeExpress Escrow and released only after delivery confirmation.
                  </p>
                  <Button to="/buyer/quotes" variant="white" size="sm" className="mt-4">
                    View My RFQs
                  </Button>
                </section>
              </aside>
            </div>
          ) : error ? (
            <div className="ts-card">
              <ErrorState text={error} onRetry={reload} />
            </div>
          ) : loading ? (
            <div className="ts-card">
              <TableSkeleton />
            </div>
          ) : mine.length ? (
            <InquiryList inquiries={mine} />
          ) : (
            <div className="ts-card">
              <EmptyState
                icon={FileText}
                title="No RFQs submitted yet"
                text={
                  user
                    ? 'Requests you submit will be listed here with their real-time supplier quotations and negotiation rounds.'
                    : 'Requests submitted in this browser will be listed here. Sign in to view all RFQs linked to your account.'
                }
                action={
                  <Button to="/products" variant="navy" icon={Search}>
                    Browse Products
                  </Button>
                }
              />
            </div>
          )}
        </TabPanel>
      </div>
    </>
  );
}
