import { Link } from 'react-router-dom';
import { FileText, Heart, MessageSquare, Package } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import Button from '../../components/common/Button';
import { StatusBadge } from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { TableSkeleton } from '../../components/common/Skeleton';
import ProductGrid from '../../components/products/ProductGrid';
import useAuth from '../../hooks/useAuth';
import useOrders from '../../hooks/useOrders';
import useInquiries from '../../hooks/useInquiries';
import useMessages from '../../hooks/useMessages';
import useWishlist from '../../hooks/useWishlist';
import useProducts from '../../hooks/useProducts';
import useCurrency from '../../hooks/useCurrency';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { formatDate } from '../../utils/formatDate';

export default function BuyerDashboard() {
  const { user } = useAuth();
  const { orders, loading: ordersLoading } = useOrders();
  const { inquiries, loading: inquiriesLoading } = useInquiries();
  const { unreadCount } = useMessages();
  const { count: savedCount } = useWishlist();
  const { products, recentlyViewed, loading: productsLoading } = useProducts();
  const { money } = useCurrency();
  useDocumentTitle('Buyer dashboard');

  const myOrders = orders.filter((order) => order.buyerId === user.id);
  const myQuotes = inquiries.filter((inquiry) => inquiry.buyerId === user.id);
  const openQuotes = myQuotes.filter((inquiry) => inquiry.status !== 'Closed');
  const viewed = recentlyViewed.map((id) => products.find((product) => product.id === id && product.status === 'Active')).filter(Boolean).slice(0, 4);

  return (
    <div className="space-y-8">
      <SectionHeading title={`Welcome back, ${user.name.split(' ')[0]}`} description={`${user.company || 'Buyer account'} · Buyer account`} actions={<Button to="/rfq" size="sm" icon={FileText}>Request a Quote</Button>} />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Package} label="Orders" value={ordersLoading ? '…' : myOrders.length} hint={`${myOrders.filter((order) => !['Delivered', 'Cancelled'].includes(order.status)).length} in progress`} to="/buyer/orders" />
        <StatCard icon={FileText} tone="brand" label="Open quote requests" value={inquiriesLoading ? '…' : openQuotes.length} hint={`${myQuotes.filter((inquiry) => inquiry.quote).length} with a quote`} to="/buyer/quotes" />
        <StatCard icon={MessageSquare} tone="success" label="Unread messages" value={unreadCount} hint="Supplier conversations" to="/messages" />
        <StatCard icon={Heart} tone="warning" label="Saved products" value={savedCount} hint="In your wishlist" to="/buyer/wishlist" />
      </div>

      <section aria-labelledby="recent-orders-title" className="ts-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <h2 id="recent-orders-title" className="text-base font-bold">Recent orders</h2>
          <Link to="/buyer/orders" className="text-sm font-semibold text-brand-600 hover:text-brand-700">View all</Link>
        </div>
        {ordersLoading ? <TableSkeleton rows={3} /> : myOrders.length === 0 ? (
          <EmptyState icon={Package} className="!py-10" title="No orders yet" text="Place an order to see it here." action={<Button to="/products" variant="navy" size="sm">Browse products</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="ts-table">
              <thead><tr><th scope="col">Order</th><th scope="col">Date</th><th scope="col">Items</th><th scope="col">Total</th><th scope="col">Status</th></tr></thead>
              <tbody>
                {myOrders.slice(0, 5).map((order) => (
                  <tr key={order.id}>
                    <td><Link to={`/buyer/orders?order=${order.id}`} className="font-semibold text-navy-900 hover:text-brand-600">{order.id}</Link></td>
                    <td className="whitespace-nowrap text-muted">{formatDate(order.createdAt)}</td>
                    <td className="max-w-56 truncate">{order.items.map((item) => item.name).join(', ')}</td>
                    <td className="whitespace-nowrap font-semibold">{money(order.totals.total)}</td>
                    <td><StatusBadge status={order.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="recent-quotes-title" className="ts-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <h2 id="recent-quotes-title" className="text-base font-bold">Latest quote requests</h2>
          <Link to="/buyer/quotes" className="text-sm font-semibold text-brand-600 hover:text-brand-700">View all</Link>
        </div>
        {inquiriesLoading ? <TableSkeleton rows={3} /> : myQuotes.length === 0 ? (
          <EmptyState icon={FileText} className="!py-10" title="No quote requests yet" text="Ask a supplier for pricing on your exact quantity." action={<Button to="/rfq" variant="navy" size="sm">Request a Quote</Button>} />
        ) : (
          <ul className="divide-y border-t">
            {myQuotes.slice(0, 4).map((inquiry) => (
              <li key={inquiry.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{inquiry.productName}</p>
                  <p className="text-xs text-muted">{inquiry.id} · {formatDate(inquiry.createdAt)} · {inquiry.quantity.toLocaleString('en-IN')} {inquiry.unit}s</p>
                </div>
                <div className="flex items-center gap-3">
                  {inquiry.quote ? <span className="text-sm font-semibold text-success">{money(inquiry.quote.unitPrice)} / {inquiry.unit}</span> : null}
                  <StatusBadge status={inquiry.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="recently-viewed-title">
        <h2 id="recently-viewed-title" className="mb-4 text-base font-bold">Recently viewed</h2>
        <ProductGrid products={viewed} loading={productsLoading} skeletonCount={4} columns="grid grid-cols-1 gap-4 xs:grid-cols-2 sm:gap-6 xl:grid-cols-4" emptyTitle="Nothing viewed yet" emptyText="Products you open will be listed here." emptyAction={<Button to="/products" variant="navy" size="sm">Browse products</Button>} />
      </section>
    </div>
  );
}
