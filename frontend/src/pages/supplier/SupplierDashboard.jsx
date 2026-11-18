import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes,
  CircleDollarSign,
  FileText,
  Package,
  Plus,
  TriangleAlert,
  MessageSquare,
  Scale,
  ShieldCheck,
  Truck,
  ClipboardList,
  ArrowRight,
} from 'lucide-react';
import Button from '../../components/common/Button';
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
import { fetchSupplierInventory } from '../../api/supplierInventoryApi';
import SupplierInsights, { DASH_CARD } from '../../components/supplier/SupplierInsights';
import { dailyTrendFromOrders } from '../../utils/supplierInsights';

// Shared look for the overview's cards and buttons (TradeExpress greens, soft border and shadow)
const DASH_PILL = 'inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-sm font-semibold transition-[background-color,border-color,box-shadow,color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#047857]';

// Icon tints (light container + coloured glyph), as in the reference design
const TINTS = {
  mint: 'bg-[#ECFDF5] text-[#047857] ring-1 ring-emerald-600/10',
  blue: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/10',
  amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/10',
  slate: 'bg-slate-100 text-slate-700 ring-1 ring-slate-500/10',
  solid: 'bg-[#064E3B] text-white shadow-[0_6px_14px_-8px_rgba(6,78,59,0.8)]',
};

/** Restrained decorative curves behind the header (purely visual). */
function MintCurves({ className = '' }) {
  return (
    <svg className={`pointer-events-none ${className}`} viewBox="0 0 640 220" fill="none" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 220C150 150 330 40 640 10" stroke="currentColor" strokeWidth="46" strokeLinecap="round" opacity="0.6" />
      <path d="M120 230C260 170 430 90 660 70" stroke="currentColor" strokeWidth="18" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

/** Metric card for the overview; values come straight from the existing metrics. */
function DashStat({ icon: Icon, tint = 'mint', label, value, hint, to }) {
  return (
    <Link
      to={to}
      className={`${DASH_CARD} group relative flex h-full flex-col overflow-hidden p-5 transition-[border-color,box-shadow] duration-150 hover:border-emerald-600/40 hover:shadow-[0_14px_30px_-16px_rgba(6,78,59,0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#047857]`}
    >
      {/* soft mint wave in the corner */}
      <svg className="pointer-events-none absolute -bottom-px -right-px h-16 w-40 text-emerald-500/[0.13]" viewBox="0 0 160 64" fill="none" aria-hidden="true">
        <path d="M160 0C120 30 70 52 0 64H160V0Z" fill="currentColor" />
      </svg>
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[0.9375rem] font-semibold leading-snug text-[#142D24]">{label}</p>
        <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl ${TINTS[tint]}`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      <p className="relative mt-3 break-words font-display text-[2rem] font-extrabold leading-tight tracking-[-0.03em] text-[#142D24]">{value}</p>
      {hint ? <p className="relative mt-auto pt-1.5 text-[0.8125rem] text-[#64748B]">{hint}</p> : null}
    </Link>
  );
}

function Overview({ company, products }) {
  const { user } = useAuth();
  const { orders } = useOrders();
  const { inquiries } = useInquiries();
  const { unreadCount: unreadMessages } = useMessages();
  const { money } = useCurrency();
  const { products: allCatalogueProducts, getCompany } = useProducts();

  const [liveData, setLiveData] = useState(null);
  const [loadingLive, setLoadingLive] = useState(true);

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

  // Inventory health uses the Real-Time Inventory figures (same stock rules as that page)
  const [inventoryHealth, setInventoryHealth] = useState(null);
  useEffect(() => {
    let mounted = true;
    fetchSupplierInventory({ page: 1, limit: 1 })
      .then((res) => {
        const m = res?.metrics;
        if (!mounted || !m) return;
        setInventoryHealth({ inStock: Math.max(0, m.totalProducts - m.lowStockCount - m.outOfStockCount), lowStock: m.lowStockCount, outOfStock: m.outOfStockCount });
      })
      .catch(() => { if (mounted) setInventoryHealth('offline'); });
    return () => { mounted = false; };
  }, []); // once per visit (no repeat requests)
  // Offline fallback: this browser's catalogue with the same available-vs-alert-level rule
  const healthFigures = useMemo(() => {
    if (inventoryHealth !== 'offline') return inventoryHealth;
    const counts = { inStock: 0, lowStock: 0, outOfStock: 0 };
    for (const p of products || []) {
      const available = Number(p.stock) || 0;
      if (available <= 0) counts.outOfStock += 1;
      else if (available <= Number(p.lowStockThreshold ?? 10)) counts.lowStock += 1;
      else counts.inStock += 1;
    }
    return counts;
  }, [inventoryHealth, products]);
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

  const fallbackTopProducts = useMemo(() => {
    const stats = new Map();
    for (const o of myOrders) {
      if (o.status === 'Cancelled') continue;
      for (const item of o.items || []) {
        if (item.companyId !== company.id) continue;
        const id = item.productId || item.id;
        const row = stats.get(id) || { productId: id, name: item.name, sku: item.sku || null, photo: item.photo || null, unit: item.unit || 'piece', orderIds: new Set(), units: 0, sales: 0 };
        row.orderIds.add(o.id);
        row.units += Number(item.quantity || 0);
        row.sales += Number(item.price || 0) * Number(item.quantity || 0);
        stats.set(id, row);
      }
    }
    return [...stats.values()].map(({ orderIds, ...r }) => ({ ...r, orders: orderIds.size }))
      .sort((a, b) => b.sales - a.sales || b.orders - a.orders).slice(0, 5);
  }, [myOrders, company.id]);
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

  const quickActions = [
    { to: '/supplier/products/new', icon: Plus, tint: 'mint', label: 'Add Product' },
    { to: '/messages', icon: MessageSquare, tint: 'mint', label: 'Messages', badge: unreadMessages > 0 ? (unreadMessages > 99 ? '99+' : unreadMessages) : null },
    { to: '/supplier/inquiries', icon: ClipboardList, tint: 'blue', label: `Buyer RFQs (${metrics.openInquiriesCount})` },
    { to: '/supplier/transport', icon: Truck, tint: 'amber', label: `Fulfillment (${metrics.pendingOrders})` },
    { to: '/supplier/payments', icon: CircleDollarSign, tint: 'mint', label: 'Escrow & Payments' },
    { to: '/supplier/verification', icon: ShieldCheck, tint: 'slate', label: 'Verification Status' },
  ];

  const aadhaarLast4 = user?.aadhaarLast4 || company.aadhaarLast4;
  const credentials = [
    { label: 'Legal Entity Name', value: company.name || user?.company || 'Supplier Entity', accent: true },
    { label: 'GSTIN Number', value: verification.gstin || company.gstin || '—', mono: true },
    { label: 'PAN Number', value: verification.pan || company.pan || '—', mono: true },
    { label: 'Aadhaar (Masked)', value: aadhaarLast4 ? `•••• •••• ${aadhaarLast4}` : '—', mono: true },
  ];

  return (
    <div className="space-y-6 lg:space-y-7">
      {/* Header: company name, subtitle and primary actions on a subtle mint backdrop */}
      <section className="relative isolate">
        <MintCurves className="absolute right-0 -top-10 -z-10 h-40 w-[min(40rem,90%)] text-emerald-200/70 sm:-top-14 sm:h-48" />
        <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words font-display text-[1.75rem] font-extrabold leading-tight tracking-[-0.03em] text-[#142D24] sm:text-[2.25rem]">
              {company.name || 'TradeExpress Supplier HQ'}
            </h1>
            <p className="mt-1 text-[0.9375rem] text-[#64748B]">Supplier Enterprise Command Center</p>
          </div>
          <div className="flex flex-wrap gap-3 sm:shrink-0">
            <Link to={`/suppliers/${company.slug || company.id}`} className={`${DASH_PILL} border border-[#E2E8E5] bg-white text-[#142D24] shadow-[0_6px_16px_-10px_rgba(20,45,36,0.35)] hover:border-[#047857]/50 hover:text-[#064E3B]`}>
              View Public Catalog
            </Link>
            <Link to="/supplier/products/new" className={`${DASH_PILL} bg-gradient-to-b from-[#047857] to-[#064E3B] text-white shadow-[0_8px_18px_-8px_rgba(6,78,59,0.75)] hover:from-[#065F46] hover:to-[#064E3B]`}>
              <Plus className="size-[1.125rem]" aria-hidden="true" />
              Add New Product
            </Link>
          </div>
        </div>
      </section>

      {/* Quick actions: six in a row on wide screens, labels kept on one line where space permits */}
      <nav aria-label="Quick actions" className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6">
        {quickActions.map(({ to, icon: Icon, tint, label, badge }) => (
          <Link
            key={to}
            to={to}
            className={`${DASH_CARD} group relative flex min-h-[4.25rem] items-center gap-2.5 px-3 py-3 transition-[border-color,box-shadow] duration-150 hover:border-emerald-600/40 hover:shadow-[0_12px_26px_-16px_rgba(6,78,59,0.4)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#047857] sm:px-3.5`}
          >
            <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors ${TINTS[tint]}`}>
              <Icon className="size-[1.125rem]" aria-hidden="true" />
            </span>
            <span className="min-w-0 text-[0.8125rem] font-semibold leading-tight text-[#142D24] sm:whitespace-nowrap sm:text-sm">{label}</span>
            {badge ? (
              <span className="absolute -right-1.5 -top-1.5 rounded-full bg-[#047857] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white ring-2 ring-white">
                <span className="sr-only">Unread messages: </span>{badge}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      {/* Key metrics (existing calculations) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashStat icon={Boxes} tint="solid" label="Catalog Products" value={metrics.totalProducts}
          hint={`${metrics.activeProducts} active · ${metrics.pendingApproval || 0} pending review`} to="/supplier/products" />
        <DashStat icon={Package} label="Purchase Orders" value={metrics.totalOrders}
          hint={`${metrics.pendingOrders} awaiting fulfillment`} to="/supplier/orders" />
        <DashStat icon={CircleDollarSign} label="Gross Confirmed Sales" value={money(metrics.grossSales)}
          hint={`${money(metrics.pendingPayouts || 0)} held in escrow`} to="/supplier/payments" />
        <DashStat icon={FileText} tint="amber" label="Buyer RFQs" value={metrics.openInquiriesCount}
          hint={`${metrics.openQuotations} open quotes · ${metrics.expiringQuotations} expiring`} to="/supplier/inquiries" />
      </div>

      {/* Statutory Compliance & Identity Verification */}
      <section className={`${DASH_CARD} px-5 py-5 sm:px-7`} aria-labelledby="supplier-compliance">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <ShieldCheck className="mt-0.5 size-7 shrink-0 text-[#047857]" aria-hidden="true" />
            <div className="min-w-0">
              <h2 id="supplier-compliance" className="text-base font-bold text-[#142D24] sm:text-lg">
                Statutory Compliance & Identity Credential Status
              </h2>
              <p className="mt-0.5 text-[0.8125rem] text-[#64748B]">Verified business credentials and PAN-Aadhaar linkage status.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-700">
              Code: <span className="font-mono">{verification.supplierCode}</span>
            </span>
            {/* Shown only when the backend marks the supplier verified */}
            {verification.isVerified ? (
              <span className="rounded-full bg-emerald-100 px-3.5 py-1.5 text-xs font-semibold text-emerald-800">✓ Verified Merchant</span>
            ) : null}
            <Link
              to="/supplier/verification"
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 px-3.5 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
            >
              Review Documents
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-y-4 border-t border-[#E2E8E5] pt-4 sm:grid-cols-2 lg:grid-cols-5 lg:divide-x lg:divide-[#E2E8E5]">
          {credentials.map(({ label, value, mono, accent }) => (
            <div key={label} className="min-w-0 lg:px-5 lg:first:pl-0">
              <dt className="text-[0.8125rem] text-[#64748B]">{label}:</dt>
              <dd className={`mt-1 break-words text-[0.9375rem] font-semibold ${accent ? 'text-[#047857]' : 'text-[#142D24]'} ${mono ? 'font-mono' : ''}`}>{value}</dd>
            </div>
          ))}
          <div className="min-w-0 lg:px-5 lg:last:pr-0">
            <dt className="text-[0.8125rem] text-[#64748B]">PAN–Aadhaar Link:</dt>
            <dd className="mt-1.5">
              {verification.panAadhaarStatus === 'LINKED' ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  ✓ Linked {verification.panAadhaarMaskedPan ? `(${verification.panAadhaarMaskedPan})` : ''}
                </span>
              ) : verification.panAadhaarStatus === 'NOT_LINKED' ? (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">⚠ Not Linked</span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Not Checked</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {/* Trends, RFQ status, top products, inventory health */}
      {loadingLive ? (
        <div className={`${DASH_CARD} h-64 animate-pulse bg-[#F8FAF8]`} aria-hidden="true" />
      ) : (
        <SupplierInsights
          dailyTrend={liveData?.salesTrend || dailyTrendFromOrders(myOrders, (o) => companyOrderValue(o, company.id))}
          topProducts={liveData?.topProducts || fallbackTopProducts}
          inquiries={myInquiries}
          inventoryHealth={healthFigures}
          money={money}
        />
      )}

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
                    className={`shrink-0 text-xs font-bold ${product.stock <= 0 ? 'text-danger' : 'text-amber-700'
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
    </div>
  );
}

export default function SupplierDashboard() {
  useDocumentTitle('Supplier Dashboard · TradeExpress');
  return <SupplierGuard>{(company, products) => <Overview company={company} products={products} />}</SupplierGuard>;
}


