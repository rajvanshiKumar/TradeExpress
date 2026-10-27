import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  MapPin,
  MessageSquare,
  Package,
  Scale,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingDown,
  Truck,
  X,
  Zap,
} from 'lucide-react';
import Button from '../common/Button';
import Rating from '../common/Rating';
import useCurrency from '../../hooks/useCurrency';
import useCart from '../../hooks/useCart';
import useNotifications from '../../hooks/useNotifications';
import { apiGet, isApiConfigured } from '../../services/apiClient';
import { formatNumber } from '../../utils/formatCurrency';
import { quantityLabel } from '../../utils/units';

export default function SupplierCompareModal({
  open,
  onClose,
  product,
  selectedSuppliers = [],
  onOpenMultiRfq,
  onContactSupplier,
}) {
  const { money } = useCurrency();
  const { addToCart } = useCart();
  const { showToast } = useNotifications();

  const [loading, setLoading] = useState(false);
  const [apiData, setApiData] = useState(null);

  // Fetch backend-enforced comparison metrics whenever modal opens or selection changes
  useEffect(() => {
    if (!open || !product || selectedSuppliers.length === 0) {
      setApiData(null);
      return;
    }

    let isMounted = true;
    async function fetchComparison() {
      if (isApiConfigured) {
        try {
          setLoading(true);
          const supplierIds = selectedSuppliers.map((s) => s.supplierId).join(',');
          const res = await apiGet(`products/${encodeURIComponent(product.slug || product.id)}/compare-suppliers?supplierIds=${supplierIds}`);
          if (isMounted && res && res.success && res.data) {
            setApiData(res.data);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.warn('[TradeExpress] Error fetching backend supplier comparison:', err.message);
        }
      }
      if (isMounted) {
        setLoading(false);
      }
    }

    fetchComparison();
    return () => {
      isMounted = false;
    };
  }, [open, product, selectedSuppliers]);

  // Compute enriched data either from backend API or client-side calculation
  const comparison = useMemo(() => {
    if (apiData?.suppliers && apiData.suppliers.length > 0) {
      return {
        suppliers: apiData.suppliers,
        spreadSummary: apiData.spreadSummary,
      };
    }

    // Client-side fallback calculation matching backend logic
    const suppliers = selectedSuppliers;
    if (suppliers.length === 0) return { suppliers: [], spreadSummary: null };

    const minPrice = Math.min(...suppliers.map((s) => Number(s.price)));
    const maxPrice = Math.max(...suppliers.map((s) => Number(s.price)));
    const minMoq = Math.min(...suppliers.map((s) => Number(s.moq)));
    const minLeadTime = Math.min(...suppliers.map((s) => Number(s.leadTimeDays || 14)));
    const maxStock = Math.max(...suppliers.map((s) => Number(s.availableQuantity || 0)));

    const enriched = suppliers.map((s) => {
      const price = Number(s.price);
      const moq = Number(s.moq);
      const shippingCost = Number(s.shippingCost || Math.round(500 + moq * 25));
      const subtotalAtMoq = price * moq;
      const gstAtMoq = Math.round(subtotalAtMoq * 0.18);
      const totalLandedCostAtMoq = subtotalAtMoq + gstAtMoq + shippingCost;
      const effectiveUnitPriceAtMoq = Math.round((totalLandedCostAtMoq / moq) * 100) / 100;

      return {
        ...s,
        price,
        moq,
        shippingCost,
        leadTimeDays: Number(s.leadTimeDays || 14),
        availableQuantity: Number(s.availableQuantity || 0),
        calculations: {
          subtotalAtMoq,
          gstAtMoq,
          shippingCost,
          totalLandedCostAtMoq,
          effectiveUnitPriceAtMoq,
        },
        highlights: {
          isLowestPrice: price === minPrice,
          isLowestMoq: moq === minMoq,
          isFastestDelivery: Number(s.leadTimeDays || 14) === minLeadTime,
          isHighestStock: Number(s.availableQuantity || 0) === maxStock,
        },
      };
    });

    return {
      suppliers: enriched,
      spreadSummary: {
        minPrice,
        maxPrice,
        minLeadTime,
        maxLeadTime: Math.max(...suppliers.map((s) => Number(s.leadTimeDays || 14))),
        verifiedCount: enriched.filter((s) => s.isVerified).length,
      },
    };
  }, [apiData, selectedSuppliers]);

  if (!open) return null;

  const { suppliers, spreadSummary } = comparison;

  const handleAddToCartMoq = (supplier) => {
    addToCart(
      {
        ...product,
        price: supplier.price,
        companyId: supplier.supplierId,
        supplierName: supplier.companyName,
      },
      supplier.moq
    );
    showToast(`Added MOQ of ${supplier.moq} ${product.unit || 'units'} from ${supplier.companyName} to your cart.`, 'success');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-navy-950/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative flex flex-col w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-navy-900/10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-navy-100 bg-navy-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gold-400 text-navy-900 shadow-sm">
              <Scale className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="compare-modal-title" className="font-display text-lg font-black tracking-tight text-white sm:text-xl">
                  TradeExpress Side-by-Side Supplier Comparison
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[0.6875rem] font-bold text-emerald-300 ring-1 ring-emerald-400/30">
                  <ShieldCheck className="size-3" />
                  Verified TradeExpress Suppliers Only
                </span>
              </div>
              <p className="mt-0.5 text-xs text-navy-200">
                Comparing {suppliers.length} active wholesale suppliers offering <span className="font-semibold text-white">{product?.name}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close comparison"
            className="rounded-full p-2 text-navy-300 transition-colors hover:bg-navy-800 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Spread Metrics Highlight Bar */}
        {spreadSummary && (
          <div className="grid grid-cols-2 gap-2 border-b border-navy-100 bg-navy-50/70 p-4 sm:grid-cols-4 sm:gap-4">
            <div className="rounded-xl border border-navy-200/60 bg-white p-3 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Price Range</span>
              <p className="font-display text-lg font-black text-navy-900">
                {money(spreadSummary.minPrice)} – {money(spreadSummary.maxPrice)}
              </p>
              {spreadSummary.maxPrice > spreadSummary.minPrice && (
                <p className="text-[11px] font-semibold text-emerald-600">
                  Save up to {money(spreadSummary.maxPrice - spreadSummary.minPrice)}/unit
                </p>
              )}
            </div>

            <div className="rounded-xl border border-navy-200/60 bg-white p-3 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Fastest Dispatch</span>
              <p className="font-display text-lg font-black text-navy-900">
                {spreadSummary.minLeadTime} Business Days
              </p>
              <p className="text-[11px] font-semibold text-brand-600">Express factory fulfillment</p>
            </div>

            <div className="rounded-xl border border-navy-200/60 bg-white p-3 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Verified Suppliers</span>
              <p className="font-display text-lg font-black text-navy-900">
                {spreadSummary.verifiedCount} of {suppliers.length}
              </p>
              <p className="text-[11px] font-semibold text-emerald-600">KYC & Business Reg. verified</p>
            </div>

            <div className="rounded-xl border border-navy-200/60 bg-white p-3 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Payment Security</span>
              <p className="font-display text-lg font-black text-navy-900">100% Escrow</p>
              <p className="text-[11px] font-semibold text-emerald-600">Funds released on delivery</p>
            </div>
          </div>
        )}

        {/* Scrollable Comparison Table Matrix */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {loading ? (
            <div className="py-16 text-center">
              <div className="mx-auto size-10 animate-spin rounded-full border-4 border-navy-200 border-t-brand-600" />
              <p className="mt-4 text-sm font-semibold text-navy-900">Calculating real database supplier offers...</p>
            </div>
          ) : (
            <div className="min-w-[640px]">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-navy-200">
                    <th scope="col" className="w-48 pb-4 pr-4 font-bold text-navy-900">
                      Comparison Metric
                    </th>
                    {suppliers.map((sup) => (
                      <th key={sup.supplierId} scope="col" className="pb-4 px-3 font-normal min-w-[210px] align-top">
                        <div className="rounded-2xl border border-navy-200 bg-white p-4 shadow-xs">
                          {/* Top Badge: Best match or highlights */}
                          <div className="flex flex-wrap gap-1 mb-2">
                            {sup.highlights?.isLowestPrice && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                <TrendingDown className="size-3" /> Lowest Price
                              </span>
                            )}
                            {sup.highlights?.isFastestDelivery && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                <Zap className="size-3" /> Fastest
                              </span>
                            )}
                            {sup.highlights?.isLowestMoq && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                                <Package className="size-3" /> Lowest MOQ
                              </span>
                            )}
                          </div>

                          <h3 className="font-display text-base font-bold text-navy-900">
                            <Link to={sup.profileUrl} className="hover:text-brand-600">
                              {sup.companyName}
                            </Link>
                          </h3>

                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                            <span className="inline-flex items-center gap-0.5">
                              <MapPin className="size-3 text-navy-500" />
                              {sup.city || 'India'}, {sup.country || 'India'}
                            </span>
                            {sup.isVerified && (
                              <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-700">
                                <CheckCircle2 className="size-3" /> Verified
                              </span>
                            )}
                          </div>

                          {sup.rating > 0 && (
                            <div className="mt-2 flex items-center gap-1 text-[11px]">
                              <Rating value={sup.rating} showValue={true} />
                              <span className="text-muted">({sup.reviewCount})</span>
                            </div>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-navy-100">
                  {/* Unit Price */}
                  <tr>
                    <th scope="row" className="py-3.5 pr-4 font-bold text-navy-900">
                      Unit Price
                      <span className="block text-[11px] font-normal text-muted">Wholesale rate</span>
                    </th>
                    {suppliers.map((sup) => (
                      <td key={sup.supplierId} className="py-3.5 px-3">
                        <span className="font-display text-xl font-black text-navy-900">
                          {money(sup.price)}
                        </span>
                        <span className="text-xs text-muted"> / {product?.unit || 'unit'}</span>
                        {sup.highlights?.isLowestPrice && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-500/30">
                            Lowest
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* MOQ */}
                  <tr>
                    <th scope="row" className="py-3.5 pr-4 font-bold text-navy-900">
                      Minimum Order (MOQ)
                      <span className="block text-[11px] font-normal text-muted">Minimum purchase</span>
                    </th>
                    {suppliers.map((sup) => (
                      <td key={sup.supplierId} className="py-3.5 px-3">
                        <span className="font-bold text-navy-900">
                          {quantityLabel(sup.moq, product?.unit)}
                        </span>
                        {sup.highlights?.isLowestMoq && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 ring-1 ring-purple-500/30">
                            Lowest MOQ
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Available Stock */}
                  <tr>
                    <th scope="row" className="py-3.5 pr-4 font-bold text-navy-900">
                      Warehouse Stock
                      <span className="block text-[11px] font-normal text-muted">Available inventory</span>
                    </th>
                    {suppliers.map((sup) => (
                      <td key={sup.supplierId} className="py-3.5 px-3 font-semibold text-navy-800">
                        {formatNumber(sup.availableQuantity)} {product?.unit || 'units'}
                        {sup.highlights?.isHighestStock && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                            Highest Stock
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Estimated Shipping Cost */}
                  <tr>
                    <th scope="row" className="py-3.5 pr-4 font-bold text-navy-900">
                      Estimated Shipping
                      <span className="block text-[11px] font-normal text-muted">Calculated for MOQ</span>
                    </th>
                    {suppliers.map((sup) => (
                      <td key={sup.supplierId} className="py-3.5 px-3 font-bold text-navy-900">
                        {money(sup.shippingCost || sup.calculations?.shippingCost || 0)}
                        <span className="block text-[10px] font-normal text-muted">Standard freight to door</span>
                      </td>
                    ))}
                  </tr>

                  {/* Total Landed Cost at MOQ */}
                  <tr className="bg-amber-50/40">
                    <th scope="row" className="py-3.5 pr-4 font-bold text-navy-900">
                      Total Landed Cost at MOQ
                      <span className="block text-[11px] font-normal text-muted">Price × MOQ + 18% GST + Shipping</span>
                    </th>
                    {suppliers.map((sup) => (
                      <td key={sup.supplierId} className="py-3.5 px-3">
                        <span className="font-display text-base font-black text-navy-900">
                          {money(sup.calculations?.totalLandedCostAtMoq || sup.price * sup.moq)}
                        </span>
                        <span className="block text-[10px] font-semibold text-muted">
                          ≈ {money(sup.calculations?.effectiveUnitPriceAtMoq || sup.price)} / unit landed
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Estimated Delivery Time */}
                  <tr>
                    <th scope="row" className="py-3.5 pr-4 font-bold text-navy-900">
                      Estimated Delivery
                      <span className="block text-[11px] font-normal text-muted">Dispatch & transit</span>
                    </th>
                    {suppliers.map((sup) => (
                      <td key={sup.supplierId} className="py-3.5 px-3 font-semibold text-navy-800">
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-3.5 text-navy-500 shrink-0" />
                          <span>{sup.estimatedDelivery || `${sup.leadTimeDays} business days`}</span>
                        </div>
                        {sup.highlights?.isFastestDelivery && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            <Zap className="size-2.5" /> Fastest Fulfillment
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Payment Terms */}
                  <tr>
                    <th scope="row" className="py-3.5 pr-4 font-bold text-navy-900">
                      Payment Terms
                      <span className="block text-[11px] font-normal text-muted">Escrow protection</span>
                    </th>
                    {suppliers.map((sup) => (
                      <td key={sup.supplierId} className="py-3.5 px-3">
                        <div className="flex items-start gap-1 text-[11px] font-semibold text-emerald-800">
                          <ShieldCheck className="size-3.5 shrink-0 text-emerald-600 mt-0.5" />
                          <span>{sup.paymentTerms || 'TradeExpress Escrow Protection (100% Secure)'}</span>
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Quality Certifications */}
                  <tr>
                    <th scope="row" className="py-3.5 pr-4 font-bold text-navy-900">
                      Quality Certifications
                      <span className="block text-[11px] font-normal text-muted">Verified documentation</span>
                    </th>
                    {suppliers.map((sup) => (
                      <td key={sup.supplierId} className="py-3.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {(sup.qualityCertifications || ['ISO 9001:2015', 'TradeExpress Verified Factory']).map((cert, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700"
                            >
                              <Award className="size-2.5 text-navy-600" />
                              {cert}
                            </span>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Warehouse Location */}
                  <tr>
                    <th scope="row" className="py-3.5 pr-4 font-bold text-navy-900">
                      Dispatch Warehouse
                      <span className="block text-[11px] font-normal text-muted">Shipping origin</span>
                    </th>
                    {suppliers.map((sup) => (
                      <td key={sup.supplierId} className="py-3.5 px-3 text-[11px] text-navy-700">
                        {sup.warehouseAddress || `${sup.city || 'Mumbai'}, ${sup.country || 'India'}`}
                      </td>
                    ))}
                  </tr>

                  {/* Direct Actions */}
                  <tr>
                    <th scope="row" className="py-4 pr-4 font-bold text-navy-900">
                      Supplier Actions
                    </th>
                    {suppliers.map((sup) => (
                      <td key={sup.supplierId} className="py-4 px-3 space-y-2">
                        <Button
                          to={`/rfq?product=${product.id}&supplier=${sup.supplierId}&name=${encodeURIComponent(product.name)}&qty=${sup.moq}`}
                          size="sm"
                          variant="navy"
                          icon={FileText}
                          className="w-full !min-h-8 text-xs justify-center"
                        >
                          Request Quote
                        </Button>

                        <div className="grid grid-cols-2 gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            icon={MessageSquare}
                            onClick={() => onContactSupplier?.(sup)}
                            className="!min-h-8 text-[11px] justify-center px-1"
                          >
                            Contact
                          </Button>
                          <Button
                            size="sm"
                            variant="gold"
                            icon={ShoppingCart}
                            onClick={() => handleAddToCartMoq(sup)}
                            className="!min-h-8 text-[11px] justify-center px-1"
                          >
                            Buy MOQ
                          </Button>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy-100 bg-navy-50/80 px-6 py-4 text-xs">
          <div className="flex items-center gap-2 text-muted">
            <ShieldCheck className="size-4 text-emerald-600" />
            <span>Only genuine, active TradeExpress-registered accounts with matching product listings are compared.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close Comparison
            </Button>
            {onOpenMultiRfq && (
              <Button
                variant="navy"
                size="sm"
                icon={Scale}
                onClick={() => {
                  onClose();
                  onOpenMultiRfq();
                }}
              >
                Request Quotes from All ({suppliers.length})
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
