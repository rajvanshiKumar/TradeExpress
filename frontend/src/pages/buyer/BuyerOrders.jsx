import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Eye, Package, Search, Truck, RotateCcw, FileText } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import { StatusBadge } from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import { TableSkeleton } from '../../components/common/Skeleton';
import CustomSelect from '../../components/common/CustomSelect';
import OrderDetails from '../../components/forms/OrderDetails';
import TaxInvoiceModal from '../../components/common/TaxInvoiceModal';
import { printTaxInvoice } from '../../utils/taxInvoiceGenerator';
import useAuth from '../../hooks/useAuth';
import useOrders from '../../hooks/useOrders';
import useCart from '../../hooks/useCart';
import useProducts from '../../hooks/useProducts';
import useCurrency from '../../hooks/useCurrency';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { ORDER_STATUSES } from '../../utils/constants';
import { formatDate } from '../../utils/formatDate';
import { getPaymentMethod, getPaymentStatus } from '../../utils/payments';

export default function BuyerOrders() {
  const { user } = useAuth();
  const { orders, loading, error, reload, updateOrderStatus, markAllOrdersSeen, markOrderSeen } = useOrders();
  const { money } = useCurrency();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { getProduct } = useProducts();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [cancelId, setCancelId] = useState(null);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState(null);
  useDocumentTitle('My orders');

  // Mark all orders as seen when viewing the My Orders page
  useEffect(() => {
    if (user?.id && markAllOrdersSeen) {
      markAllOrdersSeen();
    }
  }, [user?.id, markAllOrdersSeen, orders.length]);

  const mine = useMemo(() => orders.filter((order) => order.buyerId === user.id), [orders, user.id]);
  const visible = mine.filter((order) => {
    if (status && order.status !== status) return false;
    const q = search.trim().toLowerCase();
    return !q || `${order.id} ${order.items.map((item) => item.name).join(' ')}`.toLowerCase().includes(q);
  });

  const openId = searchParams.get('order');
  const selected = mine.find((order) => order.id === openId) ?? null;
  const open = (id) => {
    setSearchParams(id ? { order: id } : {});
    if (id && markOrderSeen) {
      markOrderSeen(id);
    }
  };

  const cancel = () => {
    updateOrderStatus(cancelId, 'Cancelled');
    showToast(`Order ${cancelId} cancelled.`, 'info');
    setCancelId(null);
  };

  const handleReorder = (order) => {
    let count = 0;
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
      count++;
    }
    showToast(`Added ${count} product(s) from order ${order.id} to your cart.`, 'success');
    navigate('/cart');
  };

  const handlePrintOrderInvoice = (order) => {
    setSelectedInvoiceOrder(order);
  };

  return (
    <div>
      <SectionHeading title="My orders" description="Your orders and their payment status." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="order-search" className="sr-only">Search orders</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input id="order-search" type="search" className="ts-input pl-9" placeholder="Search by order ID or product" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <label htmlFor="order-status" className="sr-only">Filter by status</label>
        <div className="sm:w-52">
          <CustomSelect
            id="order-status"
            aria-label="Filter by status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={[
              { value: '', label: 'All statuses' },
              ...ORDER_STATUSES.map((item) => ({ value: item, label: item }))
            ]}
          />
        </div>
      </div>

      <div className="ts-card overflow-hidden">
        {error ? <ErrorState text={error} onRetry={reload} /> : loading ? <TableSkeleton /> : mine.length === 0 ? (
          <EmptyState icon={Package} title="No orders yet" text="Use Buy Now or add products to your cart to place an order." action={<Button to="/products" variant="navy">Browse products</Button>} />
        ) : visible.length === 0 ? (
          <EmptyState icon={Search} title="No matching orders" text="Try a different search or status." action={<Button variant="outline" onClick={() => { setSearch(''); setStatus(''); }}>Clear filters</Button>} />
        ) : (
          <div className="overflow-x-auto ts-slim-scrollbar scroll-smooth">
            <table className="ts-table">
              <caption className="sr-only">Your orders</caption>
              <thead><tr><th scope="col">Order</th><th scope="col">Date</th><th scope="col">Items</th><th scope="col">Total</th><th scope="col">Payment</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {visible.map((order) => (
                  <tr key={order.id}>
                    <td className="whitespace-nowrap font-semibold text-navy-900">{order.id}</td>
                    <td className="whitespace-nowrap text-muted">{formatDate(order.createdAt)}</td>
                    <td className="min-w-48 max-w-72"><span className="line-clamp-2">{order.items.map((item) => `${item.name} × ${item.quantity.toLocaleString('en-IN')}`).join(', ')}</span></td>
                    <td className="whitespace-nowrap font-semibold">{money(order.totals.total)}</td>
                    <td><span className="block min-w-32 text-[0.8125rem] font-medium text-ink">{getPaymentMethod(order.paymentMethod)?.label ?? 'Other'}</span><span className="text-xs text-muted">{getPaymentStatus(order)}</span></td>
                    <td><StatusBadge status={order.status} /></td>
                    <td>
                      <div className="flex justify-end gap-1.5 flex-wrap">
                        <Button variant="outline" size="sm" icon={Eye} onClick={() => open(order.id)} aria-label={`View order ${order.id}`}>View</Button>
                        <Button variant="outline" size="sm" icon={FileText} onClick={() => handlePrintOrderInvoice(order)} aria-label={`Print invoice for order ${order.id}`}>Invoice</Button>
                        <Button variant="secondary" size="sm" icon={RotateCcw} onClick={() => handleReorder(order)} aria-label={`Reorder items from order ${order.id}`}>Reorder</Button>
                        <Button variant="outline" size="sm" icon={Truck} to={`/track/${order.orderNumber || order.id}`} aria-label={`Track order ${order.id}`}>Track</Button>
                        {order.status === 'Pending' ? <Button variant="dangerOutline" size="sm" onClick={() => setCancelId(order.id)} aria-label={`Cancel order ${order.id}`}>Cancel</Button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={Boolean(selected)} onClose={() => open('')} title="Order details" size="lg">
        {selected ? <OrderDetails order={selected} /> : null}
      </Modal>
      <ConfirmDialog open={Boolean(cancelId)} onCancel={() => setCancelId(null)} onConfirm={cancel} title="Cancel this order?" text={`Order ${cancelId} will be marked as cancelled.`} confirmLabel="Cancel order" cancelLabel="Keep order" />
      <TaxInvoiceModal
        order={selectedInvoiceOrder}
        isOpen={Boolean(selectedInvoiceOrder)}
        onClose={() => setSelectedInvoiceOrder(null)}
        defaultRole="buyer"
      />
    </div>
  );
}
