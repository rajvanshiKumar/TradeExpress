import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes,
  CircleDollarSign,
  FileText,
  MessageSquare,
  Package,
  Plus,
  TriangleAlert,
  Crown,
  Check,
  Scale,
  TrendingUp,
  ShieldCheck,
  Truck,
  ClipboardList,
  ArrowRight,
  ExternalLink,
  Percent,
} from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import SupplierGuard from './SupplierGuard';
import useOrders from '../../hooks/useOrders';
import useAuth from '../../hooks/useAuth';
import useInquiries from '../../hooks/useInquiries';
import useMessages from '../../hooks/useMessages';
import useCurrency from '../../hooks/useCurrency';
import useProducts from '../../hooks/useProducts';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { companyOrderValue } from '../../utils/analytics';
import { formatDate } from '../../utils/formatDate';
import { LOW_STOCK_FACTOR } from '../../utils/constants';
import { fetchSupplierOverview } from '../../services/supplierDashboardApi';

function Overview({ company, products }) {
  const { user } = useAuth();
  const { orders } = useOrders();
  const { inquiries } = useInquiries();
  const { unreadCount } = useMessages();
  const { money } = useCurrency();
  const { products: allCatalogueProducts, getCompany } = useProducts();

  const [liveData, setLiveData] = useState(null);
  const [loadingLive, setLoadingLive] = useState(true);
  const [showPlansModal, setShowPlansModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchSupplierOverview()
      .then((res) => {
        if (mounted && res) {
          setLiveData(res);
        }
      })
      .catch((err) => {
        console.warn('Supplier live overview load notice:', err.message);
      })
      .finally(() => {
        if (mounted) setLoadingLive(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Compute fallback or live metrics
  const myOrders = orders.filter((order) => order.items.some((item) => item.companyId === company.id));
  const fallbackRevenue = myOrders.filter((order) => order.status !== 'Cancelled').reduce((sum, order) => sum + companyOrderValue(order, company.id), 0);
  const myInquiries = inquiries.filter((inquiry) => inquiry.companyId === company.id);
  const fallbackLowStock = products.filter((product) => product.stock < product.moq * LOW_STOCK_FACTOR);

  const metrics = liveData?.metrics || {
    totalProducts: products.length,
    activeProducts: products.filter((p) => p.status === 'Active').length,
    pendingApproval: 0,
    rejectedProducts: 0,
    lowStockCount: fallbackLowStock.length,
    totalOrders: myOrders.length,
    pendingOrders: myOrders.filter((o) => ['Pending', 'Processing'].includes(o.status)).length,
    completedOrders: myOrders.filter((o) => o.status === 'Delivered').length,
    grossSales: fallbackRevenue,
    pendingPayouts: 0,
    releasedPayouts: fallbackRevenue,
    netEarnings: Math.round(fallbackRevenue * 0.975),
    openInquiriesCount: myInquiries.length,
    openQuotations: 0,
    expiringQuotations: 0,
    unreadMessages: unreadCount,
  };

  const verification = liveData?.verification || {
    isVerified: company.isVerified || user?.isVerified,
    isPhoneVerified: user?.isPhoneVerified,
    kycStatus: user?.kycStatus || 'NOT_SUBMITTED',
    panAadhaarStatus: company.panAadhaarStatus || user?.panAadhaarStatus || 'NOT_STARTED',
    panAadhaarLinked: company.panAadhaarLinked || user?.panAadhaarLinked,
    panAadhaarMaskedPan: company.panAadhaarMaskedPan || user?.panAadhaarMaskedPan,
    gstin: company.gstin || user?.gstin,
    pan: company.pan || user?.pan,
    supplierCode: company.supplierCode || user?.supplierCode || 'SUP-ACTIVE',
  };

  const recentOrders = liveData?.recentOrders || myOrders.slice(0, 5).map((o) => ({
    id: o.id,
    orderNumber: o.id,
    buyerName: o.buyerName,
    buyerCompany: o.buyerCompany,
    total: companyOrderValue(o, company.id),
    orderStatus: o.status,
    paymentStatus: o.paymentStatus || 'PAID',
    createdAt: o.createdAt,
    firstProduct: o.items?.[0]?.name || 'Order product',
  }));

  const recentInquiries = liveData?.recentInquiries || myInquiries.slice(0, 5);
  const lowStockAlerts = liveData?.lowStockAlerts || fallbackLowStock.slice(0, 5);

  // Competitor benchmarking
  const marketCompetitors = useMemo(() => {
    if (!products || products.length === 0) return [];
    const otherProducts = (allCatalogueProducts || []).filter((p) => p.companyId !== company.id);
    const results = [];

    for (const myProd of products.slice(0, 3)) {
      const qTokens = myProd.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const competing = otherProducts.filter((other) => {
        const sameCat = (other.categorySlug || other.category) === (myProd.categorySlug || myProd.category);
        const nameMatch = qTokens.some((t) => other.name.toLowerCase().includes(t));
        return sameCat || nameMatch;
      });

      if (competing.length > 0) {
        const seenCompanies = new Set();
        const distinct = [];
        for (const c of competing) {
          const cCompany = c.companyId ? getCompany(c.companyId) : null;
          const key = c.companyId || cCompany?.id;
          if (key && !seenCompanies.has(key)) {
            seenCompanies.add(key);
            distinct.push({
              ...c,
              companyName: cCompany?.name || 'TradeExpress Seller',
              flag: cCompany?.flag || '🇮🇳',
              location: cCompany?.country || 'India',
            });
          }
        }
        results.push({
          myProduct: myProd,
          competingListings: distinct.slice(0, 4),
        });
      }
    }
    return results;
  }, [products, allCatalogueProducts, company.id, getCompany]);

  return (
    <div className="space-y-8">
      <SectionHeading
        title={company.name || 'TradeExpress Supplier HQ'}
        description="Supplier Enterprise Command Center"
        actions={
          <>
            <Button to={`/suppliers/${company.slug || company.id}`} variant="outline" size="sm">
              View Public Catalog
            </Button>
            <Button to="/supplier/products/new" size="sm" icon={Plus} variant="primary">
              Add New Product
            </Button>
          </>
        }
      />

      {/* Quick Action Navigation Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Link
          to="/supplier/products/new"
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-navy-950 shadow-2xs hover:border-emerald-600 hover:text-emerald-800 transition-colors"
        >
          <div className="size-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
            <Plus className="size-4" />
          </div>
          <span>Add Product</span>
        </Link>

        <Link
          to="/supplier/quotations"
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-navy-950 shadow-2xs hover:border-emerald-600 hover:text-emerald-800 transition-colors"
        >
          <div className="size-7 rounded-lg bg-blue-50 text-blue-800 flex items-center justify-center shrink-0">
            <ClipboardList className="size-4" />
          </div>
          <span>My Quotations ({metrics.openQuotations})</span>
        </Link>

        <Link
          to="/supplier/shipping"
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-navy-950 shadow-2xs hover:border-emerald-600 hover:text-emerald-800 transition-colors"
        >
          <div className="size-7 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
            <Truck className="size-4" />
          </div>
          <span>Fulfillment ({metrics.pendingOrders})</span>
        </Link>

        <Link
          to="/supplier/payments"
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-navy-950 shadow-2xs hover:border-emerald-600 hover:text-emerald-800 transition-colors"
        >
          <div className="size-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
            <CircleDollarSign className="size-4" />
          </div>
          <span>Escrow & Payouts</span>
        </Link>

        <Link
          to="/supplier/verification"
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-navy-950 shadow-2xs hover:border-emerald-600 hover:text-emerald-800 transition-colors"
        >
          <div className="size-7 rounded-lg bg-slate-50 text-slate-800 flex items-center justify-center shrink-0">
            <ShieldCheck className="size-4" />
          </div>
          <span>Verification Status</span>
        </Link>
      </div>

      {/* Tier Banner */}
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm font-black text-sm">
            GOLD
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-navy-950 text-sm">Gold Merchant Membership · Active</h3>
              <span className="rounded-full bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 text-[10px]">
                {verification.isVerified ? 'VERIFIED MERCHANT' : 'KYC PENDING'}
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Active Catalogue: <strong className="text-navy-900">{metrics.activeProducts} of {metrics.totalProducts}</strong> listings active · Priority buyer inquiries · Direct Escrow
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={Crown} onClick={() => setShowPlansModal(true)}>
            View Plan Limits
          </Button>
        </div>
      </div>

      {/* 4-Card Primary Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          icon={Boxes}
          label="Catalog Products"
          value={metrics.totalProducts}
          hint={`${metrics.activeProducts} active · ${metrics.pendingApproval || 0} pending review`}
          to="/supplier/products"
        />
        <StatCard
          icon={Package}
          tone="brand"
          label="Purchase Orders"
          value={metrics.totalOrders}
          hint={`${metrics.pendingOrders} awaiting fulfillment`}
          to="/supplier/orders"
        />
        <StatCard
          icon={CircleDollarSign}
          tone="success"
          label="Gross Confirmed Sales"
          value={money(metrics.grossSales)}
          hint={`${money(metrics.pendingPayouts || 0)} held in escrow`}
          to="/supplier/payments"
        />
        <StatCard
          icon={FileText}
          tone="warning"
          label="Buyer Inquiries & Quotes"
          value={metrics.openInquiriesCount}
          hint={`${metrics.openQuotations} open quotes · ${metrics.expiringQuotations} expiring`}
          to="/supplier/quotations"
        />
      </div>

      {/* Statutory Compliance & Identity Verification Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
          <div>
            <h3 className="font-bold text-navy-950 text-sm flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-700" />
              Statutory Compliance & Identity Credential Status
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Verified business credentials and PAN-Aadhaar linkage status.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-mono font-semibold text-slate-700">
              Code: {verification.supplierCode}
            </span>
            <Link
              to="/supplier/verification"
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                verification.isVerified
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {verification.isVerified ? '✓ Verified Merchant' : 'Review Documents →'}
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
          <div>
            <span className="text-muted block">Legal Entity Name:</span>
            <span className="font-semibold text-navy-900">{company.name || user?.company || 'Supplier Entity'}</span>
          </div>
          <div>
            <span className="text-muted block">GSTIN Number:</span>
            <span className="font-mono font-semibold text-navy-900">
              {verification.gstin || company.gstin || '—'}
            </span>
          </div>
          <div>
            <span className="text-muted block">PAN Number:</span>
            <span className="font-mono font-semibold text-navy-900">
              {verification.pan || company.pan || '—'}
            </span>
          </div>
          <div>
            <span className="text-muted block">Aadhaar (Masked):</span>
            <span className="font-mono font-semibold text-navy-900">
              {user?.aadhaarLast4 || company.aadhaarLast4
                ? `•••• •••• ${user?.aadhaarLast4 || company.aadhaarLast4}`
                : '—'}
            </span>
          </div>
          <div>
            <span className="text-muted block">PAN–Aadhaar Link:</span>
            <span className="inline-flex items-center gap-1 mt-0.5">
              {verification.panAadhaarStatus === 'LINKED' ? (
                <span className="rounded-full bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 text-[11px]">
                  ✓ Linked {verification.panAadhaarMaskedPan ? `(${verification.panAadhaarMaskedPan})` : ''}
                </span>
              ) : verification.panAadhaarStatus === 'NOT_LINKED' ? (
                <span className="rounded-full bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 text-[11px]">
                  ⚠ Not Linked
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 text-slate-500 font-medium px-2 py-0.5 text-[11px]">
                  Not Checked
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Orders & Low Stock Tables */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Recent Orders */}
        <section className="ts-card overflow-hidden" aria-labelledby="supplier-recent-orders">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 id="supplier-recent-orders" className="text-sm font-bold text-navy-950">
              Recent Purchase Orders
            </h2>
            <Link to="/supplier/orders" className="text-xs font-semibold text-emerald-800 hover:text-emerald-900">
              Manage all orders →
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <EmptyState
              icon={Package}
              className="!py-10"
              title="No orders placed yet"
              text="When buyers purchase your products, orders appear here with fulfillment workflows."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentOrders.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50/50">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-navy-900">
                      {order.orderNumber} · {order.buyerCompany || order.buyerName}
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">
                      {formatDate(order.createdAt)} · {money(order.total)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <StatusBadge status={order.orderStatus} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Low Stock Alerts */}
        <section className="ts-card overflow-hidden" aria-labelledby="supplier-low-stock">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 id="supplier-low-stock" className="flex items-center gap-2 text-sm font-bold text-navy-950">
              <TriangleAlert className="size-4 text-warning" aria-hidden="true" />
              <span>Low-Stock Inventory Alerts</span>
            </h2>
            <Link to="/supplier/products" className="text-xs font-semibold text-emerald-800 hover:text-emerald-900">
              Update inventory →
            </Link>
          </div>
          {lowStockAlerts.length === 0 ? (
            <EmptyState
              icon={Boxes}
              className="!py-10"
              title="Inventory levels are healthy"
              text="No products are currently below safety threshold levels."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {lowStockAlerts.map((product) => (
                <li key={product.id} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50/50">
                  <Link
                    to={`/supplier/products/${product.id}/edit`}
                    className="min-w-0 truncate text-xs font-bold text-navy-900 hover:text-emerald-700"
                  >
                    {product.name}
                  </Link>
                  <span
                    className={`shrink-0 text-xs font-bold ${
                      product.stock <= 0 ? 'text-danger' : 'text-amber-700'
                    }`}
                  >
                    {product.stock.toLocaleString('en-IN')} {product.unit || 'units'} left
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Competitor Benchmarking */}
      {marketCompetitors.length > 0 && (
        <section className="ts-card overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-navy-900/[0.08] bg-navy-50/30">
            <div>
              <h2 className="text-sm font-bold text-navy-950 flex items-center gap-2">
                <Scale className="size-4 text-emerald-800" />
                <span>Live Marketplace Wholesale Price Intelligence</span>
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Real-time competitor pricing and MOQ comparisons against other verified TradeExpress sellers.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={Scale}
              to="/compare-products"
              className="text-xs font-semibold shrink-0"
            >
              Full Comparison View
            </Button>
          </div>

          <div className="p-5 space-y-4">
            {marketCompetitors.map(({ myProduct, competingListings }) => (
              <div key={myProduct.id} className="rounded-xl border border-navy-900/[0.08] p-4 bg-white space-y-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5">
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                      Your Product Listing
                    </span>
                    <h3 className="font-bold text-sm text-navy-950 truncate">{myProduct.name}</h3>
                    <p className="text-xs text-navy-600">
                      Your Base Price: <strong className="text-navy-950">{money(myProduct.price)}</strong> · MOQ: <strong>{myProduct.moq} {myProduct.unit || 'units'}</strong>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    to={`/compare-products?search=${encodeURIComponent(myProduct.name)}`}
                    className="text-xs font-semibold shrink-0"
                  >
                    Compare Sellers
                  </Button>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-muted block mb-2">
                    Competing Sellers in this Category:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {competingListings.map((comp) => {
                      const isLowerPrice = comp.price < myProduct.price;
                      return (
                        <div key={comp.id} className="rounded-lg border bg-slate-50/60 p-2.5 text-xs space-y-1">
                          <span className="font-bold text-navy-900 truncate block">
                            {comp.flag} {comp.companyName}
                          </span>
                          <p className="text-[11px] text-muted truncate">{comp.name}</p>
                          <div className="flex items-baseline justify-between pt-1 border-t">
                            <span className={`font-black ${isLowerPrice ? 'text-amber-700' : 'text-emerald-700'}`}>
                              {money(comp.price)}
                            </span>
                            <span className="text-[10px] text-muted">MOQ: {comp.moq}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Plans Modal */}
      <Modal open={showPlansModal} onClose={() => setShowPlansModal(false)} title="TradeExpress Supplier Plans" className="max-w-2xl">
        <div className="space-y-4 text-xs">
          <p className="text-muted">Compare wholesale merchant tiers and listing capacity:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border p-4 bg-white space-y-2">
              <span className="font-bold text-slate-700">Free Tier</span>
              <p className="text-lg font-black text-navy-900">₹0 <span className="text-[10px] font-normal text-muted">/mo</span></p>
              <ul className="space-y-1.5 text-muted pt-2 border-t text-[11px]">
                <li className="flex items-center gap-1.5"><Check className="size-3.5 text-slate-400" /> Up to 5 listings</li>
                <li className="flex items-center gap-1.5"><Check className="size-3.5 text-slate-400" /> Standard RFQs</li>
                <li className="flex items-center gap-1.5"><Check className="size-3.5 text-slate-400" /> Standard Escrow</li>
              </ul>
            </div>

            <div className="rounded-xl border p-4 bg-white space-y-2">
              <span className="font-bold text-slate-700">Silver Verified</span>
              <p className="text-lg font-black text-navy-900">₹4,999 <span className="text-[10px] font-normal text-muted">/yr</span></p>
              <ul className="space-y-1.5 text-muted pt-2 border-t text-[11px]">
                <li className="flex items-center gap-1.5"><Check className="size-3.5 text-blue-500" /> Up to 25 listings</li>
                <li className="flex items-center gap-1.5"><Check className="size-3.5 text-blue-500" /> Verified Badge</li>
                <li className="flex items-center gap-1.5"><Check className="size-3.5 text-blue-500" /> Priority RFQ alerts</li>
              </ul>
            </div>

            <div className="rounded-xl border-2 border-amber-400 bg-amber-50/50 p-4 space-y-2 relative">
              <span className="absolute -top-2.5 right-3 bg-amber-500 text-white font-bold text-[9px] px-2 py-0.5 rounded-full">
                ACTIVE
              </span>
              <span className="font-bold text-amber-900">Gold Verified</span>
              <p className="text-lg font-black text-navy-900">₹14,999 <span className="text-[10px] font-normal text-muted">/yr</span></p>
              <ul className="space-y-1.5 text-navy-900 pt-2 border-t border-amber-200 text-[11px]">
                <li className="flex items-center gap-1.5 font-medium"><Check className="size-3.5 text-emerald-600" /> 100 listings allowed</li>
                <li className="flex items-center gap-1.5 font-medium"><Check className="size-3.5 text-emerald-600" /> Instant Escrow Payout</li>
                <li className="flex items-center gap-1.5 font-medium"><Check className="size-3.5 text-emerald-600" /> Dedicated Account Mgr</li>
                <li className="flex items-center gap-1.5 font-medium"><Check className="size-3.5 text-emerald-600" /> Top Supplier Placement</li>
              </ul>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function SupplierDashboard() {
  useDocumentTitle('Supplier Dashboard · TradeExpress');
  return <SupplierGuard>{(company, products) => <Overview company={company} products={products} />}</SupplierGuard>;
}
