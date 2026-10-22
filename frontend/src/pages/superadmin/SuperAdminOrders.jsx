import { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Search,
  Filter,
  Eye,
  Truck,
  IndianRupee,
  RefreshCw,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileText,
} from 'lucide-react';
import superAdminApi from '../../api/superAdminApi';
import useNotifications from '../../hooks/useNotifications';

export default function SuperAdminOrders() {
  const { showToast } = useNotifications();
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState('ALL');
  const [paymentStatus, setPaymentStatus] = useState('ALL');

  // Order Details Modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Status & Shipping update form
  const [newStatus, setNewStatus] = useState('');
  const [newTracking, setNewTracking] = useState('');
  const [newCarrier, setNewCarrier] = useState('');
  const [overrideNotes, setOverrideNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchOrders = async (page = 1) => {
    try {
      setLoading(true);
      const res = await superAdminApi.getOrders({
        page,
        limit: pagination.limit,
        orderStatus,
        paymentStatus,
        search,
      });
      setOrders(res.orders);
      setPagination(res.pagination);
    } catch (err) {
      showToast(err.message || 'Failed to fetch orders from database.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(1);
  }, [orderStatus, paymentStatus]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchOrders(1);
  };

  const openOrderDetails = async (orderId) => {
    try {
      setLoadingDetails(true);
      setDetailModalOpen(true);
      const data = await superAdminApi.getOrderDetails(orderId);
      setSelectedOrder(data);
      setNewStatus(data.orderStatus);
      setNewTracking(data.trackingNumber || '');
      setNewCarrier(data.carrierName || '');
      setOverrideNotes('');
    } catch (err) {
      showToast(err.message || 'Failed to load order details.', 'error');
      setDetailModalOpen(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleUpdateOrder = async () => {
    try {
      setUpdating(true);
      await superAdminApi.updateOrderAdmin(selectedOrder.id, {
        orderStatus: newStatus,
        trackingNumber: newTracking,
        carrierName: newCarrier,
        notes: overrideNotes,
      });
      showToast('Order fulfillment details updated.', 'success');
      const refreshed = await superAdminApi.getOrderDetails(selectedOrder.id);
      setSelectedOrder(refreshed);
      fetchOrders(pagination.page);
    } catch (err) {
      showToast(err.message || 'Failed to update order.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Order Lifecycle & Shipping Registry</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor fulfillment checkpoints, update shipping tracking numbers, and manage escrow disbursements.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchOrders(pagination.page)}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 self-start sm:self-auto"
          title="Refresh Orders"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order number, buyer email, tracking number..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>Status:</span>
            <select
              value={orderStatus}
              onChange={(e) => setOrderStatus(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ORDER_PLACED">Order Placed</option>
              <option value="ORDER_CONFIRMED">Confirmed</option>
              <option value="PROCESSING">In Production</option>
              <option value="PACKED">Packed</option>
              <option value="SHIPPED">Shipped</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>Payment:</span>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">All Payments</option>
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-table-scrollbar">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Order Number</th>
                <th className="py-3 px-4">Buyer</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Escrow Status</th>
                <th className="py-3 px-4">Order Status</th>
                <th className="py-3 px-4">Tracking</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    No orders match current criteria.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {o.orderNumber}
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">{o.buyerName}</p>
                      <p className="text-[11px] text-slate-400 font-mono truncate max-w-[150px]">{o.buyerEmail}</p>
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {o.supplier?.company || o.supplier?.name || 'Direct Wholesale'}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      ₹{Number(o.total || 0).toLocaleString('en-IN')}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          o.paymentStatus === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {o.paymentStatus}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {o.orderStatus}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {o.trackingNumber ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800">
                          <Truck className="size-3" />
                          {o.trackingNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Unassigned</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openOrderDetails(o.id)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                      >
                        <Eye className="size-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
          <p>
            Showing <span className="font-bold text-slate-900">{orders.length}</span> of{' '}
            <span className="font-bold text-slate-900">{pagination.total}</span> orders
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => fetchOrders(pagination.page - 1)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-100"
            >
              Previous
            </button>
            <span className="font-bold text-slate-700">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchOrders(pagination.page + 1)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-100"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Order Details & Override Modal */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="font-mono text-xs font-bold text-slate-400">Order Inspection Console</span>
                <h3 className="text-base font-bold text-slate-900 font-mono">{selectedOrder?.orderNumber}</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {loadingDetails ? (
              <div className="py-16 text-center text-slate-400">
                <RefreshCw className="size-6 animate-spin text-emerald-600 mx-auto mb-2" />
                <p className="text-xs">Loading order record from MySQL...</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Items Table */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Order Line Items</h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase">
                        <tr>
                          <th className="py-2 px-3">Item</th>
                          <th className="py-2 px-3">SKU</th>
                          <th className="py-2 px-3">Qty</th>
                          <th className="py-2 px-3">Unit Price</th>
                          <th className="py-2 px-3 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedOrder?.items?.map((item) => (
                          <tr key={item.id}>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">{item.productName}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-400">{item.productSku}</td>
                            <td className="py-2.5 px-3">{item.quantity}</td>
                            <td className="py-2.5 px-3">₹{Number(item.unitPrice).toLocaleString('en-IN')}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              ₹{Number(item.lineTotal).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block font-semibold">Subtotal</span>
                    <span className="font-bold text-slate-900">₹{Number(selectedOrder?.subtotal || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block font-semibold">GST / Tax</span>
                    <span className="font-bold text-slate-900">₹{Number(selectedOrder?.tax || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block font-semibold">Freight Fee</span>
                    <span className="font-bold text-slate-900">₹{Number(selectedOrder?.shippingFee || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-900">
                    <span className="text-emerald-700 block font-semibold">Grand Total</span>
                    <span className="font-black text-sm">₹{Number(selectedOrder?.total || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Shipping & Fulfillment Status Override Form */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Super Admin Shipping & Status Override
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Order Status</label>
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        className="w-full p-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800"
                      >
                        <option value="ORDER_PLACED">Order Placed</option>
                        <option value="ORDER_CONFIRMED">Order Confirmed</option>
                        <option value="PROCESSING">In Production / Processing</option>
                        <option value="PACKED">Packed</option>
                        <option value="SHIPPED">Shipped</option>
                        <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                        <option value="DELIVERED">Delivered</option>
                        <option value="CANCELLED">Cancelled</option>
                        <option value="REFUNDED">Refunded</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Carrier Name</label>
                      <input
                        type="text"
                        value={newCarrier}
                        onChange={(e) => setNewCarrier(e.target.value)}
                        placeholder="e.g. Blue Dart, Delhivery, Road Express"
                        className="w-full p-2 rounded-lg border border-slate-200 bg-white text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Tracking Number (AWB)</label>
                      <input
                        type="text"
                        value={newTracking}
                        onChange={(e) => setNewTracking(e.target.value)}
                        placeholder="e.g. BD-984920491"
                        className="w-full p-2 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-600 mb-1 text-xs">Audit Override Reason</label>
                    <input
                      type="text"
                      value={overrideNotes}
                      onChange={(e) => setOverrideNotes(e.target.value)}
                      placeholder="Reason for administrative update (recorded in OrderStatusHistory and AuditLog)..."
                      className="w-full p-2 rounded-lg border border-slate-200 bg-white text-xs"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      disabled={updating}
                      onClick={handleUpdateOrder}
                      className="px-4 py-2 rounded-xl bg-[#0b2716] hover:bg-emerald-950 text-white font-bold text-xs transition-colors"
                    >
                      {updating ? 'Committing...' : 'Commit Fulfillment Update'}
                    </button>
                  </div>
                </div>

                {/* Status Timeline History */}
                {selectedOrder?.statusHistory?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Audit Status Timeline</h4>
                    <div className="space-y-1.5 text-xs text-slate-600">
                      {selectedOrder.statusHistory.map((h) => (
                        <div key={h.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900">{h.status}</span>
                            <span className="text-slate-400 text-[11px] ml-2">— {h.notes || 'Status updated'}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(h.createdAt).toLocaleString()} ({h.changedBy || 'System'})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
