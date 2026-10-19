import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, CircleDollarSign, FileText, MessageSquare, Package, Plus, TriangleAlert, Crown, Check } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import SupplierGuard from './SupplierGuard';
import useOrders from '../../hooks/useOrders';
import useInquiries from '../../hooks/useInquiries';
import useMessages from '../../hooks/useMessages';
import useCurrency from '../../hooks/useCurrency';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { companyOrderValue } from '../../utils/analytics';
import { formatDate } from '../../utils/formatDate';
import { LOW_STOCK_FACTOR } from '../../utils/constants';

function Overview({ company, products }) {
  const { orders } = useOrders();
  const { inquiries } = useInquiries();
  const { unreadCount } = useMessages();
  const { money } = useCurrency();

  const myOrders = orders.filter((order) => order.items.some((item) => item.companyId === company.id));
  const revenue = myOrders.filter((order) => order.status !== 'Cancelled').reduce((sum, order) => sum + companyOrderValue(order, company.id), 0);
  const myInquiries = inquiries.filter((inquiry) => inquiry.companyId === company.id);
  const openInquiries = myInquiries.filter((inquiry) => ['Submitted', 'Viewed'].includes(inquiry.status));
  const lowStock = products.filter((product) => product.stock < product.moq * LOW_STOCK_FACTOR);
  const [showPlansModal, setShowPlansModal] = useState(false);

  return (
    <div className="space-y-8">
      <SectionHeading title={company.name} description="Supplier overview" actions={<><Button to={`/suppliers/${company.slug}`} variant="outline" size="sm">View public profile</Button><Button to="/supplier/products/new" size="sm" icon={Plus}>Add product</Button></>} />

      {/* Subscription Tier Banner */}
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm font-black text-sm">
            GOLD
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-navy-950 text-sm">Gold Merchant Membership · Active</h3>
              <span className="rounded-full bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 text-[10px]">VERIFIED TIER</span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Active Catalogue: <strong className="text-navy-900">{products.length} of 100</strong> listings used · Priority RFQ matching · 0% escrow delay
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={Crown} onClick={() => setShowPlansModal(true)}>
            View Plan Limits
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Boxes} label="Products listed" value={products.length} hint={`${products.filter((product) => product.status === 'Active').length} active`} to="/supplier/products" />
        <StatCard icon={Package} tone="brand" label="Orders" value={myOrders.length} hint={`${myOrders.filter((order) => order.status === 'Pending').length} awaiting confirmation`} to="/supplier/orders" />
        <StatCard icon={CircleDollarSign} tone="success" label="Order value" value={money(revenue)} hint="Excludes cancelled orders" to="/supplier/analytics" />
        <StatCard icon={FileText} tone="warning" label="Open inquiries" value={openInquiries.length} hint={`${unreadCount} unread ${unreadCount === 1 ? 'message' : 'messages'}`} to="/supplier/inquiries" />
      </div>

      {/* Plans Comparison Modal */}
      <Modal open={showPlansModal} onClose={() => setShowPlansModal(false)} title="TradeSphere Supplier Plans" className="max-w-2xl">
        <div className="space-y-4">
          <p className="text-xs text-muted">Compare wholesale merchant tiers and listing capacity:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Free */}
            <div className="rounded-xl border p-4 bg-white space-y-2 text-xs">
              <span className="font-bold text-slate-700">Free Tier</span>
              <p className="text-lg font-black text-navy-900">₹0 <span className="text-[10px] font-normal text-muted">/mo</span></p>
              <ul className="space-y-1.5 text-muted pt-2 border-t">
                <li className="flex items-center gap-1.5"><Check className="size-3.5 text-slate-400" /> Up to 5 listings</li>
                <li className="flex items-center gap-1.5"><Check className="size-3.5 text-slate-400" /> Standard RFQs</li>
                <li className="flex items-center gap-1.5"><Check className="size-3.5 text-slate-400" /> Standard Escrow</li>
              </ul>
            </div>

            {/* Silver */}
            <div className="rounded-xl border p-4 bg-white space-y-2 text-xs">
              <span className="font-bold text-slate-700">Silver Verified</span>
              <p className="text-lg font-black text-navy-900">₹4,999 <span className="text-[10px] font-normal text-muted">/yr</span></p>
              <ul className="space-y-1.5 text-muted pt-2 border-t">
                <li className="flex items-center gap-1.5"><Check className="size-3.5 text-blue-500" /> Up to 25 listings</li>
                <li className="flex items-center gap-1.5"><Check className="size-3.5 text-blue-500" /> Verified Badge</li>
                <li className="flex items-center gap-1.5"><Check className="size-3.5 text-blue-500" /> Priority RFQ alerts</li>
              </ul>
            </div>

            {/* Gold */}
            <div className="rounded-xl border-2 border-amber-400 bg-amber-50/50 p-4 space-y-2 text-xs relative">
              <span className="absolute -top-2.5 right-3 bg-amber-500 text-white font-bold text-[9px] px-2 py-0.5 rounded-full">ACTIVE</span>
              <span className="font-bold text-amber-900">Gold Verified</span>
              <p className="text-lg font-black text-navy-900">₹14,999 <span className="text-[10px] font-normal text-muted">/yr</span></p>
              <ul className="space-y-1.5 text-navy-900 pt-2 border-t border-amber-200">
                <li className="flex items-center gap-1.5 font-medium"><Check className="size-3.5 text-emerald-600" /> 100 listings allowed</li>
                <li className="flex items-center gap-1.5 font-medium"><Check className="size-3.5 text-emerald-600" /> Instant Escrow Payout</li>
                <li className="flex items-center gap-1.5 font-medium"><Check className="size-3.5 text-emerald-600" /> Dedicated Account Mgr</li>
                <li className="flex items-center gap-1.5 font-medium"><Check className="size-3.5 text-emerald-600" /> Top Supplier Placement</li>
              </ul>
            </div>
          </div>
        </div>
      </Modal>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="ts-card overflow-hidden" aria-labelledby="supplier-recent-orders">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 id="supplier-recent-orders" className="text-base font-bold">Recent orders</h2>
            <Link to="/supplier/orders" className="text-sm font-semibold text-brand-600 hover:text-brand-700">Manage orders</Link>
          </div>
          {myOrders.length === 0 ? <EmptyState icon={Package} className="!py-10" title="No orders yet" text="Orders that include your products will appear here." /> : (
            <ul className="divide-y border-t">
              {myOrders.slice(0, 5).map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{order.id} · {order.buyerName}</p>
                    <p className="text-xs text-muted">{formatDate(order.createdAt)} · {money(companyOrderValue(order, company.id))}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ts-card overflow-hidden" aria-labelledby="supplier-low-stock">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 id="supplier-low-stock" className="flex items-center gap-2 text-base font-bold"><TriangleAlert className="size-4 text-warning" aria-hidden="true" />Low stock</h2>
            <Link to="/supplier/products" className="text-sm font-semibold text-brand-600 hover:text-brand-700">Manage inventory</Link>
          </div>
          {lowStock.length === 0 ? <EmptyState icon={Boxes} className="!py-10" title="Stock levels look healthy" text="Products with fewer than two minimum orders in stock are listed here." /> : (
            <ul className="divide-y border-t">
              {lowStock.slice(0, 5).map((product) => (
                <li key={product.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link to={`/supplier/products/${product.id}/edit`} className="min-w-0 truncate text-sm font-semibold text-ink hover:text-brand-600">{product.name}</Link>
                  <span className={`shrink-0 text-sm font-bold ${product.stock <= 0 ? 'text-danger' : 'text-warning'}`}>{product.stock.toLocaleString('en-IN')} left</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="ts-card overflow-hidden" aria-labelledby="supplier-recent-inquiries">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 id="supplier-recent-inquiries" className="text-base font-bold">Latest inquiries</h2>
          <div className="flex gap-4">
            <Link to="/messages" className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-900 hover:text-brand-600"><MessageSquare className="size-4" aria-hidden="true" />Messages</Link>
            <Link to="/supplier/inquiries" className="text-sm font-semibold text-brand-600 hover:text-brand-700">View all</Link>
          </div>
        </div>
        {myInquiries.length === 0 ? <EmptyState icon={FileText} className="!py-10" title="No inquiries yet" text="Quote requests for your products will appear here." /> : (
          <ul className="divide-y border-t">
            {myInquiries.slice(0, 4).map((inquiry) => (
              <li key={inquiry.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{inquiry.productName}</p>
                  <p className="text-xs text-muted">{inquiry.buyerName} · {inquiry.quantity.toLocaleString('en-IN')} {inquiry.unit}s · {formatDate(inquiry.createdAt)}</p>
                </div>
                <StatusBadge status={inquiry.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function SupplierDashboard() {
  useDocumentTitle('Supplier dashboard');
  return <SupplierGuard>{(company, products) => <Overview company={company} products={products} />}</SupplierGuard>;
}
