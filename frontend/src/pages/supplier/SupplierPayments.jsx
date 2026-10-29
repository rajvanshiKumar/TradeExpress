import { useState, useEffect } from 'react';
import {
  CircleDollarSign,
  CreditCard,
  Download,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ShieldCheck,
  TrendingUp,
  Percent,
} from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import { TableSkeleton } from '../../components/common/Skeleton';
import useCurrency from '../../hooks/useCurrency';
import useNotifications from '../../hooks/useNotifications';
import { fetchSupplierPayments } from '../../services/supplierDashboardApi';
import { formatDate } from '../../utils/formatDate';

export default function SupplierPayments() {
  const { money } = useCurrency();
  const { showToast } = useNotifications();

  const [paymentData, setPaymentData] = useState({
    summary: {
      grossSales: 0,
      commissionDeducted: 0,
      netEarnings: 0,
      pendingPayouts: 0,
      settledPayouts: 0,
      defaultCommissionRate: 2.5,
    },
    ledger: [],
    payoutHistory: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
    setLoading(true);
    try {
      const res = await fetchSupplierPayments();
      setPaymentData(
        res?.data || {
          summary: {
            grossSales: 0,
            commissionDeducted: 0,
            netEarnings: 0,
            pendingPayouts: 0,
            settledPayouts: 0,
            defaultCommissionRate: 2.5,
          },
          ledger: [],
          payoutHistory: [],
        }
      );
    } catch (err) {
      showToast(err.message || 'Failed to load payments ledger', 'error');
    } finally {
      setLoading(false);
    }
  }

  function exportCsvStatement() {
    if (!paymentData.ledger.length) {
      showToast('No transaction records available to export.', 'info');
      return;
    }

    const headers = [
      'Order Number',
      'Date',
      'Buyer Company',
      'Payment Method',
      'Payment Status',
      'Order Status',
      'Gross Amount (INR)',
      'Commission Rate (%)',
      'Commission Fee (INR)',
      'Net Supplier Payout (INR)',
      'Payout State',
    ];

    const rows = paymentData.ledger.map((o) => [
      o.orderNumber,
      new Date(o.createdAt).toISOString().slice(0, 10),
      `"${(o.buyerCompany || o.buyerName || '').replace(/"/g, '""')}"`,
      o.paymentMethod,
      o.paymentStatus,
      o.orderStatus,
      o.grossAmount,
      o.commissionRate,
      o.commissionAmount,
      o.netSupplierAmount,
      o.payoutStatus,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TradeExpress_Supplier_Statement_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Settlement statement exported successfully.', 'success');
  }

  const { summary, ledger } = paymentData;

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Payments, Escrow & Net Earnings"
        description="Transparent financial ledger with verified platform commission breakdowns and escrow release settlement tracking."
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={Download}
            onClick={exportCsvStatement}
          >
            Export Statement (CSV)
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
            Gross Confirmed Sales
          </span>
          <p className="text-xl sm:text-2xl font-black text-navy-950 mt-1">
            {money(summary.grossSales)}
          </p>
          <span className="text-[10px] text-muted">Excludes cancelled & refunded orders</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
            Platform Commission ({summary.defaultCommissionRate}%)
          </span>
          <p className="text-xl sm:text-2xl font-black text-rose-700 mt-1">
            -{money(summary.commissionDeducted)}
          </p>
          <span className="text-[10px] text-muted">Standard B2B platform brokerage</span>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
            Net Supplier Earnings
          </span>
          <p className="text-xl sm:text-2xl font-black text-emerald-950 mt-1">
            {money(summary.netEarnings)}
          </p>
          <span className="text-[10px] text-emerald-700 font-semibold">After all statutory deductions</span>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
            Held in Escrow Payouts
          </span>
          <p className="text-xl sm:text-2xl font-black text-amber-950 mt-1">
            {money(summary.pendingPayouts)}
          </p>
          <span className="text-[10px] text-amber-700 font-semibold">Released on delivery confirmation</span>
        </div>
      </div>

      {/* Order-wise Financial Ledger */}
      <div className="ts-card overflow-hidden">
        <div className="border-b px-5 py-3.5 bg-slate-50/70 flex justify-between items-center">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
            Order-wise Commercial Breakdown & Payout Status
          </h3>
          <span className="text-[11px] text-muted font-medium">
            {ledger.length} verified records
          </span>
        </div>

        {loading ? (
          <div className="p-6">
            <TableSkeleton />
          </div>
        ) : ledger.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={CircleDollarSign}
              title="No commercial transactions yet"
              text="When buyers place orders for your products, financial calculations and escrow payouts appear here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Order Number</th>
                  <th className="px-4 py-3.5">Buyer</th>
                  <th className="px-4 py-3.5">Gross Order</th>
                  <th className="px-4 py-3.5">Commission</th>
                  <th className="px-4 py-3.5">Net Payout</th>
                  <th className="px-4 py-3.5">Payment State</th>
                  <th className="px-4 py-3.5">Escrow State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-navy-950">
                {ledger.map((o) => (
                  <tr key={o.orderId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-mono font-bold text-emerald-800 block text-xs">
                        {o.orderNumber}
                      </span>
                      <span className="text-[11px] text-muted">
                        {formatDate(o.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-semibold block">{o.buyerCompany || o.buyerName}</span>
                      <span className="text-[11px] text-muted">{o.paymentMethod?.toUpperCase()}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-bold text-navy-900 font-mono block">
                        {money(o.grossAmount)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-rose-700 font-mono font-semibold block">
                        -{money(o.commissionAmount)}
                      </span>
                      <span className="text-[10px] text-muted">({o.commissionRate}%)</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-black text-emerald-900 font-mono block">
                        {money(o.netSupplierAmount)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          o.paymentStatus === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : o.paymentStatus === 'COD'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          o.escrowStatus === 'RELEASED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : o.escrowStatus === 'HELD'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {o.escrowStatus === 'RELEASED' ? '✓ Settled' : o.escrowStatus === 'HELD' ? '🔒 In Escrow' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
