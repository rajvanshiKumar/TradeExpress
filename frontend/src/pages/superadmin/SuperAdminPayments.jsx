import { useState, useEffect, useMemo } from 'react';
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
  Download,
  AlertTriangle,
  Sliders,
  Calendar,
  ArrowRight,
  Calculator,
} from 'lucide-react';
import superAdminApi from '../../api/superAdminApi';
import useNotifications from '../../hooks/useNotifications';
import CustomSelect from '../../components/common/CustomSelect';

export default function SuperAdminPayments() {
  const { showToast } = useNotifications();
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({
    totalEscrowHeld: 0,
    totalCommissionEarned: 0,
    pendingCommission: 0,
    settledCommission: 0,
    refundedCommission: 0,
    grossEligibleSubtotal: 0,
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Declining Commission Tier Policy State
  const [policy, setPolicy] = useState({
    threshold1: 50000,
    threshold2: 200000,
    rate1: 8.0,
    rate2: 6.0,
    rate3: 4.0,
    policyVersion: 'TIERED_V1',
  });
  const [tierForm, setTierForm] = useState({
    threshold1: '50000',
    threshold2: '200000',
    rate1: '8.0',
    rate2: '6.0',
    rate3: '4.0',
    reason: '',
  });
  const [savingCommission, setSavingCommission] = useState(false);
  const [policyError, setPolicyError] = useState('');

  // Test Simulator
  const [simAmount, setSimAmount] = useState('100000');

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
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setPayments(res.payments || []);
      setSummary(res.summary || {});
      setPagination(res.pagination || { page: 1, limit: 12, total: 0, totalPages: 1 });
    } catch (err) {
      showToast(err.message || 'Failed to fetch payments.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadCommissionPolicy = async () => {
    try {
      const res = await superAdminApi.getCommissionSettings();
      const p = res?.data?.policy || res?.policy;
      if (p) {
        setPolicy(p);
        setTierForm({
          threshold1: String(p.threshold1 || 50000),
          threshold2: String(p.threshold2 || 200000),
          rate1: String(p.rate1 || 8.0),
          rate2: String(p.rate2 || 6.0),
          rate3: String(p.rate3 || 4.0),
          reason: '',
        });
      }
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    loadCommissionPolicy();
  }, []);

  useEffect(() => {
    fetchPayments(1);
  }, [status, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchPayments(1);
  };

  // Client-side validation for Commission Tier Policy
  const validateTierForm = () => {
    const t1 = parseFloat(tierForm.threshold1);
    const t2 = parseFloat(tierForm.threshold2);
    const r1 = parseFloat(tierForm.rate1);
    const r2 = parseFloat(tierForm.rate2);
    const r3 = parseFloat(tierForm.rate3);

    if (isNaN(t1) || t1 <= 0) return 'Threshold 1 must be greater than ₹0.';
    if (isNaN(t2) || t2 <= t1) return `Threshold 2 must be greater than Threshold 1 (₹${t1.toLocaleString('en-IN')}).`;
    if (isNaN(r1) || r1 < 0 || r1 > 100) return 'Tier 1 Rate must be between 0% and 100%.';
    if (isNaN(r2) || r2 < 0 || r2 > 100) return 'Tier 2 Rate must be between 0% and 100%.';
    if (isNaN(r3) || r3 < 0 || r3 > 100) return 'Tier 3 Rate must be between 0% and 100%.';
    if (!tierForm.reason.trim()) return 'A statutory reason is mandatory for auditing commission policy adjustments.';
    return '';
  };

  const handleSaveCommission = async (e) => {
    e.preventDefault();
    const err = validateTierForm();
    if (err) {
      setPolicyError(err);
      return;
    }
    setPolicyError('');

    try {
      setSavingCommission(true);
      await superAdminApi.updateCommissionSetting({
        threshold1: parseFloat(tierForm.threshold1),
        threshold2: parseFloat(tierForm.threshold2),
        rate1: parseFloat(tierForm.rate1),
        rate2: parseFloat(tierForm.rate2),
        rate3: parseFloat(tierForm.rate3),
        reason: tierForm.reason.trim(),
      });
      showToast('Declining commission tier policy updated and audited successfully.', 'success');
      loadCommissionPolicy();
    } catch (apiErr) {
      setPolicyError(apiErr.message || 'Failed to update commission policy.');
      showToast(apiErr.message || 'Failed to update commission policy.', 'error');
    } finally {
      setSavingCommission(false);
    }
  };

  // Live simulation calculation based on current form inputs
  const simulatedCommission = useMemo(() => {
    const amt = parseFloat(simAmount) || 0;
    const t1 = parseFloat(tierForm.threshold1) || 50000;
    const t2 = parseFloat(tierForm.threshold2) || 200000;
    const r1 = parseFloat(tierForm.rate1) || 8.0;
    const r2 = parseFloat(tierForm.rate2) || 6.0;
    const r3 = parseFloat(tierForm.rate3) || 4.0;

    let rate = r1;
    let tier = 1;
    let label = `Tier 1 (≤ ₹${t1.toLocaleString('en-IN')})`;

    if (amt <= t1) {
      rate = r1;
      tier = 1;
      label = `Tier 1 (≤ ₹${t1.toLocaleString('en-IN')})`;
    } else if (amt <= t2) {
      rate = r2;
      tier = 2;
      label = `Tier 2 (> ₹${t1.toLocaleString('en-IN')} & ≤ ₹${t2.toLocaleString('en-IN')})`;
    } else {
      rate = r3;
      tier = 3;
      label = `Tier 3 (> ₹${t2.toLocaleString('en-IN')})`;
    }

    const fee = Math.round(amt * (rate / 100) * 100) / 100;
    const supplierNet = Math.max(0, Math.round((amt - fee) * 100) / 100);

    return { rate, tier, label, fee, supplierNet };
  }, [simAmount, tierForm]);

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
      showToast('Refund processed successfully and commission adjusted.', 'success');
      setRefundModalOpen(false);
      fetchPayments(pagination.page);
    } catch (err) {
      showToast(err.message || 'Failed to process refund.', 'error');
    } finally {
      setProcessingRefund(false);
    }
  };

  const exportPaymentsCsv = () => {
    if (!payments.length) {
      showToast('No payment transactions to export.', 'info');
      return;
    }

    const headers = [
      'Transaction ID',
      'Order Number',
      'Buyer Name',
      'Buyer Email',
      'Gateway',
      'Eligible Product Subtotal (INR)',
      'Commission Rate (%)',
      'Commission Fee (INR)',
      'Total Amount (INR)',
      'Payment Status',
      'Escrow Status',
      'Date',
    ];

    const rows = payments.map((p) => [
      p.transactionId || p.paymentOrderId || 'DIRECT',
      p.order?.orderNumber || '',
      `"${(p.order?.buyerName || '').replace(/"/g, '""')}"`,
      p.order?.buyerEmail || '',
      p.gateway,
      p.order?.commissionEligibleSubtotal ?? p.order?.subtotal ?? p.amount,
      p.order?.commissionRate ?? (p.order?.escrowLedger?.commissionRate || 8.0),
      p.order?.commissionFee ?? (p.order?.escrowLedger?.commissionFee || 0),
      p.amount,
      p.status,
      p.order?.escrowLedger?.status || 'HELD',
      new Date(p.createdAt).toISOString().slice(0, 10),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TradeExpress_Financial_Clearing_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Financial transactions statement exported successfully.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Financial Clearing & Declining Commission Console
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit gateway transactions, manage declining commission tiers (8%, 6%, 4%), and execute authorized buyer refunds.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={exportPaymentsCsv}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 inline-flex items-center gap-1.5 transition-colors"
          >
            <Download className="size-4" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => fetchPayments(pagination.page)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
            title="Refresh Transactions"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Financial Health KPIs: 5 Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-[#0b2716] to-[#144728] text-white p-4 rounded-2xl shadow-xs">
          <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider block">
            Eligible Subtotal Base
          </span>
          <p className="text-xl font-black mt-2 tracking-tight">
            ₹{Number(summary.grossEligibleSubtotal || 0).toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] text-emerald-200/80 mt-1 block">
            Order products after discounts
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Escrow in Custody
          </span>
          <p className="text-xl font-black text-amber-700 mt-2 tracking-tight">
            ₹{Number(summary.totalEscrowHeld || 0).toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Awaiting delivery inspection
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Commission Earned
          </span>
          <p className="text-xl font-black text-emerald-700 mt-2 tracking-tight">
            ₹{Number(summary.totalCommissionEarned || 0).toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Net realized platform cut
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Pending Commission
          </span>
          <p className="text-xl font-black text-indigo-700 mt-2 tracking-tight">
            ₹{Number(summary.pendingCommission || 0).toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Locked in transit orders
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Refunded / Reversed
          </span>
          <p className="text-xl font-black text-rose-700 mt-2 tracking-tight">
            -₹{Number(summary.refundedCommission || 0).toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Reversed commission claims
          </span>
        </div>
      </div>

      {/* Declining Commission Tier Policy Settings */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800">
              <Sliders className="size-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Configurable Declining Commission Tier Policy
              </h2>
              <p className="text-xs text-slate-500">
                Configure threshold boundaries and order-level percentage cuts. Changes apply strictly to future orders.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
            <ShieldCheck className="size-4 text-emerald-700" />
            <span>Active Policy: {policy.policyVersion || 'TIERED_V1'}</span>
          </div>
        </div>

        {policyError && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4 shrink-0 text-rose-600" />
            <span>{policyError}</span>
          </div>
        )}

        <form onSubmit={handleSaveCommission} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tier 1 */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Tier 1: Standard
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Up to ₹{Number(tierForm.threshold1 || 50000).toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Applied when order eligible product subtotal is less than or equal to Threshold 1.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Threshold 1 Limit (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1000"
                  value={tierForm.threshold1}
                  onChange={(e) => setTierForm({ ...tierForm, threshold1: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-mono font-bold text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Commission Rate (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={tierForm.rate1}
                    onChange={(e) => setTierForm({ ...tierForm, rate1: e.target.value })}
                    className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white font-mono font-bold text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Tier 2 */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Tier 2: Mid-Volume
                </span>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                  ₹{Number(tierForm.threshold1 || 50000).toLocaleString('en-IN')} - ₹{Number(tierForm.threshold2 || 200000).toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Applied when subtotal is strictly greater than Threshold 1 and less than or equal to Threshold 2.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Threshold 2 Limit (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1000"
                  value={tierForm.threshold2}
                  onChange={(e) => setTierForm({ ...tierForm, threshold2: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-mono font-bold text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Commission Rate (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={tierForm.rate2}
                    onChange={(e) => setTierForm({ ...tierForm, rate2: e.target.value })}
                    className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white font-mono font-bold text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Tier 3 */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Tier 3: Enterprise Bulk
                </span>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                  Above ₹{Number(tierForm.threshold2 || 200000).toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Applied when order eligible product subtotal strictly exceeds Threshold 2.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Threshold 2 Exceeded
                </label>
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-100 font-mono text-xs font-bold text-slate-600">
                  &gt; ₹{Number(tierForm.threshold2 || 200000).toLocaleString('en-IN')}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Commission Rate (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={tierForm.rate3}
                    onChange={(e) => setTierForm({ ...tierForm, rate3: e.target.value })}
                    className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white font-mono font-bold text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    %
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Statutory Reason & Save Action */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <div className="relative flex-1 w-full">
              <input
                type="text"
                required
                value={tierForm.reason}
                onChange={(e) => setTierForm({ ...tierForm, reason: e.target.value })}
                placeholder="Statutory reason for policy adjustment (mandatory for Super Admin audit log)..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={savingCommission}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#0b2716] hover:bg-emerald-950 text-white font-bold text-xs transition-colors shrink-0 disabled:opacity-50"
            >
              {savingCommission ? 'Saving Policy...' : 'Save & Publish Policy'}
            </button>
          </div>
        </form>

        {/* Live Simulator & Policy Documentation */}
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calculator className="size-4 text-emerald-800" />
              <span className="text-xs font-bold text-emerald-950">
                Live Declining Tier Order Simulator
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 font-semibold">Test Subtotal: ₹</span>
              <input
                type="number"
                step="1000"
                min="0"
                value={simAmount}
                onChange={(e) => setSimAmount(e.target.value)}
                className="w-32 px-2.5 py-1 rounded-lg border border-emerald-300 bg-white font-mono font-bold text-xs text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white/80 p-3 rounded-xl border border-emerald-200">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Selected Tier</span>
              <span className="font-bold text-emerald-900">{simulatedCommission.label}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Applied Rate</span>
              <span className="font-bold text-emerald-800">{simulatedCommission.rate}%</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Platform Commission</span>
              <span className="font-mono font-bold text-rose-700">₹{simulatedCommission.fee.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Supplier Net Product</span>
              <span className="font-mono font-bold text-emerald-950">₹{simulatedCommission.supplierNet.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <p className="text-[11px] text-emerald-800">
            <strong>Policy Invariant</strong>: ONE rate applies to the entire eligible subtotal of the order (not progressive marginal slabs). Taxes and shipping charges are strictly excluded from the commission base.
          </p>
        </div>
      </div>

      {/* Filter and Date Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
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

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Calendar className="size-3.5 text-slate-400" />
            <span>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none"
            />
          </div>

          <div className="w-40">
            <CustomSelect
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Payments' },
                { value: 'PAID', label: 'Paid (Captured)' },
                { value: 'PENDING', label: 'Pending' },
                { value: 'REFUNDED', label: 'Refunded' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-table-scrollbar">
          <table className="w-full min-w-[1200px] text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Transaction / Gateway ID</th>
                <th className="py-3 px-4">Order Ref</th>
                <th className="py-3 px-4">Buyer Account</th>
                <th className="py-3 px-4">Gateway</th>
                <th className="py-3 px-4">Eligible Subtotal</th>
                <th className="py-3 px-4">Commission</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-slate-400">
                    No transactions found in database.
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const isPaid = p.status === 'PAID';
                  const isRefunded = p.status === 'REFUNDED';
                  const eligibleSubtotal = p.order?.commissionEligibleSubtotal ?? p.order?.subtotal ?? p.amount;
                  const commRate = p.order?.commissionRate ?? (p.order?.escrowLedger?.commissionRate || 8.0);
                  const commFee = p.order?.commissionFee ?? (p.order?.escrowLedger?.commissionFee || 0);

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

                      <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                        ₹{Number(eligibleSubtotal || 0).toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-rose-700 block">
                          ₹{Number(commFee || 0).toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500">
                          {commRate}% ({commRate <= 4 ? 'Tier 3' : commRate <= 6 ? 'Tier 2' : 'Tier 1'})
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-black text-slate-900 font-mono">
                        ₹{Number(p.amount || 0).toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isPaid
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
              Issuing this refund will record a refund transaction, adjust platform commission proportionally in escrow, mark the order and escrow status as REFUNDED, and record an audit log entry.
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
