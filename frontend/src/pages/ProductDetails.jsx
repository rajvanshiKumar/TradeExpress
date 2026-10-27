import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Clock, FileText, MessageSquare, PackageCheck, PackageX, Scale, Share2, ShoppingCart, Truck, Zap, CheckCircle2 } from 'lucide-react';
import Breadcrumbs from '../components/common/Breadcrumbs';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Rating from '../components/common/Rating';
import QuantityInput from '../components/common/QuantityInput';
import Tabs, { TabPanel } from '../components/common/Tabs';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import CompanyLogo from '../components/common/CompanyLogo';
import { PageSkeleton } from '../components/common/Skeleton';
import ProductGallery from '../components/products/ProductGallery';
import PriceTiers from '../components/products/PriceTiers';
import ProductSpecifications from '../components/products/ProductSpecifications';
import RelatedProducts from '../components/products/RelatedProducts';
import ProductCard, { WishlistButton } from '../components/products/ProductCard';
import BuyNowButton from '../components/products/BuyNowButton';
import VerificationBadge from '../components/common/VerificationBadge';
import SupplierGrid from '../components/suppliers/SupplierGrid';
import useProducts from '../hooks/useProducts';
import useCart from '../hooks/useCart';
import useCurrency from '../hooks/useCurrency';
import useNotifications from '../hooks/useNotifications';
import useContactSupplier from '../hooks/useContactSupplier';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { apiGet, isApiConfigured } from '../services/apiClient';
import { getLineTotal, getUnitPrice } from '../utils/calculateTotals';
import { quantityLabel } from '../utils/units';
import { formatDate } from '../utils/formatDate';

const TABS = [
  { id: 'description', label: 'Description' },
  { id: 'specs', label: 'Specifications' },
  { id: 'packaging', label: 'Packaging & shipping' },
  { id: 'reviews', label: 'Reviews' },
];

export default function ProductDetails() {
  const { slug } = useParams();
  const { getProduct, getCompany, getCategory, companies, products, loading, error, reload, trackView } = useProducts();
  const { addToCart, removeFromCart, inCart } = useCart();
  const { money } = useCurrency();
  const { showToast } = useNotifications();
  const contact = useContactSupplier();

  const product = getProduct(slug);
  const company = product ? getCompany(product.companyId) : null;
  const targetCompany = company || (product ? { id: product.companyId || 'TS-CO-001', name: product.company || 'Verified Supplier', slug: product.companyId || '' } : null);
  const category = product ? getCategory(product.category) : null;
  const [quantity, setQuantity] = useState(() => product?.moq || 1);
  const [variant, setVariant] = useState(() => (product?.variants ? Object.fromEntries(Object.entries(product.variants).map(([name, options]) => [name, options[0]])) : {}));
  const [tab, setTab] = useState('description');
  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [sampleQuantity, setSampleQuantity] = useState(1);
  const [reviewsData, setReviewsData] = useState({ reviews: [], totalReviews: 0, averageRating: 0 });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  useDocumentTitle(product?.name ?? 'Product');

  useEffect(() => {
    if (!product?.id) return;
    let isMounted = true;
    async function loadReviews() {
      if (isApiConfigured) {
        try {
          setReviewsLoading(true);
          const res = await apiGet(`reviews/product/${encodeURIComponent(product.id)}`);
          if (isMounted && res && res.success && res.data) {
            setReviewsData(res.data);
          }
        } catch (err) {
          console.warn('[TradeExpress] Could not load verified reviews:', err.message);
        } finally {
          if (isMounted) setReviewsLoading(false);
        }
      }
    }
    loadReviews();
    return () => { isMounted = false; };
  }, [product?.id]);

  useEffect(() => {
    if (!product) return;
    setQuantity(product.moq || 1);
    setVariant(Object.fromEntries(Object.entries(product.variants ?? {}).map(([name, options]) => [name, options[0]])));
    setTab('description');
    trackView(product.id);
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const similarSuppliers = useMemo(() => {
    if (!product) return [];
    const ids = new Set(products.filter((item) => item.category === product.category && item.companyId !== product.companyId && item.status === 'Active').map((item) => item.companyId));
    return companies.filter((item) => ids.has(item.id) && item.status !== 'Suspended').slice(0, 3);
  }, [product, products, companies]);

  const supplierProducts = product && company ? products.filter((item) => item.companyId === company.id && item.id !== product.id && item.status === 'Active').slice(0, 4) : [];

  if (loading) return <PageSkeleton />;
  if (error) return <div className="ts-container py-12"><div className="ts-card"><ErrorState text={error} onRetry={reload} /></div></div>;
  if (!product || product.status !== 'Active') {
    return (
      <div className="ts-container py-12">
        <div className="ts-card"><EmptyState icon={PackageX} headingLevel={1} title="Product not found" text="This listing does not exist or is no longer available." action={<Button to="/products" variant="navy">Browse all products</Button>} /></div>
      </div>
    );
  }

  const outOfStock = product.stock <= 0;
  const maxQuantity = Math.max(product.stock, product.moq);
  const unitPrice = getUnitPrice(product, quantity);
  const total = getLineTotal(product, quantity);
  const variantEntries = Object.entries(product.variants ?? {});
  const specifications = { ...product.specifications, 'Place of origin': company ? `${company.city ? `${company.city}, ` : ''}${company.country}` : null, Condition: product.condition };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, text: product.summary, url });
      } else {
        await navigator.clipboard.writeText(url);
        showToast('Product link copied to your clipboard.');
      }
    } catch (shareError) {
      if (shareError?.name !== 'AbortError') showToast('The link could not be shared. Copy it from the address bar instead.', 'error');
    }
  };

  const facts = [
    { icon: outOfStock ? PackageX : PackageCheck, label: 'Stock', value: outOfStock ? 'Out of stock' : `${quantityLabel(product.stock, product.unit)} available` },
    { icon: Clock, label: 'Lead time', value: `${product.leadTimeDays} days` },
    { icon: Truck, label: 'Shipping', value: product.shippingEstimate },
    { icon: FileText, label: 'Samples', value: product.sampleAvailable ? 'Sample available on request' : 'Samples not offered' },
  ];

  return (
    <div className="ts-container py-6 sm:py-8">
      <Breadcrumbs className="mb-5" items={[{ label: 'Products', to: '/products' }, ...(category ? [{ label: category.name, to: `/categories/${category.slug}` }] : []), { label: product.name }]} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-10">
        <ProductGallery product={product} />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {product.deal ? <Badge tone="solid">Deal</Badge> : null}
            {product.readyToShip ? <Badge tone="dark" icon={Zap}>Ready to ship</Badge> : null}
            {product.isNew ? <Badge tone="success">New</Badge> : null}
            <Badge tone="navy">Wholesale</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">{product.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-muted">
            <span>Product ID: <span className="font-semibold text-ink">{product.id}</span></span>
            <span>SKU: <span className="font-semibold text-ink">{product.sku}</span></span>
            <Rating value={product.rating} count={product.reviewCount} />
          </p>
          <p className="mt-3 text-muted">{product.summary}</p>

          <section aria-labelledby="pricing-title" className="mt-5 rounded-2xl bg-white p-4 shadow-card ring-1 ring-line sm:p-5">
            <h2 id="pricing-title" className="mb-3 text-sm font-bold">Price per {product.unit}, by quantity <span className="font-normal text-muted">(INR, excl. shipping & taxes)</span></h2>
            <PriceTiers product={product} quantity={quantity} onSelectTier={setQuantity} />
            <p className="mt-3 text-sm text-ink">Minimum order: <span className="font-bold">{quantityLabel(product.moq, product.unit)}</span></p>

            {variantEntries.map(([name, options]) => (
              <fieldset key={name} className="mt-4">
                <legend className="ts-label">{name}: <span className="font-normal text-muted">{variant[name]}</span></legend>
                <div className="flex flex-wrap gap-2">
                  {options.map((option) => (
                    <label key={option} className={`cursor-pointer rounded-lg border-2 px-3.5 py-1.5 text-sm font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500 ${variant[name] === option ? 'border-brand-500 bg-brand-50 text-navy-900' : 'bg-white text-ink hover:border-navy-200'}`}>
                      <input type="radio" name={`variant-${name}`} value={option} checked={variant[name] === option} onChange={() => setVariant((previous) => ({ ...previous, [name]: option }))} className="sr-only" />
                      {option}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}

            <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
              <div>
                <label htmlFor="product-quantity" className="ts-label">Quantity ({product.unit}s)</label>
                <QuantityInput id="product-quantity" value={quantity} min={product.moq} max={maxQuantity} step={product.moq >= 100 ? 50 : product.moq >= 10 ? 5 : 1} onChange={setQuantity} />
              </div>
              <div aria-live="polite">
                <p className="text-[0.8125rem] text-muted">{quantityLabel(quantity, product.unit)} × {money(unitPrice)}</p>
                <p className="font-display text-2xl font-extrabold text-navy-900">{money(total)} <span className="text-sm font-medium text-muted">estimated total</span></p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Button
                size="lg"
                variant="outline"
                icon={inCart(product.id) ? CheckCircle2 : ShoppingCart}
                disabled={outOfStock}
                onClick={() => {
                  if (inCart(product.id)) {
                    removeFromCart(product.id);
                  } else {
                    addToCart(product, quantity, variantEntries.length ? variant : null);
                  }
                }}
                className={`transition-all font-bold ${
                  inCart(product.id)
                    ? '!bg-emerald-100/95 !text-emerald-900 !border-2 !border-emerald-500 shadow-sm ring-2 ring-emerald-500/20 hover:!bg-emerald-200/90'
                    : '!bg-emerald-50 !text-emerald-800 !border !border-emerald-300/90 shadow-xs hover:!bg-emerald-100 hover:!border-emerald-400'
                }`}
              >
                {outOfStock ? 'Out of stock' : inCart(product.id) ? 'In Cart (Click to Remove)' : 'Add to Cart'}
              </Button>
              {product.sampleAvailable !== false && (
                <Button
                  variant="outline"
                  icon={PackageCheck}
                  onClick={() => setSampleModalOpen(true)}
                  className="sm:col-span-2 border-brand-500/40 bg-brand-50/50 text-navy-900 hover:bg-brand-50 font-semibold"
                >
                  Request Sample ({money(product.samplePrice || product.price)} / {product.unit})
                </Button>
              )}
              <Button
                variant="outline"
                icon={Scale}
                to={`/compare-products/${product.id}`}
                className="sm:col-span-2 border-brand-500/30 hover:border-brand-500 hover:bg-brand-50/40 text-navy-950 font-semibold shadow-xs"
              >
                Compare Similar Products
              </Button>
              <Button variant="outline" icon={FileText} to={`/rfq?product=${product.id}`}>Request a Quote</Button>
              <Button variant="outline" icon={MessageSquare} onClick={() => targetCompany && contact(targetCompany, product)} disabled={!product}>Contact Supplier</Button>
              <div className="flex gap-2.5 sm:col-span-2">
                <Button variant="outline" icon={Share2} onClick={share} className="flex-1">Share</Button>
                <WishlistButton product={product} className="!size-11 !rounded-[0.625rem] border-navy-200 shadow-none" />
              </div>
            </div>
          </section>

          {/* Sample Request Dialog */}
          {sampleModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm">
              <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-navy-900/[0.08]">
                <div className="flex items-center gap-2 border-b border-navy-900/[0.06] pb-3">
                  <PackageCheck className="size-5 text-brand-600" />
                  <h3 className="text-lg font-bold text-ink">Request a Product Sample</h3>
                </div>

                <div className="mt-4 space-y-4">
                  <div className="flex items-center gap-3 rounded-xl bg-ivory/80 p-3 border border-navy-900/[0.06]">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-ink truncate">{product.name}</p>
                      <p className="text-xs text-muted">Supplier: {company?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-navy-900">{money(product.samplePrice || product.price)}</p>
                      <p className="text-[11px] text-muted">per {product.unit}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1.5">
                      Sample Quantity (Max 5 units)
                    </label>
                    <div className="flex items-center gap-3">
                      {[1, 2, 3, 5].map((qty) => (
                        <button
                          key={qty}
                          type="button"
                          onClick={() => setSampleQuantity(qty)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                            sampleQuantity === qty
                              ? 'border-brand-600 bg-brand-50 text-brand-700'
                              : 'border-navy-900/10 text-muted hover:bg-slate-50'
                          }`}
                        >
                          {qty} {product.unit}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-muted space-y-1 border border-navy-900/[0.06]">
                    <p className="flex justify-between">
                      <span>Sample cost ({sampleQuantity} × {money(product.samplePrice || product.price)}):</span>
                      <span className="font-semibold text-ink">{money((product.samplePrice || product.price) * sampleQuantity)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Express courier dispatch:</span>
                      <span className="font-semibold text-ink">Ships in 24–48 hours</span>
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-navy-900/[0.06]">
                    <Button type="button" variant="outline" onClick={() => setSampleModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      icon={ShoppingCart}
                      onClick={() => {
                        addToCart(
                          { ...product, price: product.samplePrice || product.price, isSample: true, name: `[Sample] ${product.name}` },
                          sampleQuantity,
                          variantEntries.length ? variant : null
                        );
                        showToast(`Added ${sampleQuantity} sample unit(s) to your cart.`);
                        setSampleModalOpen(false);
                      }}
                    >
                      Add Sample to Cart
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}


          <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {facts.map((fact) => (
              <div key={fact.label} className="flex items-start gap-3 rounded-xl bg-white p-3.5 ring-1 ring-line">
                <fact.icon className="mt-0.5 size-5 shrink-0 text-navy-700" aria-hidden="true" />
                <div><dt className="text-xs text-muted">{fact.label}</dt><dd className="text-sm font-semibold text-ink">{fact.value}</dd></div>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section aria-label="Product information" className="ts-card min-w-0 overflow-hidden">
          <Tabs tabs={TABS} active={tab} onChange={setTab} idPrefix="product" className="px-2" />
          <TabPanel id={tab} idPrefix="product" className="p-5 sm:p-6">
            {tab === 'description' ? <p className="max-w-3xl whitespace-pre-line text-ink">{product.description}</p> : null}
            {tab === 'specs' ? <ProductSpecifications rows={specifications} caption="Product specifications" /> : null}
            {tab === 'packaging' ? (
              <div className="space-y-4">
                <ProductSpecifications caption="Packaging and shipping" rows={{ 'Unit packaging': product.packaging?.unitPack, 'Units per carton': product.packaging?.cartonQty, 'Carton size': product.packaging?.cartonSize, 'Lead time': `${product.leadTimeDays} days`, Shipping: product.shippingEstimate }} />
                {product.packaging?.note ? <p className="text-sm text-muted">{product.packaging.note}</p> : null}
              </div>
            ) : null}
            {tab === 'reviews' ? (
              <div>
                {reviewsLoading ? (
                  <div className="py-8 text-center text-sm text-muted">Loading verified reviews...</div>
                ) : reviewsData.totalReviews > 0 ? (
                  <div>
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-3xl font-black text-emerald-950">{reviewsData.averageRating.toFixed(1)}</span>
                          <Rating value={reviewsData.averageRating} showValue={false} />
                        </div>
                        <p className="mt-1 text-xs font-semibold text-emerald-800">
                          Based on {reviewsData.totalReviews} verified wholesale order{reviewsData.totalReviews > 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-white/80 border border-emerald-300 px-3 py-1.5 rounded-full shadow-sm">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Verified B2B Buyer Reviews
                      </div>
                    </div>

                    <ul className="divide-y divide-slate-100">
                      {reviewsData.reviews.map((review) => (
                        <li key={review.id} className="py-4 first:pt-0 last:pb-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-ink">
                                {review.buyer?.company || review.buyer?.name || 'Verified Wholesale Buyer'}
                              </p>
                              {review.buyer?.name && review.buyer?.company ? (
                                <p className="text-xs text-muted">{review.buyer.name}</p>
                              ) : null}
                            </div>
                            <p className="text-xs text-muted">{formatDate(review.createdAt)}</p>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            <Rating value={review.rating} showValue={false} />
                            <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                              <span className="bg-slate-100 px-2 py-0.5 rounded font-medium">Quality: {review.qualityRating}/5</span>
                              <span className="bg-slate-100 px-2 py-0.5 rounded font-medium">Packaging: {review.packagingRating}/5</span>
                              <span className="bg-slate-100 px-2 py-0.5 rounded font-medium">Delivery: {review.timelinessRating}/5</span>
                            </div>
                          </div>
                          {review.comment ? (
                            <p className="mt-2 text-sm text-ink leading-relaxed">{review.comment}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : company?.reviews?.length ? (
                  <div>
                    <p className="mb-4 rounded-lg bg-navy-50 px-4 py-3 text-[0.8125rem] text-navy-800">Verified buyer ratings will appear here after orders are delivered. Showing supplier benchmark feedback:</p>
                    <ul className="divide-y">
                      {company.reviews.map((review) => (
                        <li key={review.id} className="py-4 first:pt-0 last:pb-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-ink">{review.author}</p>
                            <p className="text-xs text-muted">{formatDate(review.date)}</p>
                          </div>
                          <Rating value={review.rating} showValue={false} className="mt-1" />
                          <p className="mt-1.5 text-sm text-ink">{review.text}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-muted">No reviews for this listing yet. Be the first verified buyer to review after delivery!</p>
                )}
              </div>
            ) : null}
          </TabPanel>
        </section>

        {company ? (
          <aside aria-labelledby="supplier-card-title" className="ts-card h-fit p-5">
            <p className="ts-eyebrow">Supplier</p>
            <div className="mt-3 flex items-center gap-3">
              <CompanyLogo company={company} />
              <div className="min-w-0">
                <h2 id="supplier-card-title" className="truncate text-base font-bold"><Link to={`/suppliers/${company.slug}`} className="hover:text-brand-600">{company.name}</Link></h2>
                <p className="text-[0.8125rem] text-muted">{company.flag} {company.city ? `${company.city}, ` : ''}{company.country}</p>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted">Business type</dt><dd className="font-semibold">{company.businessType}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Established</dt><dd className="font-semibold">{company.established}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Response time</dt><dd className="font-semibold">{company.responseTime}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Rating</dt><dd><Rating value={company.rating} /></dd></div>
            </dl>
            <div className="mt-3"><VerificationBadge company={company} size="md" /></div>
            <p className="mt-2 text-xs text-muted">Company details are provided by the supplier.</p>
            <div className="mt-4 grid gap-2">
              <Button to={`/suppliers/${company.slug}`} variant="navy" size="sm">View Company</Button>
              <Button variant="outline" size="sm" icon={MessageSquare} onClick={() => contact(targetCompany || company, product)}>Contact Supplier</Button>
            </div>
          </aside>
        ) : null}
      </div>

      {supplierProducts.length ? (
        <section aria-labelledby="supplier-products-title" className="mt-14">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <h2 id="supplier-products-title" className="text-2xl font-extrabold tracking-[-0.025em]">More from {company.name}</h2>
            <Link to={`/suppliers/${company.slug}`} className="text-sm font-semibold text-brand-600 hover:text-brand-700">View full catalogue →</Link>
          </div>
          <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 sm:gap-6 lg:grid-cols-4">{supplierProducts.map((item) => <ProductCard key={item.id} product={item} />)}</div>
        </section>
      ) : null}

      <div className="mt-14"><RelatedProducts product={product} title="Related products" /></div>

      {similarSuppliers.length ? (
        <section aria-labelledby="similar-suppliers-title" className="mt-10">
          <h2 id="similar-suppliers-title" className="mb-4 text-xl font-extrabold">Similar suppliers</h2>
          <SupplierGrid companies={similarSuppliers} />
        </section>
      ) : null}
    </div>
  );
}
