import { useState, useEffect } from 'react';
import {
  Truck,
  Package,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Search,
  MapPin,
  Send,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import { TableSkeleton } from '../../components/common/Skeleton';
import useNotifications from '../../hooks/useNotifications';
import useCurrency from '../../hooks/useCurrency';
import { fetchSupplierShipping, submitOrderDispatch } from '../../services/supplierDashboardApi';
import { formatDate } from '../../utils/formatDate';

const SHIPPING_TABS = [
  { id: 'awaiting', label: 'Ready for Dispatch' },
  { id: 'inTransit', label: 'In Transit / Dispatched' },
  { id: 'delivered', label: 'Delivered Consignments' },
];

export default function SupplierShipping() {
  const { money } = useCurrency();
  const { showToast } = useNotifications();

  const [activeTab, setActiveTab] = useState('awaiting');
  const [data, setData] = useState({ awaitingDispatch: [], inTransit: [], delivered: [] });
  const [loading, setLoading] = useState(true);

  // Dispatch Modal State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formCarrier, setFormCarrier] = useState('');
  const [formTracking, setFormTracking] = useState('');
  const [formEstDate, setFormEstDate] = useState('');
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    loadShippingData();
  }, []);

  async function loadShippingData() {
    setLoading(true);
    try {
      const res = await fetchSupplierShipping();
      setData(res?.data || { awaitingDispatch: [], inTransit: [], delivered: [] });
    } catch (err) {
      showToast(err.message || 'Failed to load shipping data', 'error');
    } finally {
      setLoading(false);
    }
  }

  function openDispatchModal(order) {
    setSelectedOrder(order);
    setFormCarrier('BlueDart Express');
    setFormTracking('');
    setFormEstDate('');
    setFormNotes('');
    setShowDispatchModal(true);
  }

  async function handleDispatchSubmit(e) {
    e.preventDefault();
    if (!formCarrier.trim() || !formTracking.trim()) {
      showToast('Please enter both logistics carrier and AWB tracking number.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      await submitOrderDispatch(selectedOrder.id, {
        carrierName: formCarrier.trim(),
        trackingNumber: formTracking.trim(),
        estimatedDeliveryDate: formEstDate || undefined,
        notes: formNotes.trim() || undefined,
      });

      showToast(`Order #${selectedOrder.orderNumber} dispatched successfully! Tracking saved.`, 'success');
      setShowDispatchModal(false);
      loadShippingData();
    } catch (err) {
      showToast(err.message || 'Failed to dispatch order', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const currentList =
    activeTab === 'awaiting'
      ? data.awaitingDispatch
      : activeTab === 'inTransit'
      ? data.inTransit
      : data.delivered;

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Shipping & Logistics Fulfillment"
        description="Fulfill confirmed B2B buyer orders, generate dispatch consignments, and record manual AWB tracking numbers."
        actions={
          <Button to="/supplier/orders" variant="outline" size="sm" icon={Package}>
            All Orders
          </Button>
        }
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
          <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">
            Awaiting Shipment
          </span>
          <p className="text-2xl font-black text-amber-950 mt-1">
            {data.awaitingDispatch.length}
          </p>
          <p className="text-[11px] text-muted mt-0.5">Orders confirmed and packed</p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
          <span className="text-xs font-bold text-blue-800 uppercase tracking-wider block">
            Active in Transit
          </span>
          <p className="text-2xl font-black text-blue-950 mt-1">
            {data.inTransit.length}
          </p>
          <p className="text-[11px] text-muted mt-0.5">Dispatched with active carrier AWB</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
            Delivered Consignments
          </span>
          <p className="text-2xl font-black text-emerald-950 mt-1">
            {data.delivered.length}
          </p>
          <p className="text-[11px] text-muted mt-0.5">Fulfillment cycle successfully closed</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-navy-900/[0.08] pb-3">
        {SHIPPING_TABS.map((tab) => {
          const active = activeTab === tab.id;
          const count =
            tab.id === 'awaiting'
              ? data.awaitingDispatch.length
              : tab.id === 'inTransit'
              ? data.inTransit.length
              : data.delivered.length;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                active
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-white text-navy-800 ring-1 ring-navy-900/10 hover:bg-slate-50'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-2 py-0.2 text-[10px] font-bold ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Shipment Table */}
      {loading ? (
        <div className="ts-card p-6">
          <TableSkeleton />
        </div>
      ) : currentList.length === 0 ? (
        <div className="ts-card p-8">
          <EmptyState
            icon={Truck}
            title="No consignments in this stage"
            text={
              activeTab === 'awaiting'
                ? 'No pending orders need immediate dispatch.'
                : activeTab === 'inTransit'
                ? 'No consignments currently in transit.'
                : 'No delivered consignments recorded yet.'
            }
          />
        </div>
      ) : (
        <div className="ts-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Order Number</th>
                  <th className="px-4 py-3.5">Consignee & Destination</th>
                  <th className="px-4 py-3.5">Package Contents</th>
                  <th className="px-4 py-3.5">Carrier / AWB</th>
                  <th className="px-4 py-3.5">Fulfillment State</th>
                  <th className="px-4 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-navy-950">
                {currentList.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-mono font-bold text-emerald-800 block text-xs">
                        {order.orderNumber}
                      </span>
                      <span className="text-[11px] text-muted">
                        Placed: {formatDate(order.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-semibold block">{order.buyerCompany || order.buyerName}</span>
                      <span className="text-[11px] text-muted block flex items-center gap-1">
                        <MapPin className="size-3 text-slate-400" />
                        {order.deliveryAddress?.city || 'India'}, {order.deliveryAddress?.state || ''}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-semibold block">
                        {order.items[0]?.productName || 'Wholesale Goods'}
                      </span>
                      <span className="text-[11px] text-muted">
                        Qty: {order.items[0]?.quantity || 1} {order.items.length > 1 ? `(+${order.items.length - 1} more)` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {order.trackingNumber && order.trackingNumber !== 'Pending AWB' ? (
                        <div>
                          <span className="font-bold text-navy-900 block">{order.carrierName}</span>
                          <span className="font-mono text-emerald-700 font-semibold block text-[11px]">
                            AWB: {order.trackingNumber}
                          </span>
                        </div>
                      ) : (
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-semibold text-[11px]">
                          Pending Dispatch
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          order.orderStatus === 'DELIVERED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ['SHIPPED', 'OUT_FOR_DELIVERY'].includes(order.orderStatus)
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {order.orderStatus}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {activeTab === 'awaiting' ? (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={Truck}
                          onClick={() => openDispatchModal(order)}
                          className="text-xs"
                        >
                          Mark Dispatched
                        </Button>
                      ) : (
                        <Button
                          to={`/order-tracking?order=${order.orderNumber}`}
                          variant="outline"
                          size="sm"
                          icon={ExternalLink}
                          className="text-xs"
                        >
                          Track Consignment
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Dispatch Modal */}
      {selectedOrder && (
        <Modal
          open={showDispatchModal}
          onClose={() => setShowDispatchModal(false)}
          title={`Dispatch Consignment #${selectedOrder.orderNumber}`}
          className="max-w-md"
        >
          <form onSubmit={handleDispatchSubmit} className="space-y-4 text-xs text-navy-950">
            <div className="p-3 bg-slate-50 rounded-xl border text-[11px]">
              <span className="text-muted block">Recipient:</span>
              <strong className="text-navy-900 block">{selectedOrder.buyerCompany || selectedOrder.buyerName}</strong>
              <span className="text-muted block mt-1">Delivery Destination:</span>
              <span className="text-navy-800 block">
                {selectedOrder.deliveryAddress?.street || ''}, {selectedOrder.deliveryAddress?.city || ''},{' '}
                {selectedOrder.deliveryAddress?.postalCode || ''}
              </span>
            </div>

            <div>
              <label className="font-bold text-navy-900 block mb-1">
                Logistics Carrier Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                required
                value={formCarrier}
                onChange={(e) => setFormCarrier(e.target.value)}
                placeholder="e.g. BlueDart Express, Delhivery, VRL Logistics"
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-navy-950 focus:border-emerald-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-navy-900 block mb-1">
                Air Waybill / Tracking Number (AWB / LR #) <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                required
                value={formTracking}
                onChange={(e) => setFormTracking(e.target.value)}
                placeholder="e.g. BD-8938192847 or VRL-984719"
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs text-navy-950 focus:border-emerald-700 focus:outline-none"
              />
              <p className="text-[10px] text-muted mt-1">
                * Real manual tracking workflow: Buyer will receive an automated dispatch notification with this AWB number.
              </p>
            </div>

            <div>
              <label className="font-bold text-navy-900 block mb-1">
                Estimated Delivery Date
              </label>
              <input
                type="date"
                value={formEstDate}
                onChange={(e) => setFormEstDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-navy-950 focus:border-emerald-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-navy-900 block mb-1">
                Packaging / Dispatch Notes
              </label>
              <textarea
                rows={2}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="e.g. Packed in 5 double-corrugated export boxes with moisture protection."
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-navy-950 focus:border-emerald-700 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowDispatchModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                icon={Truck}
                disabled={submitting}
              >
                {submitting ? 'Saving...' : 'Confirm Dispatch'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
