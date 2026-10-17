import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Clock, FileText, MessageSquare, PackageCheck, PackageX, Share2, ShoppingCart, Truck, Zap } from 'lucide-react';
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
import InquiryForm from '../components/forms/InquiryForm';
import useProducts from '../hooks/useProducts';
import useCart from '../hooks/useCart';
import useCurrency from '../hooks/useCurrency';
import useNotifications from '../hooks/useNotifications';
import useContactSupplier from '../hooks/useContactSupplier';
import useDocumentTitle from '../hooks/useDocumentTitle';
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
  const { addToCart, inCart } = useCart();
  const { money } = useCurrency();
  const { showToast } = useNotifications();
  const contact = useContactSupplier();

  const product = getProduct(slug);
  const company = product ? getCompany(product.companyId) : null;
  const category = product ? getCategory(product.category) : null;
  const [quantity, setQuantity] = useState(1);
  const [variant, setVariant] = useState({});
  const [tab, setTab] = useState('description');
  useDocumentTitle(product?.name ?? 'Product');

  useEffect(() => {
    if (!product) return;
    setQuantity(product.moq);
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
            <PriceTiers product={product} quantity={quantity} />
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
              <BuyNowButton product={product} quantity={quantity} variant={variantEntries.length ? variant : null} size="lg" />
              <Button size="lg" variant="navy" icon={ShoppingCart} disabled={outOfStock} onClick={() => addToCart(product, quantity, variantEntries.length ? variant : null)}>
                {outOfStock ? 'Out of stock' : inCart(product.id) ? 'Add more to cart' : 'Add to Cart'}
              </Button>
              <Button variant="outline" icon={FileText} to={`/rfq?product=${product.id}`} className="sm:col-span-2">Request a Quote</Button>
              <Button variant="outline" icon={MessageSquare} onClick={() => company && contact(company, product)} disabled={!company}>Contact Supplier</Button>
              <div className="flex gap-2.5">
                <Button variant="outline" icon={Share2} onClick={share} className="flex-1">Share</Button>
                <WishlistButton product={product} className="!size-11 !rounded-[0.625rem] border-navy-200 shadow-none" />
              </div>
            </div>
          </section>

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
                <p className="mb-4 rounded-lg bg-navy-50 px-4 py-3 text-[0.8125rem] text-navy-800">Sample reviews shown for illustration.</p>
                {company?.reviews?.length ? (
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
                ) : <p className="text-sm text-muted">No reviews for this listing yet.</p>}
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
              <Button variant="outline" size="sm" icon={MessageSquare} onClick={() => contact(company, product)}>Contact Supplier</Button>
            </div>
          </aside>
        ) : null}
      </div>

      <section aria-labelledby="inquiry-title" className="ts-card mt-8 p-5 sm:p-7">
        <h2 id="inquiry-title" className="text-xl font-extrabold">Send an inquiry</h2>
        <p className="mb-5 mt-1 text-sm text-muted">Ask for a quote on your exact quantity and specifications.</p>
        <InquiryForm product={product} idPrefix="pd-rfq-" />
      </section>

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
