import { Link } from 'react-router-dom';
import { Boxes, CircleDollarSign, FileText, MessageSquare, Package, Plus, TriangleAlert } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import Button from '../../components/common/Button';
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

  return (
    <div className="space-y-8">
      <SectionHeading title={company.name} description="Supplier overview" actions={<><Button to={`/suppliers/${company.slug}`} variant="outline" size="sm">View public profile</Button><Button to="/supplier/products/new" size="sm" icon={Plus}>Add product</Button></>} />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Boxes} label="Products listed" value={products.length} hint={`${products.filter((product) => product.status === 'Active').length} active`} to="/supplier/products" />
        <StatCard icon={Package} tone="brand" label="Orders" value={myOrders.length} hint={`${myOrders.filter((order) => order.status === 'Pending').length} awaiting confirmation`} to="/supplier/orders" />
        <StatCard icon={CircleDollarSign} tone="success" label="Order value" value={money(revenue)} hint="Excludes cancelled orders" to="/supplier/analytics" />
        <StatCard icon={FileText} tone="warning" label="Open inquiries" value={openInquiries.length} hint={`${unreadCount} unread ${unreadCount === 1 ? 'message' : 'messages'}`} to="/supplier/inquiries" />
      </div>

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
