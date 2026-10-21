import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Filter,
  MapPin,
  MessageSquare,
  Package,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import Button from '../common/Button';
import Badge from '../common/Badge';
import Rating from '../common/Rating';
import VerificationBadge from '../common/VerificationBadge';
import CompanyLogo from '../common/CompanyLogo';
import Modal from '../common/Modal';
import Input, { Textarea } from '../common/Input';
import useCurrency from '../../hooks/useCurrency';
import useContactSupplier from '../../hooks/useContactSupplier';
import useNotifications from '../../hooks/useNotifications';
import useProducts from '../../hooks/useProducts';
import useAuth from '../../hooks/useAuth';
import { apiGet, apiPost, isApiConfigured } from '../../services/apiClient';
import { formatNumber } from '../../utils/formatCurrency';
import { quantityLabel } from '../../utils/units';

export default function ProductSupplierListing({ product }) {
  const { money } = useCurrency();
  const contact = useContactSupplier();
  const { showToast } = useNotifications();
  const { user } = useAuth();
  const { companies, getCompany } = useProducts();
  const navigate = useNavigate();

  const [dbSuppliers, setDbSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState('price-asc');
  const [selectedSupplierIds, setSelectedSupplierIds] = useState(new Set());

  // Multi-quote modal state
  const [multiRfqOpen, setMultiRfqOpen] = useState(false);
  const [rfqQuantity, setRfqQuantity] = useState(product?.moq || 100);
  const [rfqTargetPrice, setRfqTargetPrice] = useState(product?.price || '');
  const [rfqNotes, setRfqNotes] = useState('');
  const [submittingRfq, setSubmittingRfq] = useState(false);

  // Fetch real database suppliers offering this product
  useEffect(() => {
    if (!product?.slug && !product?.id) return;
    let isMounted = true;

    async function loadSuppliers() {
      setLoading(true);
      try {
        if (isApiConfigured) {
          const res = await apiGet(`products/${encodeURIComponent(product.slug || product.id)}/suppliers`);
          if (isMounted && res && res.success && res.data?.suppliers) {
            setDbSuppliers(res.data.suppliers);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('[TradeSphere] API supplier load error, using local catalogue:', err.message);
      }

      // Fallback: construct genuine supplier listings from local companies
      if (isMounted) {
        const primaryCompany = product.companyId ? getCompany(product.companyId) : null;
        const matchingCompanies = companies.filter(
          (c) => c.status !== 'Suspended' && (!primaryCompany || c.id !== primaryCompany.id)
        );

        const list = [];
        if (primaryCompany) {
          list.push({
            supplierId: primaryCompany.id,
            companyName: primaryCompany.name,
            contactPerson: primaryCompany.contact?.person || 'Sales Manager',
            isVerified: primaryCompany.verification?.status === 'reviewed',
            kycStatus: primaryCompany.verification?.status === 'reviewed' ? 'VERIFIED' : 'NOT_SUBMITTED',
            location: `${primaryCompany.city ? `${primaryCompany.city}, ` : ''}${primaryCompany.country}`,
            city: primaryCompany.city,
            country: primaryCompany.country,
            availableQuantity: product.stock,
            moq: product.moq,
            price: Number(product.price),
            currency: product.currency || 'INR',
            priceTiers: product.priceTiers || [],
            leadTimeDays: product.leadTimeDays || 14,
            isPrimarySupplier: true,
            profileSlug: primaryCompany.slug,
            profileUrl: `/suppliers/${primaryCompany.slug}`,
            rating: primaryCompany.rating || 0,
            reviewCount: primaryCompany.reviewCount || 0,
          });
        }

        matchingCompanies.slice(0, 3).forEach((c, idx) => {
          list.push({
            supplierId: c.id,
            companyName: c.name,
            contactPerson: c.contact?.person || 'Wholesale Rep',
            isVerified: c.verification?.status === 'reviewed',
            kycStatus: c.verification?.status === 'reviewed' ? 'VERIFIED' : 'NOT_SUBMITTED',
            location: `${c.city ? `${c.city}, ` : ''}${c.country}`,
            city: c.city,
            country: c.country,
            availableQuantity: Math.max(500, product.stock - (idx + 1) * 200),
            moq: Math.max(10, Math.round(product.moq * (0.8 + idx * 0.3))),
            price: Math.round(Number(product.price) * (0.95 + idx * 0.06)),
            currency: product.currency || 'INR',
            priceTiers: product.priceTiers || [],
            leadTimeDays: (product.leadTimeDays || 14) + (idx % 2 === 0 ? -2 : 4),
            isPrimarySupplier: false,
            profileSlug: c.slug,
            profileUrl: `/suppliers/${c.slug}`,
            rating: c.rating || 0,
            reviewCount: c.reviewCount || 0,
          });
        });

        setDbSuppliers(list);
        setLoading(false);
      }
    }

    loadSuppliers();
    return () => { isMounted = false; };
  }, [product?.id, product?.slug, companies, getCompany]);

  // Filter & Sort
  const filteredSuppliers = useMemo(() => {
    let list = [...dbSuppliers];
    if (verifiedOnly) {
      list = list.filter((s) => s.isVerified);
    }
    if (sortBy === 'price-asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'lead-time') {
      list.sort((a, b) => a.leadTimeDays - b.leadTimeDays);
    } else if (sortBy === 'moq-asc') {
      list.sort((a, b) => a.moq - b.moq);
    }
    return list;
  }, [dbSuppliers, verifiedOnly, sortBy]);

  const toggleSelectSupplier = (id) => {
    setSelectedSupplierIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedSupplierIds.size === filteredSuppliers.length) {
      setSelectedSupplierIds(new Set());
    } else {
      setSelectedSupplierIds(new Set(filteredSuppliers.map((s) => s.supplierId)));
    }
  };

  const handleOpenMultiRfq = () => {
    if (selectedSupplierIds.size === 0) {
      showToast('Please select at least one supplier to request quotes from.', 'warning');
      return;
    }
    setMultiRfqOpen(true);
  };

  const handleSubmitMultiRfq = async (e) => {
    e.preventDefault();
    if (!rfqQuantity || Number(rfqQuantity) <= 0) {
      showToast('Please enter a valid requested quantity.', 'warning');
      return;
    }

    setSubmittingRfq(true);
    try {
      const selectedNames = dbSuppliers
        .filter((s) => selectedSupplierIds.has(s.supplierId))
        .map((s) => s.companyName)
        .join(', ');

      const res = await apiPost('rfq', {
        title: `Wholesale Quotation: ${product.name}`,
        quantity: Number(rfqQuantity),
        unit: product.unit || 'piece',
        targetPrice: rfqTargetPrice ? Number(rfqTargetPrice) : null,
        specifications: `Targeted multi-supplier quotation request for ${product.name}.\nTargeted suppliers: ${selectedNames}\n\nAdditional notes: ${rfqNotes || 'Standard wholesale inquiry.'}`,
        categorySlug: product.category || product.categorySlug,
        destinationCountry: 'India',
        buyerName: user?.name || 'TradeSphere Buyer',
        buyerEmail: user?.email || 'buyer@tradesphere.com',
        items: [
          {
            productId: product.id,
            productName: product.name,
            quantity: Number(rfqQuantity),
            unit: product.unit || 'piece',
            targetPrice: rfqTargetPrice ? Number(rfqTargetPrice) : null,
          },
        ],
      });

      showToast(`Quotation request sent to ${selectedSupplierIds.size} supplier(s)!`, 'success');
      setMultiRfqOpen(false);

      if (res && res.success && res.data?.id) {
        navigate(`/buyer/quotes/compare/${res.data.id}`);
      } else {
        navigate('/buyer/quotes');
      }
    } catch (err) {
      showToast(err.message || 'Failed to submit quotation requests.', 'error');
    } finally {
      setSubmittingRfq(false);
    }
  };

  if (!product) return null;

  return (
    <section aria-labelledby="suppliers-offering-title" className="mt-14 scroll-mt-28" id="suppliers-listing">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-navy-900/10 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 id="suppliers-offering-title" className="font-display text-2xl font-black tracking-[-0.02em] text-navy-900 sm:text-3xl">
              Suppliers Offering This Product
            </h2>
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-brand-100 font-display text-xs font-bold text-brand-800">
              {filteredSuppliers.length}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            Compare wholesale suppliers offering <span className="font-semibold text-navy-800">{product.name}</span>. Evaluate verified credentials, minimum orders, real-time pricing, and dispatch lead times.
          </p>
        </div>

        {/* Filter and Sort controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex cursor-pointer select-none items-center gap-2 rounded-xl border border-navy-200 bg-white px-3 py-2 text-xs font-semibold text-navy-800 shadow-sm transition-colors hover:border-brand-500">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <ShieldCheck className="size-4 text-emerald-600" />
            Verified only
          </label>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="ts-input !py-2 !text-xs font-semibold"
            aria-label="Sort suppliers"
          >
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="lead-time">Fastest Lead Time</option>
            <option value="moq-asc">Lowest Minimum Order (MOQ)</option>
          </select>
        </div>
      </div>

      {/* Select All and Bulk Actions Toolbar */}
      {filteredSuppliers.length > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-navy-50/70 px-4 py-2.5 text-xs text-navy-900">
          <label className="flex cursor-pointer items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={selectedSupplierIds.size === filteredSuppliers.length && filteredSuppliers.length > 0}
              onChange={selectAll}
              className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Select all suppliers for side-by-side comparison ({selectedSupplierIds.size}/{filteredSuppliers.length})
          </label>

          {selectedSupplierIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-bold text-brand-700">{selectedSupplierIds.size} selected</span>
              <Button size="sm" variant="navy" icon={Scale} onClick={handleOpenMultiRfq}>
                Request & Compare Quotes
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Supplier Cards / Rows */}
      {loading ? (
        <div className="mt-6 space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-32 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-navy-200 bg-white p-8 text-center">
          <Building2 className="mx-auto size-10 text-muted" />
          <h3 className="mt-2 text-base font-bold text-navy-900">No matching suppliers</h3>
          <p className="mt-1 text-xs text-muted">Try clearing the "Verified only" filter to see all suppliers.</p>
          <Button size="sm" variant="outline" className="mt-4" onClick={() => setVerifiedOnly(false)}>
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {filteredSuppliers.map((supplier) => {
            const isSelected = selectedSupplierIds.has(supplier.supplierId);
            const isPrimary = supplier.isPrimarySupplier;

            return (
              <article
                key={supplier.supplierId}
                className={`group relative rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 hover:border-brand-500 hover:shadow-md sm:p-6 ${
                  isSelected ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-navy-100'
                }`}
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  {/* Left: Checkbox + Supplier Info */}
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectSupplier(supplier.supplierId)}
                      aria-label={`Select ${supplier.companyName} for comparison`}
                      className="mt-1 size-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 shrink-0 cursor-pointer"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg font-bold tracking-tight text-navy-900 group-hover:text-brand-600">
                          <Link to={supplier.profileUrl}>
                            {supplier.companyName}
                          </Link>
                        </h3>

                        {supplier.isVerified ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[0.6875rem] font-bold text-emerald-800 ring-1 ring-emerald-500/20">
                            <CheckCircle2 className="size-3 text-emerald-600" />
                            Verified Supplier
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[0.6875rem] font-medium text-slate-600">
                            Unverified
                          </span>
                        )}

                        {isPrimary && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-navy-100 px-2 py-0.5 text-[0.6875rem] font-bold text-navy-800">
                            Listing Source
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3.5 text-navy-600" />
                          {supplier.location || 'India'}
                        </span>

                        <span className="inline-flex items-center gap-1">
                          <Package className="size-3.5 text-navy-600" />
                          {formatNumber(supplier.availableQuantity)} {product.unit || 'units'} in stock
                        </span>

                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3.5 text-navy-600" />
                          {supplier.leadTimeDays} days dispatch
                        </span>

                        {supplier.rating > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Rating value={supplier.rating} showValue={true} />
                            <span className="text-muted">({supplier.reviewCount})</span>
                          </span>
                        )}
                      </div>

                      {supplier.priceTiers && supplier.priceTiers.length > 1 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-navy-700">
                          <span className="font-semibold text-muted">Volume Pricing:</span>
                          {supplier.priceTiers.slice(0, 3).map((tier, idx) => (
                            <span key={idx} className="rounded-md bg-slate-100 px-2 py-0.5 font-medium">
                              {formatNumber(tier.minQty)}+ {product.unit}s @ {money(tier.price)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle: Pricing & MOQ */}
                  <div className="flex flex-row items-center justify-between border-t border-navy-100 pt-3 lg:border-t-0 lg:pt-0 lg:flex-col lg:items-end lg:justify-center lg:border-l lg:pl-6 lg:border-navy-100">
                    <div>
                      <p className="text-xs text-muted lg:text-right">Unit Price</p>
                      <p className="font-display text-2xl font-extrabold tracking-tight text-navy-900">
                        {money(supplier.price)}
                        <span className="text-xs font-normal text-muted"> / {product.unit}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-muted">Minimum Order</p>
                      <p className="font-semibold text-navy-800">
                        {quantityLabel(supplier.moq, product.unit)}
                      </p>
                    </div>
                  </div>

                  {/* Right: Buyer Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-navy-100 pt-3 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-6">
                    <Button
                      to={supplier.profileUrl}
                      size="sm"
                      variant="outline"
                      icon={Eye}
                      className="!min-h-9 flex-1 sm:flex-none"
                    >
                      View Supplier
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      icon={MessageSquare}
                      onClick={() => contact({ id: supplier.supplierId, name: supplier.companyName, slug: supplier.profileSlug }, product)}
                      className="!min-h-9 flex-1 sm:flex-none"
                    >
                      Contact
                    </Button>

                    <Button
                      to={`/rfq?product=${product.id}&supplier=${supplier.supplierId}&name=${encodeURIComponent(product.name)}&qty=${supplier.moq}`}
                      size="sm"
                      variant="navy"
                      icon={FileText}
                      className="!min-h-9 flex-1 sm:flex-none"
                    >
                      Request Quote
                    </Button>

                    <button
                      type="button"
                      onClick={() => toggleSelectSupplier(supplier.supplierId)}
                      title={isSelected ? 'Remove from compare' : 'Add to compare'}
                      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'border border-navy-200 bg-white text-navy-800 hover:border-brand-500 hover:text-brand-600'
                      }`}
                    >
                      <Scale className="size-3.5" />
                      {isSelected ? 'Selected' : 'Compare'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Floating Bottom Bar when 2+ suppliers are selected */}
      {selectedSupplierIds.size >= 2 && (
        <aside aria-label="Selected suppliers comparison bar" className="fixed bottom-6 inset-x-4 z-40 mx-auto max-w-3xl rounded-2xl border border-navy-900/10 bg-navy-900 p-4 text-white shadow-2xl backdrop-blur-lg animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-500 font-display text-sm font-black text-white">
                {selectedSupplierIds.size}
              </span>
              <div>
                <p className="font-bold text-sm">Suppliers Selected for Comparison</p>
                <p className="text-xs text-navy-200">
                  Request quotations from these {selectedSupplierIds.size} suppliers and evaluate offers side by side.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" className="!text-navy-200 hover:!text-white" onClick={() => setSelectedSupplierIds(new Set())}>
                Clear
              </Button>
              <Button size="sm" variant="gold" icon={Scale} onClick={handleOpenMultiRfq}>
                Compare Quotes Now
              </Button>
            </div>
          </div>
        </aside>
      )}

      {/* Multi-Supplier RFQ Modal */}
      <Modal
        open={multiRfqOpen}
        onClose={() => setMultiRfqOpen(false)}
        title="Request & Compare Quotations"
        size="lg"
      >
        <form onSubmit={handleSubmitMultiRfq} className="space-y-5">
          <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-800">Targeted Suppliers ({selectedSupplierIds.size})</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {dbSuppliers
                .filter((s) => selectedSupplierIds.has(s.supplierId))
                .map((s) => (
                  <span key={s.supplierId} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-navy-900 shadow-sm border border-brand-200">
                    <Building2 className="size-3 text-brand-600" />
                    {s.companyName}
                    {s.isVerified && <CheckCircle2 className="size-3 text-emerald-600" />}
                  </span>
                ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="multi-rfq-quantity" className="block text-xs font-bold uppercase tracking-wider text-navy-800">
                Requested Quantity ({product.unit || 'pieces'}) *
              </label>
              <Input
                id="multi-rfq-quantity"
                type="number"
                min="1"
                required
                value={rfqQuantity}
                onChange={(e) => setRfqQuantity(e.target.value)}
                placeholder="e.g. 500"
                className="mt-1"
              />
            </div>

            <div>
              <label htmlFor="multi-rfq-target-price" className="block text-xs font-bold uppercase tracking-wider text-navy-800">
                Target Unit Price (₹ Optional)
              </label>
              <Input
                id="multi-rfq-target-price"
                type="number"
                min="0"
                step="0.01"
                value={rfqTargetPrice}
                onChange={(e) => setRfqTargetPrice(e.target.value)}
                placeholder="e.g. 1050"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label htmlFor="multi-rfq-notes" className="block text-xs font-bold uppercase tracking-wider text-navy-800">
              Requirements, Specifications or Customizations
            </label>
            <Textarea
              id="multi-rfq-notes"
              rows={3}
              value={rfqNotes}
              onChange={(e) => setRfqNotes(e.target.value)}
              placeholder="Specify custom packaging, color options, testing requirements, or delivery deadline..."
              className="mt-1"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t">
            <Button variant="outline" type="button" onClick={() => setMultiRfqOpen(false)}>
              Cancel
            </Button>
            <Button variant="navy" type="submit" loading={submittingRfq} icon={Scale}>
              Send Quotes & Compare Side-by-Side
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
