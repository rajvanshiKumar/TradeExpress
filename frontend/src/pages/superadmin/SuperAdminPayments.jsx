import { useState, useEffect } from 'react';
import {
  CreditCard,
  Search,
  IndianRupee,
  ShieldCheck,
  Percent,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';
import superAdminApi from '../../api/superAdminApi';
import useNotifications from '../../hooks/useNotifications';

export default function SuperAdminPayments() {
  const { showToast } = useNotifications();
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({ totalEscrowHeld: 0, totalCommissionEarned: 0 });
  const [commissionSettings, setCommissionSettings] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');

  // Commission Editor
  const [globalRate, setGlobalRate] = useState('2.5');
  const [savingCommission, setSavingCommission] = useState(false);

  // Refund Modal
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [processingRefund, setProcessingRefund] = useState(false);

  const fetchPayments = async (page = 1) => {
    try {
      setLoading(true);
      const res = await superAdminApi.getPayments({
        page,
        limit: pagination.limit,
        status,
        search,
      });
      setPayments(res.payments);
      setSummary(res.summary);
      setPagination(res.pagination);
    } catch (err) {
      showToast(err.message || 'Failed to fetch payments.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadCommission = async () => {
    try {
      const settings = await superAdminApi.getCommissionSettings();
      setCommissionSettings(settings);
      const global = settings.find((s) => s.type === 'GLOBAL');
      if (global) setGlobalRate(String(global.percentage));
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    loadCommission();
  }, []);

  useEffect(() => {
    fetchPayments(1);
  }, [status]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchPayments(1);
  };

  const handleSaveCommission = async (e) => {
    e.preventDefault();
    try {
      setSavingCommission(true);
      await superAdminApi.updateCommissionSetting({
        type: 'GLOBAL',
        targetId: '',
        percentage: globalRate,
      });
      showToast('Global platform commission rate updated.', 'success');
      loadCommission();
    } catch (err) {
      showToast(err.message || 'Failed to update commission rate.', 'error');
    } finally {
      setSavingCommission(false);
    }
  };

  const openRefundModal = (p) => {
    setRefundTarget(p);
    setRefundAmount(String(p.amount));
    setRefundReason('');
    setRefundModalOpen(true);
  };

  const handleRefundSubmit = async () => {
    if (!refundReason.trim()) {
      showToast('Please state a reason for this refund.', 'error');
      return;
    }

    try {
      setProcessingRefund(true);
      await superAdminApi.processRefund(refundTarget.orderId, {
        amount: refundAmount,
        reason: refundReason,
      });
      showToast('Refund processed successfully and order status updated.', 'success');
      setRefundModalOpen(false);
      fetchPayments(pagination.page);
    } catch (err) {
      showToast(err.message || 'Failed to process refund.', 'error');
    } finally {
      setProcessingRefund(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Financial Clearing & Escrow Console</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit gateway transactions, manage platform commission take-rates, and execute authorized buyer refunds.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchPayments(pagination.page)}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 self-start sm:self-auto"
          title="Refresh Transactions"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
        </button>
      </div>

      {/* Escrow & Commission KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gradient-to-br from-[#0b2716] to-[#144728] text-white p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Escrow Balance In Custody</span>
            <ShieldCheck className="size-5 text-emerald-400" />
          </div>
          <p className="text-2xl font-black mt-4 tracking-tight">
            ₹{summary.totalEscrowHeld.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-emerald-200/80 mt-1">
            Held in escrow awaiting delivery confirmation
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Platform Commission</span>
            <IndianRupee className="size-5 text-emerald-700" />
          </div>
          <p className="text-2xl font-black text-emerald-800 mt-4 tracking-tight">
            ₹{summary.totalCommissionEarned.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Earned from completed marketplace settlements
          </p>
        </div>

        {/* Global Commission Rule Editor */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Commission Settings</span>
              <Percent className="size-5 text-indigo-700" />
            </div>
            <p className="text-xs text-slate-600 mt-1">Global Marketplace Cut (%)</p>
          </div>

          <form onSubmit={handleSaveCommission} className="flex items-center gap-2 mt-4">
            <div className="relative flex-1">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={globalRate}
                onChange={(e) => setGlobalRate(e.target.value)}
                className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
            </div>
            <button
              type="submit"
              disabled={savingCommission}
              className="px-4 py-2 rounded-xl bg-[#0b2716] hover:bg-emerald-950 text-white font-bold text-xs transition-colors"
            >
              {savingCommission ? 'Saving...' : 'Update Rule'}
            </button>
          </form>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by transaction ID, payment order, order number, or email..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </form>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs text-slate-500 font-semibold">Payment Status:</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">All Payments</option>
            <option value="PAID">Paid (Captured)</option>
            <option value="PENDING">Pending</option>
            <option value="REFUNDED">Refunded</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-table-scrollbar">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Transaction / Gateway ID</th>
                <th className="py-3 px-4">Order Ref</th>
                <th className="py-3 px-4">Buyer Account</th>
                <th className="py-3 px-4">Gateway</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    No transactions found in database.
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const isPaid = p.status === 'PAID';
                  const isRefunded = p.status === 'REFUNDED';

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {p.transactionId || p.paymentOrderId || 'COD / Direct'}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-semibold text-emerald-800">
                        {p.order?.orderNumber || '—'}
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-800">{p.order?.buyerName || 'Buyer'}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{p.order?.buyerEmail}</p>
                      </td>

                      <td className="py-3.5 px-4 uppercase font-bold text-slate-600 text-[10px]">
                        {p.gateway}
                      </td>

                      <td className="py-3.5 px-4 font-black text-slate-900">
                        ₹{Number(p.amount || 0).toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${isPaid
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : isRefunded
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                        >
                          {isPaid ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
                          {p.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {new Date(p.createdAt).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {isPaid && (
                          <button
                            type="button"
                            onClick={() => openRefundModal(p)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 text-xs font-bold transition-colors inline-flex items-center gap-1"
                          >
                            <RotateCcw className="size-3.5" />
                            <span>Refund</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
          <p>
            Showing <span className="font-bold text-slate-900">{payments.length}</span> of{' '}
            <span className="font-bold text-slate-900">{pagination.total}</span> transactions
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => fetchPayments(pagination.page - 1)}
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
              onClick={() => fetchPayments(pagination.page + 1)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-100"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Refund Modal */}
      {refundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-rose-100 text-rose-700">
                <RotateCcw className="size-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">Issue Administrative Refund</h3>
                <p className="text-xs text-slate-500">Order: {refundTarget?.order?.orderNumber}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Issuing this refund will record a refund transaction, mark the order and escrow status as REFUNDED, and record an audit log entry.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Refund Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reason for Refund <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows="3"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Specify return agreement, damage compensation, or cancellation justification..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRefundModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingRefund}
                onClick={handleRefundSubmit}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors"
              >
                {processingRefund ? 'Processing...' : 'Authorize Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
