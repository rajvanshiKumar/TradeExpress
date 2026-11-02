import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  CreditCard,
  FileText,
  Heart,
  MapPin,
  Package,
  Receipt,
  Scale,
  Search,
  ShieldAlert,
} from 'lucide-react';
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
import useWishlist from '../../hooks/useWishlist';
import useProducts from '../../hooks/useProducts';
import useCurrency from '../../hooks/useCurrency';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { formatDate } from '../../utils/formatDate';
import paymentMethodService, { isUsableCard } from '../../services/paymentMethodService';

/**
 * Profile checklist shown above Recent orders. Each step is complete only when the server confirms it:
 * at least one saved address, and at least one active, unexpired card tokenised by the payment gateway.
 */
function ProfileCompletion({ hasAddress, hasCard, loading }) {
  const [open, setOpen] = useState(true);
  const steps = [
    { key: 'address', icon: MapPin, title: 'Add your address', text: 'For free shipping on your first order', to: '/buyer/addresses', done: hasAddress },
    { key: 'payment', icon: CreditCard, title: 'Add a payment card', text: '0% processing fee on 1st order with eligible cards', to: '/buyer/payment-methods', done: hasCard },
  ];
  const completed = steps.filter((step) => step.done).length;

  return (
    <section aria-labelledby="profile-completion-title" className="ts-card overflow-hidden">
      <h2 id="profile-completion-title" className="text-base font-bold">
        <button
          type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="profile-completion-steps"
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-emerald-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600/40"
        >
          <span>Complete your profile <span className="font-semibold text-muted">({loading ? '…' : completed}/{steps.length})</span></span>
          <ChevronDown className={`size-5 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </h2>
      {open ? (
        <ul id="profile-completion-steps" className="grid grid-cols-1 gap-3 border-t px-5 py-4 md:grid-cols-2">
          {steps.map(({ key, icon: Icon, title, text, to, done }) => (
            <li key={key} className={`flex items-center gap-3 rounded-xl border p-3.5 ${done ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200/90 bg-white'}`}>
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${done ? 'bg-emerald-600 text-white' : 'bg-[#f6efe1] text-[#9a7b3c]'}`}>
                {done ? <Check className="size-5" aria-hidden="true" /> : <Icon className="size-5" aria-hidden="true" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-navy-900">{title}{done ? <span className="sr-only"> (completed)</span> : null}</p>
                <p className="truncate text-xs text-muted" title={text}>{text}</p>
              </div>
              {done ? (
                <Link to={to} className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40">Manage</Link>
              ) : (
                <Button to={to} size="sm" variant="outline" className="shrink-0" aria-label={`Add: ${title}`}>Add</Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default function BuyerDashboard() {
  const { user, addresses, addressesLoading } = useAuth();
  const { orders, loading: ordersLoading } = useOrders();
  const { inquiries, loading: inquiriesLoading } = useInquiries();
  const { count: savedCount } = useWishlist();
  const { products, recentlyViewed, loading: productsLoading } = useProducts();
  const { money } = useCurrency();
  useDocumentTitle('Buyer dashboard');

  // Saved-card status for the profile checklist; on failure the step simply stays incomplete
  const [cardState, setCardState] = useState({ loading: true, hasCard: false });
  useEffect(() => {
    let active = true;
    paymentMethodService.list()
      .then((methods) => { if (active) setCardState({ loading: false, hasCard: methods.some(isUsableCard) }); })
      .catch(() => { if (active) setCardState({ loading: false, hasCard: false }); });
    return () => { active = false; };
  }, [user.id]);

  const myOrders = orders.filter((order) => order.buyerId === user.id);
  const myQuotes = inquiries.filter((inquiry) => inquiry.buyerId === user.id);
  const openQuotes = myQuotes.filter((inquiry) => inquiry.status !== 'Closed');
  const viewed = recentlyViewed.map((id) => products.find((product) => product.id === id && product.status === 'Active')).filter(Boolean).slice(0, 12);

  return (
    <div className="space-y-6">
      <SectionHeading
        title={`Welcome back, ${user.name.split(' ')[0]}`}
        description={`${user.company || 'Enterprise Procurement Account'} · Verified Buyer`}
        actions={
          <Button to="/rfq" size="sm" icon={FileText} variant="primary">
            Request a Quote
          </Button>
        }
      />

      {/* Quick Navigation Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Link
          to="/products"
          className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white p-3 text-xs font-semibold text-slate-800 shadow-2xs hover:border-emerald-600 hover:text-emerald-900 transition-colors"
        >
          <div className="size-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
            <Search className="size-3.5" />
          </div>
          <span className="truncate">Find Products</span>
        </Link>

        <Link
          to="/compare-products"
          className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white p-3 text-xs font-semibold text-slate-800 shadow-2xs hover:border-emerald-600 hover:text-emerald-900 transition-colors"
        >
          <div className="size-7 rounded-lg bg-blue-50 text-blue-800 flex items-center justify-center shrink-0">
            <Scale className="size-3.5" />
          </div>
          <span className="truncate">Compare Items</span>
        </Link>

        <Link
          to="/buyer/payments"
          className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white p-3 text-xs font-semibold text-slate-800 shadow-2xs hover:border-emerald-600 hover:text-emerald-900 transition-colors"
        >
          <div className="size-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
            <Receipt className="size-3.5" />
          </div>
          <span className="truncate">Invoices & Escrow</span>
        </Link>

        <Link
          to="/buyer/disputes"
          className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white p-3 text-xs font-semibold text-slate-800 shadow-2xs hover:border-emerald-600 hover:text-emerald-900 transition-colors"
        >
          <div className="size-7 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
            <ShieldAlert className="size-3.5" />
          </div>
          <span className="truncate">Help & Disputes</span>
        </Link>

        <Link
          to="/buyer/addresses"
          className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white p-3 text-xs font-semibold text-slate-800 shadow-2xs hover:border-emerald-600 hover:text-emerald-900 transition-colors"
        >
          <div className="size-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <MapPin className="size-3.5" />
          </div>
          <span className="truncate">Address Book</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Package} label="Orders" value={ordersLoading ? '…' : myOrders.length} hint={`${myOrders.filter((order) => !['Delivered', 'Cancelled'].includes(order.status)).length} in progress`} to="/buyer/orders" />
        <StatCard icon={FileText} tone="brand" label="Open quote requests" value={inquiriesLoading ? '…' : openQuotes.length} hint={`${myQuotes.filter((inquiry) => inquiry.quote).length} with a quote`} to="/buyer/quotes" />
        <StatCard icon={Heart} tone="warning" label="Saved products" value={savedCount} hint="In your wishlist" to="/buyer/wishlist" />
      </div>

      <ProfileCompletion hasAddress={addresses.length > 0} hasCard={cardState.hasCard} loading={addressesLoading || cardState.loading} />

      <section aria-labelledby="recent-orders-title" className="ts-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <h2 id="recent-orders-title" className="text-base font-bold">Recent orders</h2>
          <Link to="/buyer/orders" className="text-sm font-semibold text-brand-600 hover:text-brand-700">View all</Link>
        </div>
        {ordersLoading ? <TableSkeleton rows={3} /> : myOrders.length === 0 ? (
          <EmptyState icon={Package} className="!py-10" title="No orders yet" text="Place an order to see it here." action={<Button to="/products" variant="navy" size="sm">Browse products</Button>} />
        ) : (
          <div className="overflow-x-auto ts-slim-scrollbar scroll-smooth">
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
