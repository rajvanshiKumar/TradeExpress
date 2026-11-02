import { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  IndianRupee,
  Download,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  Percent,
} from 'lucide-react';
import superAdminApi from '../../api/superAdminApi';
import useNotifications from '../../hooks/useNotifications';

export default function SuperAdminReports() {
  const { showToast } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await superAdminApi.getFinancialReport({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setData(res);
    } catch (err) {
      showToast(err.message || 'Failed to generate financial report.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchReport();
  };

  const handleExportCsv = () => {
    if (!data?.orders || data.orders.length === 0) {
      showToast('No transaction data to export.', 'error');
      return;
    }

    const header = 'Order ID,Order Number,Buyer,Email,Total,GST Tax,Shipping Fee,Payment Method,Date\n';
    const rows = data.orders.map((o) => {
      const clean = (val) => `"${String(val || '').replace(/"/g, '""')}"`;
      return [
        clean(o.id),
        clean(o.orderNumber),
        clean(o.buyerName),
        clean(o.buyerEmail),
        clean(o.total),
        clean(o.tax),
        clean(o.shippingFee),
        clean(o.paymentMethod),
        clean(new Date(o.createdAt).toISOString()),
      ].join(',');
    }).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `financial_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = data?.summary || {};
  const orders = data?.orders || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Financial & Reconciliation Analytics</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time MySQL settlement reports, tax aggregations, and platform revenue metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-colors"
          >
            <Download className="size-4" />
            <span>Export CSV Report</span>
          </button>

          <button
            type="button"
            onClick={fetchReport}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
            title="Refresh Report"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Date Range Picker */}
      <form onSubmit={handleFilterSubmit} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold">From Date:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold">To Date:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold"
            />
          </div>
        </div>

        <button
          type="submit"
          className="px-4 py-1.5 rounded-xl bg-[#0b2716] text-white font-bold hover:bg-emerald-950 transition-colors"
        >
          Apply Date Filter
        </button>
      </form>

      {/* KPI Financial Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#0b2716] to-[#144728] text-white p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Gross Merchandise Value</span>
            <IndianRupee className="size-4.5 text-emerald-400" />
          </div>
          <p className="text-2xl font-black mt-3 tracking-tight">
            ₹{(summary.totalGrossRevenue || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-emerald-200/80 mt-1">
            {summary.totalOrdersPaid || 0} paid wholesale orders
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Platform Commission</span>
            <Percent className="size-4.5 text-emerald-700" />
          </div>
          <p className="text-2xl font-black text-emerald-800 mt-3 tracking-tight">
            ₹{(summary.totalCommissionEarned || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Marketplace revenue take
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">GST Tax Disbursed</span>
            <IndianRupee className="size-4.5 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-3 tracking-tight">
            ₹{(summary.totalTaxCollected || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Reconciled tax component
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Logistics & Freight</span>
            <IndianRupee className="size-4.5 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-3 tracking-tight">
            ₹{(summary.totalShippingCollected || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Courier & freight billings
          </p>
        </div>
      </div>

      {/* Orders Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Paid Orders in Period ({orders.length})</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Order Number</th>
                <th className="py-2.5 px-4">Buyer</th>
                <th className="py-2.5 px-4">Total Amount</th>
                <th className="py-2.5 px-4">GST Tax</th>
                <th className="py-2.5 px-4">Shipping</th>
                <th className="py-2.5 px-4">Payment Method</th>
                <th className="py-2.5 px-4">Settled Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    No paid transactions found in selected date range.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{o.orderNumber}</td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-800">{o.buyerName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{o.buyerEmail}</p>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      ₹{Number(o.total || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      ₹{Number(o.tax || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      ₹{Number(o.shippingFee || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 uppercase text-[10px] font-bold text-slate-600">
                      {o.paymentMethod}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
