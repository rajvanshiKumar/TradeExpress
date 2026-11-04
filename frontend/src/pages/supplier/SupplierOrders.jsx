import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Package, Search, Check, XCircle, Truck, FileText } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import { StatusBadge } from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import CustomSelect from '../../components/common/CustomSelect';
import { TableSkeleton } from '../../components/common/Skeleton';
import OrderDetails from '../../components/forms/OrderDetails';
import TaxInvoiceModal from '../../components/common/TaxInvoiceModal';
import SupplierGuard from './SupplierGuard';
import useOrders from '../../hooks/useOrders';
import useCurrency from '../../hooks/useCurrency';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { ORDER_STATUSES } from '../../utils/constants';
import { companyOrderValue } from '../../utils/analytics';
import { formatDate } from '../../utils/formatDate';
import { apiPost, apiPut } from '../../services/apiClient';

const PREPARATION_STATUSES = ['Pending', 'Confirmed', 'In Production', 'Packed'];

function Orders({ company }) {
  const navigate = useNavigate();
  const { orders, loading, error, reload, updateOrderStatus } = useOrders();
  const { money } = useCurrency();
  const { showToast } = useNotifications();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);

  // Rejection modal
  const [rejectingOrder, setRejectingOrder] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  const [invoiceOrder, setInvoiceOrder] = useState(null);

  const mine = orders.filter((order) => order.items.some((item) => item.companyId === company.id));
  const visible = mine.filter((order) => {
    if (status && order.status !== status) return false;
    const q = search.trim().toLowerCase();
    return !q || `${order.id} ${order.buyerName} ${order.buyerCompany}`.toLowerCase().includes(q);
  });
  const selected = mine.find((order) => order.id === openId) ?? null;

  const handleAccept = async (order) => {
    try {
      await apiPost(`supplier/orders/${order.id}/accept`, {});
      updateOrderStatus(order.id, 'Confirmed');
      showToast(`Order ${order.id} accepted! Buyer has been notified.`);
    } catch {
      updateOrderStatus(order.id, 'Confirmed');
      showToast(`Order ${order.id} accepted.`);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectingOrder) return;
    setRejectLoading(true);
    try {
      await apiPost(`supplier/orders/${rejectingOrder.id}/reject`, {
        rejectionReason: rejectionReason.trim() || 'Supplier capacity full or unable to fulfill at this time.',
      });
      updateOrderStatus(rejectingOrder.id, 'Cancelled');
      showToast(`Order ${rejectingOrder.id} rejected.`);
      setRejectingOrder(null);
      setRejectionReason('');
    } catch {
      updateOrderStatus(rejectingOrder.id, 'Cancelled');
      setRejectingOrder(null);
      setRejectionReason('');
      showToast(`Order marked as cancelled.`);
    } finally {
      setRejectLoading(false);
    }
  };

  // Suppliers move an order through preparation only. Shipped and Delivered come from Transport & Delivery
  // (dispatch and the buyer's delivery confirmation); cancelling goes through Reject.
  const changeStatus = async (order, next) => {
    const backendStatusMap = { Confirmed: 'ORDER_CONFIRMED', Packed: 'PACKED' };
    if (!backendStatusMap[next] || next === order.status) return;
    try {
      await apiPut(`supplier/orders/${order.id}/status`, { status: backendStatusMap[next] });
      updateOrderStatus(order.id, next);
      showToast(`Order ${order.id} marked as ${next}.`);
    } catch (err) {
      showToast(err.message || 'The order status could not be updated.', 'error');
    }
  };

  return (
    <div>
      <SectionHeading
        title="Orders"
        description="Orders that include your products. Updating a status notifies the buyer."
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="so-search" className="sr-only">Search orders</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input id="so-search" type="search" className="ts-input pl-9" placeholder="Search by order ID or buyer" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="sm:w-56 shrink-0">
          <CustomSelect
            id="so-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={[
              { value: '', label: 'All statuses' },
              ...ORDER_STATUSES.map((item) => ({ value: item, label: item })),
            ]}
            placeholder="All statuses"
            searchable={false}
          />
        </div>
      </div>

      <div className="ts-card overflow-hidden">
        {error ? <ErrorState text={error} onRetry={reload} /> : loading ? <TableSkeleton /> : mine.length === 0 ? (
          <EmptyState icon={Package} title="No orders yet" text="When a buyer orders your products, the order appears here." />
        ) : visible.length === 0 ? (
          <EmptyState icon={Search} title="No matching orders" text="Try a different search or status." action={<Button variant="outline" onClick={() => { setSearch(''); setStatus(''); }}>Clear filters</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="ts-table">
              <caption className="sr-only">Orders containing your products</caption>
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Buyer</th>
                  <th scope="col">Date</th>
                  <th scope="col">Your items</th>
                  <th scope="col">Status</th>
                  <th scope="col">Workflow Actions</th>
                  <th scope="col">Update status</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((order) => (
                  <tr key={order.id}>
                    <td className="whitespace-nowrap font-semibold text-navy-900">{order.id}</td>
                    <td>
                      <span className="block min-w-32 font-medium text-ink">{order.buyerName}</span>
                      <span className="text-xs text-muted">{order.buyerCompany}</span>
                    </td>
                    <td className="whitespace-nowrap text-muted">{formatDate(order.createdAt)}</td>
                    <td className="whitespace-nowrap font-semibold">{money(companyOrderValue(order, company.id))}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td>
                      {/* Action buttons based on order stage */}
                      {order.status === 'Pending' ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAccept(order)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                          >
                            <Check className="size-3.5" /> Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectingOrder(order)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                          >
                            <XCircle className="size-3.5" /> Reject
                          </button>
                        </div>
                      ) : order.status === 'Confirmed' ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => changeStatus(order, 'Packed')}
                            className="inline-flex items-center gap-1 rounded-lg border border-navy-900/10 bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-900 hover:bg-navy-100"
                          >
                            <Package className="size-3.5" /> Mark Packed
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/supplier/transport?order=${order.id}`)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                          >
                            <Truck className="size-3.5" /> Arrange Delivery
                          </button>
                        </div>
                      ) : order.status === 'Packed' ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/supplier/transport?order=${order.id}`)}
                          className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
                        >
                          <Truck className="size-3.5" /> Arrange Delivery
                        </button>
                      ) : (
                        <span className="text-xs text-muted">None needed</span>
                      )}
                    </td>
                    <td>
                      {PREPARATION_STATUSES.includes(order.status) ? (
                        <div className="w-36">
                          <CustomSelect
                            value={order.status}
                            onChange={(event) => changeStatus(order, event.target.value)}
                            aria-label={`Status of order ${order.id}`}
                            options={[...new Set([order.status, 'Confirmed', 'Packed'])].map((item) => ({ value: item, label: item }))}
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-muted">{['Shipped', 'Delivered'].includes(order.status) ? 'Updated by Transport & Delivery' : '—'}</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" icon={Eye} onClick={() => setOpenId(order.id)} aria-label={`View order ${order.id}`}>
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={FileText}
                          onClick={() => setInvoiceOrder(order)}
                          aria-label={`Tax invoice for order ${order.id}`}
                          title="Generate Tax Invoice PDF"
                        >
                          Invoice
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Order Modal */}
      {rejectingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-navy-900/[0.08]">
            <h3 className="text-lg font-bold text-ink">Reject Order #{rejectingOrder.id}</h3>
            <p className="mt-1 text-xs text-muted">
              Please specify a clear reason for declining this wholesale order. This will be sent directly to the buyer.
            </p>
            <form onSubmit={handleRejectSubmit} className="mt-4 space-y-4">
              <Input
                id="reject-reason"
                label="Rejection Reason"
                required
                placeholder="e.g. Raw material stock shortage, lead time exceeds delivery request"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setRejectingOrder(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="danger" disabled={rejectLoading}>
                  {rejectLoading ? 'Rejecting...' : 'Confirm Rejection'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}


      <Modal open={Boolean(selected)} onClose={() => setOpenId(null)} title="Order details" size="lg">
        {selected ? <OrderDetails order={selected} companyId={company.id} /> : null}
      </Modal>

      <TaxInvoiceModal
        order={invoiceOrder}
        isOpen={Boolean(invoiceOrder)}
        onClose={() => setInvoiceOrder(null)}
        defaultRole="supplier"
      />
    </div>
  );
}

export default function SupplierOrders() {
  useDocumentTitle('Supplier orders');
  return <SupplierGuard>{(company) => <Orders company={company} />}</SupplierGuard>;
}

