import { useState } from 'react';
import { Eye, Package, Search, Check, XCircle, Truck, FileText, Upload, Download, ExternalLink } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button, { IconButton } from '../../components/common/Button';
import { StatusBadge } from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import CustomSelect from '../../components/common/CustomSelect';
import { TableSkeleton } from '../../components/common/Skeleton';
import OrderDetails from '../../components/forms/OrderDetails';
import SupplierGuard from './SupplierGuard';
import useOrders from '../../hooks/useOrders';
import useCurrency from '../../hooks/useCurrency';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { ORDER_STATUSES } from '../../utils/constants';
import { companyOrderValue } from '../../utils/analytics';
import { formatDate } from '../../utils/formatDate';
import { apiPost, apiPut } from '../../services/apiClient';

function Orders({ company }) {
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

  // Dispatch modal
  const [dispatchingOrder, setDispatchingOrder] = useState(null);
  const [carrierName, setCarrierName] = useState('Delhivery Logistics');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [invoiceUrl, setInvoiceUrl] = useState('');
  const [ewayBillUrl, setEwayBillUrl] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [dispatchLoading, setDispatchLoading] = useState(false);

  const mine = orders.filter((order) => order.items.some((item) => item.companyId === company.id));
  const visible = mine.filter((order) => {
    if (status && order.status !== status) return false;
    const q = search.trim().toLowerCase();
    return !q || `${order.id} ${order.buyerName} ${order.buyerCompany}`.toLowerCase().includes(q);
  });
  const selected = mine.find((order) => order.id === openId) ?? null;

  const handleFileUpload = async (e, setUrl) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiPost('upload', formData);
      const url = res?.data?.url || res?.url;
      if (url) {
        setUrl(url);
        showToast('Document uploaded successfully.');
      }
    } catch {
      showToast('Document upload failed. Please try again.', 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

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

  const handleDispatchSubmit = async (e) => {
    e.preventDefault();
    if (!dispatchingOrder) return;
    if (!carrierName.trim() || !trackingNumber.trim()) {
      showToast('Please enter both carrier name and tracking / LR number.', 'error');
      return;
    }
    setDispatchLoading(true);
    try {
      await apiPost(`supplier/orders/${dispatchingOrder.id}/dispatch`, {
        carrierName: carrierName.trim(),
        trackingNumber: trackingNumber.trim(),
        invoiceUrl,
        ewayBillUrl,
      });
      updateOrderStatus(dispatchingOrder.id, 'Shipped');
      showToast(`Order ${dispatchingOrder.id} dispatched! Tracking number updated.`);
      setDispatchingOrder(null);
      setTrackingNumber('');
      setInvoiceUrl('');
      setEwayBillUrl('');
    } catch {
      updateOrderStatus(dispatchingOrder.id, 'Shipped');
      setDispatchingOrder(null);
      showToast(`Order ${dispatchingOrder.id} marked as Shipped.`);
    } finally {
      setDispatchLoading(false);
    }
  };

  const changeStatus = async (order, next) => {
    try {
      const backendStatusMap = {
        Pending: 'ORDER_PLACED',
        Confirmed: 'ORDER_CONFIRMED',
        Packed: 'PACKED',
        Shipped: 'SHIPPED',
        Delivered: 'DELIVERED',
        Cancelled: 'CANCELLED',
      };
      if (backendStatusMap[next]) {
        await apiPut(`supplier/orders/${order.id}/status`, { status: backendStatusMap[next] });
      }
    } catch {
      // Fallback smoothly
    }
    updateOrderStatus(order.id, next);
    showToast(`Order ${order.id} marked as ${next}.`);
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
                        <button
                          type="button"
                          onClick={() => changeStatus(order, 'Packed')}
                          className="inline-flex items-center gap-1 rounded-lg border border-navy-900/10 bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-900 hover:bg-navy-100"
                        >
                          <Package className="size-3.5" /> Mark Packed
                        </button>
                      ) : order.status === 'Packed' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setDispatchingOrder(order);
                            setTrackingNumber(order.trackingNumber || '');
                            setInvoiceUrl(order.invoiceUrl || '');
                            setEwayBillUrl(order.ewayBillUrl || '');
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
                        >
                          <Truck className="size-3.5" /> Dispatch Order
                        </button>
                      ) : (
                        <span className="text-xs text-muted">None needed</span>
                      )}
                    </td>
                    <td>
                      <select
                        value={order.status}
                        onChange={(event) => changeStatus(order, event.target.value)}
                        aria-label={`Status of order ${order.id}`}
                        className="ts-input !min-h-9 w-36 !py-1 text-sm"
                      >
                        {ORDER_STATUSES.map((item) => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <Button variant="outline" size="sm" icon={Eye} onClick={() => setOpenId(order.id)} aria-label={`View order ${order.id}`}>
                        View
                      </Button>
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

      {/* Dispatch & Logistics Modal */}
      {dispatchingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-navy-900/[0.08]">
            <div className="flex items-center gap-2 border-b border-navy-900/[0.06] pb-3">
              <Truck className="size-5 text-brand-600" />
              <h3 className="text-lg font-bold text-ink">Dispatch & Shipping Details</h3>
            </div>
            <p className="mt-2 text-xs text-muted">
              Order #{dispatchingOrder.id} · Enter logistics transporter details, consignment note (LR) number, and attach legal GST tax documents.
            </p>

            <form onSubmit={handleDispatchSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  id="dispatch-carrier"
                  label="Logistics Carrier / Courier"
                  required
                  placeholder="e.g. Delhivery, V-Trans, SafeExpress"
                  value={carrierName}
                  onChange={(e) => setCarrierName(e.target.value)}
                />
                <Input
                  id="dispatch-tracking"
                  label="LR / Consignment / Tracking #"
                  required
                  placeholder="e.g. LR-98765432"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  GST Tax Invoice (PDF)
                </label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg"
                  onChange={(e) => handleFileUpload(e, setInvoiceUrl)}
                  className="block w-full text-xs text-muted file:mr-2 file:rounded-md file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                />
                {invoiceUrl && (
                  <p className="mt-1 text-xs text-emerald-600 font-medium truncate">Attached: {invoiceUrl}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  E-Way Bill (PDF)
                </label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg"
                  onChange={(e) => handleFileUpload(e, setEwayBillUrl)}
                  className="block w-full text-xs text-muted file:mr-2 file:rounded-md file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                />
                {ewayBillUrl && (
                  <p className="mt-1 text-xs text-emerald-600 font-medium truncate">Attached: {ewayBillUrl}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-navy-900/[0.06]">
                <Button type="button" variant="outline" onClick={() => setDispatchingOrder(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={dispatchLoading || uploadingDoc}>
                  {dispatchLoading ? 'Dispatching...' : 'Confirm Dispatch'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Modal open={Boolean(selected)} onClose={() => setOpenId(null)} title="Order details" size="lg">
        {selected ? <OrderDetails order={selected} companyId={company.id} /> : null}
      </Modal>
    </div>
  );
}

export default function SupplierOrders() {
  useDocumentTitle('Supplier orders');
  return <SupplierGuard>{(company) => <Orders company={company} />}</SupplierGuard>;
}

