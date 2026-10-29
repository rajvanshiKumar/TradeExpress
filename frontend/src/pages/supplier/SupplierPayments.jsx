import { useState, useEffect } from 'react';
import {
  CircleDollarSign,
  Download,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  TrendingUp,
  Percent,
  Layers,
  HelpCircle,
  Package,
  Truck,
  RotateCcw,
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
      defaultCommissionRate: 8.0,
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
            defaultCommissionRate: 8.0,
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
      'Product Subtotal (INR)',
      'Applied Tier',
      'Commission Rate (%)',
      'Commission Fee (INR)',
      'Shipping Fee (INR)',
      'Taxes (INR)',
      'Refunds (INR)',
      'Gross Order (INR)',
      'Estimated Net Payable (INR)',
      'Payout State',
    ];

    const rows = paymentData.ledger.map((o) => [
      o.orderNumber,
      new Date(o.createdAt).toISOString().slice(0, 10),
      `"${(o.buyerCompany || o.buyerName || '').replace(/"/g, '""')}"`,
      o.paymentMethod,
      o.paymentStatus,
      o.orderStatus,
      o.eligibleSubtotal || o.productSubtotal || o.grossAmount,
      `"${o.tierLabel || 'Tier 1'}"`,
      o.commissionRate,
      o.commissionAmount,
      o.shippingFee || 0,
      o.tax || 0,
      o.refundAmount || 0,
      o.grossAmount,
      o.estimatedNetPayable || o.netSupplierAmount,
      o.payoutStatus,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TradeExpress_Supplier_Financial_Statement_${Date.now()}.csv`);
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
        description="Transparent financial ledger with verified declining tier commission breakdowns, delivery escrow milestones, and net supplier payouts."
        actions={
          <Button variant="outline" size="sm" icon={Download} onClick={exportCsvStatement}>
            Export Statement (CSV)
          </Button>
        }
      />

      {/* Declining Tier Policy Banner */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <Percent className="size-5" />
            </span>
            <div>
              <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                TradeExpress Declining Commission Policy
              </h4>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                Commission is order-level and calculated strictly on the eligible product subtotal (after discounts). Shipping and GST taxes are 100% excluded.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto text-[11px] font-bold text-emerald-900 bg-white/80 px-3 py-1.5 rounded-xl border border-emerald-200">
            <span className="text-emerald-700">≤ ₹50k: 8%</span>
            <span>·</span>
            <span className="text-emerald-700">₹50k-₹200k: 6%</span>
            <span>·</span>
            <span className="text-emerald-700">&gt; ₹200k: 4%</span>
          </div>
        </div>
      </div>

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
            Platform Commission
          </span>
          <p className="text-xl sm:text-2xl font-black text-rose-700 mt-1">
            -{money(summary.commissionDeducted)}
          </p>
          <span className="text-[10px] text-muted">Declining tiers (4% - 8%) on subtotal</span>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block flex items-center gap-1">
            <Clock className="size-3 text-amber-600" />
            Pending in Escrow
          </span>
          <p className="text-xl sm:text-2xl font-black text-amber-950 mt-1">
            {money(summary.pendingPayouts)}
          </p>
          <span className="text-[10px] text-amber-700 font-semibold">
            Estimated net; released upon delivery confirmation
          </span>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
            <CheckCircle2 className="size-3 text-emerald-600" />
            Settled & Transferred
          </span>
          <p className="text-xl sm:text-2xl font-black text-emerald-950 mt-1">
            {money(summary.settledPayouts)}
          </p>
          <span className="text-[10px] text-emerald-700 font-semibold">
            Completed payouts to bank account
          </span>
        </div>
      </div>

      {/* Order-wise Financial Ledger */}
      <div className="ts-card overflow-hidden">
        <div className="border-b px-5 py-3.5 bg-slate-50/70 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
              Order-wise Commercial Breakdown & Payout Status
            </h3>
            <p className="text-[11px] text-muted">
              Breakdown of product subtotal, applied tier commission, shipping, taxes, and net payable.
            </p>
          </div>
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
                  <th className="px-5 py-3.5">Order</th>
                  <th className="px-4 py-3.5">Buyer</th>
                  <th className="px-4 py-3.5">Eligible Subtotal</th>
                  <th className="px-4 py-3.5">Applied Commission</th>
                  <th className="px-4 py-3.5">Shipping & Tax</th>
                  <th className="px-4 py-3.5">Refunds</th>
                  <th className="px-4 py-3.5">Estimated Net Payable</th>
                  <th className="px-4 py-3.5">Payout Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-navy-950">
                {ledger.map((o) => (
                  <tr key={o.orderId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-mono font-bold text-emerald-800 block text-xs">
                        {o.orderNumber}
                      </span>
                      <span className="text-[11px] text-muted">{formatDate(o.createdAt)}</span>
                    </td>

                    <td className="px-4 py-4">
                      <span className="font-semibold block">{o.buyerCompany || o.buyerName}</span>
                      <span className="text-[11px] text-muted">{o.paymentMethod?.toUpperCase()}</span>
                    </td>

                    <td className="px-4 py-4">
                      <span className="font-bold text-navy-900 font-mono block">
                        {money(o.eligibleSubtotal || o.productSubtotal || o.grossAmount)}
                      </span>
                      <span className="text-[10px] text-slate-400">Commission Base</span>
                    </td>

                    <td className="px-4 py-4">
                      <span className="text-rose-700 font-mono font-bold block">
                        -{money(o.commissionAmount)}
                      </span>
                      <span className="inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 mt-0.5">
                        {o.commissionRate}% ({o.tierLabel || (o.commissionRate <= 4 ? 'Tier 3' : o.commissionRate <= 6 ? 'Tier 2' : 'Tier 1')})
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <span className="font-mono text-slate-700 block">
                        {money((o.shippingFee || 0) + (o.tax || 0))}
                      </span>
                      <span className="text-[10px] text-muted">
                        Ship: {money(o.shippingFee || 0)} · GST: {money(o.tax || 0)}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      {o.refundAmount > 0 ? (
                        <span className="text-rose-600 font-mono font-semibold block">
                          -{money(o.refundAmount)}
                        </span>
                      ) : (
                        <span className="text-muted text-[11px]">₹0.00</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <span className="font-black text-emerald-900 font-mono block text-sm">
                        {money(o.estimatedNetPayable || o.netSupplierAmount)}
                      </span>
                      <span className="text-[10px] text-muted">
                        {o.payoutStatus === 'SETTLED'
                          ? 'Settled Payout'
                          : o.payoutStatus === 'HELD_IN_ESCROW'
                          ? 'Held in Escrow'
                          : o.payoutStatus}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          o.payoutStatus === 'SETTLED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : o.payoutStatus === 'HELD_IN_ESCROW'
                            ? 'bg-amber-100 text-amber-800'
                            : o.payoutStatus === 'REFUNDED'
                            ? 'bg-rose-100 text-rose-800'
                            : o.payoutStatus === 'CANCELLED'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {o.payoutStatus === 'SETTLED' && <CheckCircle2 className="size-3" />}
                        {o.payoutStatus === 'HELD_IN_ESCROW' && <Clock className="size-3" />}
                        {o.payoutStatus === 'REFUNDED' && <RotateCcw className="size-3" />}
                        {o.payoutStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Statutory Guidance Note */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-600">
        <p className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
          <ShieldCheck className="size-4 text-emerald-700" />
          Escrow Settlement & Payout Protection Policy
        </p>
        <p>
          Funds paid by buyers are held securely in the TradeExpress wholesale escrow vault throughout transit. Once the buyer completes their inspection window or confirms delivery, net supplier payouts are automatically approved and transferred. Platform commission is locked at the moment of order placement and will never change retroactively.
        </p>
      </div>
    </div>
  );
}
