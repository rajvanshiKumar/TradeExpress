import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Ban, FileText, Filter, Package, RotateCcw, Search, Truck, Wallet, XCircle,
} from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import { StatusBadge } from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import Skeleton from '../../components/common/Skeleton';
import CustomSelect from '../../components/common/CustomSelect';
import Pagination from '../../components/common/Pagination';
import Image from '../../components/common/Image';
import OrderDetails from '../../components/forms/OrderDetails';
import TaxInvoiceModal from '../../components/common/TaxInvoiceModal';
import useAuth from '../../hooks/useAuth';
import useOrders from '../../hooks/useOrders';
import useCart from '../../hooks/useCart';
import useProducts from '../../hooks/useProducts';
import useCurrency from '../../hooks/useCurrency';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import {
  BUYER_ORDER_STATUSES, amountDue, canCancelOrder, canShowInvoice, canTrackOrder, hasPendingPayment, paymentDisplay,
} from '../../utils/orderStatus';

const PAGE_SIZE = 10;
const DAY = 24 * 60 * 60 * 1000;

const DATE_OPTIONS = [
  { value: '', label: 'All time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 3 months' },
  { value: '365', label: 'Last 12 months' },
];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'total-desc', label: 'Total: high to low' },
  { value: 'total-asc', label: 'Total: low to high' },
];
const PAYMENT_OPTIONS = [
  { value: '', label: 'All payments' },
  { value: 'due', label: 'Payment pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'not-charged', label: 'Not charged' },
];

const matchesPayment = (order, filter) => {
  if (!filter) return true;
  if (filter === 'due') return hasPendingPayment(order);
  const { code, label } = paymentDisplay(order);
  if (filter === 'not-charged') return label === 'Not charged';
  return code === filter;
};

/** A summary card; clicking it applies the matching filter. */
function SummaryCard({ icon: Icon, label, value, hint, tone, active, onClick, loading }) {
  const tones = {
    green: 'bg-emerald-900 text-emerald-100',
    amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    red: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group flex w-full items-start justify-between gap-3 rounded-2xl border bg-white p-4 text-left shadow-[0_1px_2px_rgb(16_24_39/0.04),0_8px_24px_-12px_rgb(16_24_39/0.12)] transition hover:-translate-y-px hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 ${active ? 'border-emerald-700 ring-1 ring-emerald-700/30' : 'border-slate-200/80'}`}
    >
      <span className="min-w-0">
        <span className="block text-[0.8125rem] font-semibold text-slate-500">{label}</span>
        <span className="mt-2 block font-display text-3xl font-extrabold tracking-tight text-navy-950">
          {loading ? <Skeleton className="h-8 w-14" /> : value}
        </span>
        <span className="mt-1 block text-xs text-slate-500">{loading ? ' ' : hint}</span>
      </span>
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
    </button>
  );
}

/** Product thumbnails of an order (up to two), with the first product's name. */
function OrderItems({ order }) {
  const items = order.items || [];
  const units = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  return (
    <div className="flex min-w-44 max-w-56 items-center gap-2.5">
      <div className="flex shrink-0 -space-x-3">
        {items.slice(0, 2).map((item, index) => (
          <Image
            key={`${item.productId || item.name}-${index}`}
            photo={item.photo}
            illustration={item.illustration}
            width={80}
            height={80}
            alt=""
            className="size-10 rounded-lg border-2 border-white bg-slate-100 object-cover shadow-xs"
          />
        ))}
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 text-[0.8125rem] font-semibold leading-snug text-navy-950" title={items.map((item) => item.name).join(', ')}>
          {items[0]?.name || 'Order items'}
        </p>
        <p className="text-xs text-slate-500">
          {items.length > 1 ? `+${items.length - 1} more · ` : ''}{units.toLocaleString('en-IN')} unit{units === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  );
}

/**
 * An order action (pill button, as in the design): Reorder is the filled primary, the others are outlined.
 * A link when `to` is given. Clicking it never opens the order row behind it.
 */
function Action({ icon: Icon, label, onClick, to, tone = 'default', srLabel }) {
  const toneClass = tone === 'primary'
    ? 'border-emerald-900 bg-emerald-900 text-white shadow-[0_6px_16px_-8px_rgb(6_78_59/0.7)] hover:bg-emerald-800'
    : tone === 'danger'
      ? 'border-rose-200 bg-white text-rose-700 shadow-[0_2px_8px_-4px_rgb(16_24_39/0.18)] hover:bg-rose-50'
      : 'border-slate-200 bg-white text-navy-950 shadow-[0_2px_8px_-4px_rgb(16_24_39/0.18)] hover:border-emerald-700 hover:text-emerald-900';
  const className = `inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full border px-4 text-[0.8125rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 ${toneClass}`;
  const body = <><Icon className="size-4 shrink-0" aria-hidden="true" />{label}</>;
  const stop = (event) => event.stopPropagation();
  return to
    ? <Link to={to} onClick={stop} className={className} aria-label={srLabel}>{body}</Link>
    : <button type="button" onClick={(event) => { stop(event); onClick(); }} className={className} aria-label={srLabel}>{body}</button>;
}

export default function BuyerOrders() {
  const { user } = useAuth();
  const { orders, loading, error, reload, refresh, cancelOrder, markAllOrdersSeen, markOrderSeen } = useOrders();
  // Opening this page refreshes only its own data (orders), quietly and without duplicate requests
  useEffect(() => { refresh(); }, [refresh]);
  const { money } = useCurrency();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { getProduct } = useProducts();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [payment, setPayment] = useState('');
  const [range, setRange] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [cancelId, setCancelId] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState(null);
  useDocumentTitle('My orders');

  // Mark all orders as seen when viewing the My Orders page
  useEffect(() => {
    if (user?.id && markAllOrdersSeen) markAllOrdersSeen();
  }, [user?.id, markAllOrdersSeen, orders.length]);

  const mine = useMemo(() => orders.filter((order) => order.buyerId === user.id), [orders, user.id]);

  // Summary figures, counted from every order the server returned for this buyer
  const stats = useMemo(() => {
    const due = mine.filter(hasPendingPayment);
    const open = mine.filter((order) => !['Delivered', 'Cancelled', 'Refunded'].includes(order.status));
    return {
      total: mine.length,
      open: open.length,
      pendingPayments: due.length,
      amountDue: due.reduce((sum, order) => sum + amountDue(order), 0),
      cancelled: mine.filter((order) => order.status === 'Cancelled').length,
    };
  }, [mine]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const since = range ? Date.now() - Number(range) * DAY : null;
    const list = mine.filter((order) => {
      if (status && order.status !== status) return false;
      if (!matchesPayment(order, payment)) return false;
      if (since && new Date(order.createdAt).getTime() < since) return false;
      if (!q) return true;
      const text = `${order.id} ${order.orderNumber || ''} ${(order.items || []).map((item) => `${item.name} ${item.sku || ''}`).join(' ')}`;
      return text.toLowerCase().includes(q);
    });
    const time = (order) => new Date(order.createdAt).getTime() || 0;
    const total = (order) => Number(order.totals?.total) || 0;
    const sorters = {
      newest: (a, b) => time(b) - time(a),
      oldest: (a, b) => time(a) - time(b),
      'total-desc': (a, b) => total(b) - total(a),
      'total-asc': (a, b) => total(a) - total(b),
    };
    return [...list].sort(sorters[sort] || sorters.newest);
  }, [mine, search, status, payment, range, sort]);

  // Any change of filter or sort starts again at page 1; a page past the end (after a cancellation) moves back
  useEffect(() => { setPage(1); }, [search, status, payment, range, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filtersActive = Boolean(search || status || payment || range);
  const clearFilters = () => { setSearch(''); setStatus(''); setPayment(''); setRange(''); };

  const openId = searchParams.get('order');
  const selected = mine.find((order) => order.id === openId) ?? null;
  const open = (id) => {
    setSearchParams(id ? { order: id } : {});
    if (id && markOrderSeen) markOrderSeen(id);
  };

  const cancelTarget = mine.find((order) => order.id === cancelId) ?? null;
  const cancel = async () => {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);
    try {
      await cancelOrder(cancelTarget.id);
      showToast(`Order ${cancelTarget.id} cancelled.`, 'success');
      setCancelId(null);
    } catch (err) {
      showToast(err?.message || 'The order could not be cancelled. Please try again.', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleReorder = (order) => {
    for (const item of order.items) {
      const prod = getProduct(item.productId || item.id) || {
        id: item.productId || item.id,
        name: item.name,
        moq: item.quantity,
        stock: 99999,
        unit: item.unit || 'piece',
        priceTiers: [{ min: 1, price: item.unitPrice }],
      };
      addToCart(prod, item.quantity, item.variant || null);
    }
    navigate('/cart');
  };

  const actionsFor = (order) => (
    <>
      {canShowInvoice(order) ? <Action icon={FileText} label="Invoice" onClick={() => setSelectedInvoiceOrder(order)} srLabel={`Invoice for order ${order.id}`} /> : null}
      <Action icon={RotateCcw} label="Reorder" tone="primary" onClick={() => handleReorder(order)} srLabel={`Reorder items from order ${order.id}`} />
      {canTrackOrder(order) ? <Action icon={Truck} label="Track" to={`/track/${order.orderNumber || order.id}`} srLabel={`Track order ${order.id}`} /> : null}
      {canCancelOrder(order) ? <Action icon={Ban} label="Cancel" tone="danger" onClick={() => setCancelId(order.id)} srLabel={`Cancel order ${order.id}`} /> : null}
    </>
  );

  // The whole row / card opens the order (date, payment, totals and everything else); Enter or Space as well
  const rowProps = (order) => ({
    role: 'button',
    tabIndex: 0,
    'aria-label': `Open order ${order.id}`,
    onClick: () => open(order.id),
    onKeyDown: (event) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(order.id); }
    },
  });

  return (
    <div className="space-y-4">
      <SectionHeading title="My Orders" description="Track your orders, payments and invoices in one place." />

      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={Package} tone="green" label="Total Orders" loading={loading && !mine.length}
          value={stats.total.toLocaleString('en-IN')} hint={`${stats.open} in progress`}
          active={!filtersActive} onClick={clearFilters}
        />
        <SummaryCard
          icon={Wallet} tone="amber" label="Pending Payments" loading={loading && !mine.length}
          value={stats.pendingPayments.toLocaleString('en-IN')} hint={stats.pendingPayments ? `${money(stats.amountDue)} due` : 'Nothing due'}
          active={payment === 'due' && !status} onClick={() => { clearFilters(); setPayment('due'); }}
        />
        <SummaryCard
          icon={XCircle} tone="red" label="Cancelled Orders" loading={loading && !mine.length}
          value={stats.cancelled.toLocaleString('en-IN')} hint="Not charged or refunded"
          active={status === 'Cancelled' && !payment} onClick={() => { clearFilters(); setStatus('Cancelled'); }}
        />
      </div>

      <section aria-labelledby="orders-list-title" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(16_24_39/0.04),0_8px_24px_-12px_rgb(16_24_39/0.12)]">
        <h2 id="orders-list-title" className="sr-only">Order list</h2>
        {/* Announced to screen readers when the search or filters change; not shown */}
        <p className="sr-only" aria-live="polite">{loading && !mine.length ? '' : `${filtered.length} order${filtered.length === 1 ? '' : 's'} found`}</p>

        {/* Search, filters and sorting */}
        <div className="grid grid-cols-1 gap-2.5 border-b border-slate-100 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]">
          <div className="relative sm:col-span-2 xl:col-span-1">
            <label htmlFor="order-search" className="sr-only">Search orders</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="order-search" type="search" className="ts-input pl-9" placeholder="Search order ID, product or SKU"
              value={search} onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <CustomSelect id="order-status" aria-label="Order status" searchable={false} value={status} onChange={(event) => setStatus(event.target.value)}
            options={[{ value: '', label: 'All statuses' }, ...BUYER_ORDER_STATUSES.map((item) => ({ value: item, label: item }))]} />
          <CustomSelect id="order-payment" aria-label="Payment status" searchable={false} value={payment} onChange={(event) => setPayment(event.target.value)} options={PAYMENT_OPTIONS} />
          <CustomSelect id="order-date" aria-label="Order date" searchable={false} value={range} onChange={(event) => setRange(event.target.value)} options={DATE_OPTIONS} />
          <CustomSelect id="order-sort" aria-label="Sort orders" searchable={false} value={sort} onChange={(event) => setSort(event.target.value)} options={SORT_OPTIONS} />
        </div>

        <div className="px-2 pb-2 pt-1 sm:px-3">
          {error && !mine.length ? (
            <ErrorState text={error} onRetry={reload} />
          ) : loading && !mine.length ? (
            <div className="space-y-3 p-3" role="status" aria-label="Loading orders">
              {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : mine.length === 0 ? (
            <EmptyState icon={Package} title="No orders yet" text="Use Buy Now or add products to your cart to place an order." action={<Button to="/products" variant="navy">Browse products</Button>} />
          ) : filtered.length === 0 ? (
            <EmptyState icon={Filter} title="No matching orders" text="Try a different search, status, payment or date range." action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>} />
          ) : (
            <>
              {/* Wide screens: table (click a row to see the full order) */}
              <div className="hidden overflow-x-auto ts-slim-scrollbar xl:block">
                <table className="w-full border-separate border-spacing-0 text-left text-sm">
                  <caption className="sr-only">Your orders. Select an order to see its date, payment and totals.</caption>
                  <thead>
                    <tr className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-slate-500">
                      <th scope="col" className="border-b border-slate-100 px-3 py-3 font-bold">Order ID</th>
                      <th scope="col" className="border-b border-slate-100 px-3 py-3 font-bold">Items</th>
                      <th scope="col" className="border-b border-slate-100 px-3 py-3 font-bold">Status</th>
                      <th scope="col" className="border-b border-slate-100 px-3 py-3 text-right font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((order) => (
                      <tr key={order.id} {...rowProps(order)} className="group cursor-pointer align-middle outline-none transition-colors hover:bg-emerald-50/50 focus-visible:bg-emerald-50/70">
                        <td className="whitespace-nowrap border-b border-slate-100 px-3 py-3">
                          <span className="font-mono text-[0.8125rem] font-bold text-navy-950 group-hover:text-emerald-800">{order.id}</span>
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3"><OrderItems order={order} /></td>
                        <td className="border-b border-slate-100 px-3 py-3"><StatusBadge status={order.status} /></td>
                        <td className="border-b border-slate-100 px-3 py-3">
                          <div className="ml-auto grid w-max grid-cols-2 gap-2">{actionsFor(order)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Phones, tablets and laptops: one card per order (two per row from tablets); tap a card to open it */}
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:hidden">
                {visible.map((order) => (
                  <li key={order.id} {...rowProps(order)} className="flex cursor-pointer flex-col rounded-xl border border-slate-200 p-4 outline-none transition-colors hover:border-emerald-700/50 hover:bg-emerald-50/30 focus-visible:ring-2 focus-visible:ring-emerald-600/40">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-mono text-[0.8125rem] font-bold text-navy-950">{order.id}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="mb-3 mt-2.5"><OrderItems order={order} /></div>
                    <div className="mt-auto grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">{actionsFor(order)}</div>
                  </li>
                ))}
              </ul>

              <div className="flex justify-center px-2 pb-1 pt-3">
                <Pagination page={page} pageCount={pageCount} onChange={(next) => { setPage(next); document.getElementById('orders-list-title')?.closest('section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} />
              </div>
            </>
          )}
          {error && mine.length ? (
            <p role="alert" className="mx-2 mb-2 flex items-center justify-between gap-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              <span>The latest orders could not be loaded. Showing the last loaded list.</span>
              <button type="button" onClick={reload} className="font-bold underline">Try again</button>
            </p>
          ) : null}
        </div>
      </section>

      <Modal open={Boolean(selected)} onClose={() => open('')} title="Order details" size="lg">
        {selected ? <OrderDetails order={selected} trackDelivery={canTrackOrder(selected)} highlightShipment={searchParams.get('shipment') || ''} /> : null}
      </Modal>
      <ConfirmDialog
        open={Boolean(cancelId)}
        onCancel={() => setCancelId(null)}
        onConfirm={cancel}
        title="Cancel this order?"
        text={`Order ${cancelId} will be cancelled and any reserved stock released. Orders can be cancelled only before they are packed.`}
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        loading={cancelling}
      />
      <TaxInvoiceModal
        order={selectedInvoiceOrder}
        isOpen={Boolean(selectedInvoiceOrder)}
        onClose={() => setSelectedInvoiceOrder(null)}
        defaultRole="buyer"
      />
    </div>
  );
}
