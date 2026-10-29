import { useMemo, useState } from 'react';
import {
  CheckCircle,
  Clock,
  CreditCard,
  Download,
  Eye,
  FileCheck,
  FileText,
  Printer,
  Receipt,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import { TableSkeleton } from '../../components/common/Skeleton';
import useAuth from '../../hooks/useAuth';
import useOrders from '../../hooks/useOrders';
import useCurrency from '../../hooks/useCurrency';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { formatDate } from '../../utils/formatDate';

export default function BuyerPayments() {
  const { user } = useAuth();
  const { orders, loading } = useOrders();
  const { money } = useCurrency();
  useDocumentTitle('Payments & Invoices — Buyer Workspace');

  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const buyerOrders = useMemo(() => {
    return (orders || []).filter((o) => o.buyerId === user?.id);
  }, [orders, user?.id]);

  const metrics = useMemo(() => {
    const nonCancelled = buyerOrders.filter((o) => o.status !== 'Cancelled');
    const totalSpent = nonCancelled.reduce((sum, o) => sum + (o.total || 0), 0);
    const inEscrow = nonCancelled
      .filter((o) => o.status !== 'Delivered')
      .reduce((sum, o) => sum + (o.total || 0), 0);
    const released = nonCancelled
      .filter((o) => o.status === 'Delivered')
      .reduce((sum, o) => sum + (o.total || 0), 0);

    return {
      totalSpent,
      inEscrow,
      released,
      totalCount: buyerOrders.length,
      paidCount: nonCancelled.length,
      pendingCount: nonCancelled.filter((o) => ['Pending', 'Processing'].includes(o.status)).length,
    };
  }, [buyerOrders]);

  const filteredOrders = useMemo(() => {
    return buyerOrders.filter((o) => {
      if (filter === 'ESCROW' && o.status === 'Delivered') return false;
      if (filter === 'RELEASED' && o.status !== 'Delivered') return false;
      if (filter === 'CANCELLED' && o.status !== 'Cancelled') return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const matchId = String(o.id).toLowerCase().includes(q);
      const matchItems = (o.items || []).some((i) => (i.name || '').toLowerCase().includes(q));
      return matchId || matchItems;
    });
  }, [buyerOrders, filter, search]);

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Payments & Invoices"
        description="Monitor your B2B transactions, escrow protection ledgers, and download statutory GST invoices."
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={Printer}
            onClick={() => window.print()}
          >
            Print Statements
          </Button>
        }
      />

      {/* Escrow Guarantee Highlight Banner */}
      <div className="rounded-2xl border border-emerald-200/90 bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-900 p-5 text-white shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-300 ring-1 ring-white/20">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  100% TradeExpress Buyer Protection & Escrow
                </h3>
                <span className="rounded-full bg-brand-500/20 px-2.5 py-0.5 text-[10px] font-bold text-brand-300 border border-brand-400/30 uppercase tracking-wider">
                  Guaranteed
                </span>
              </div>
              <p className="mt-1 text-xs text-white/70 max-w-2xl leading-relaxed">
                Your payments are held in an authorized multi-currency escrow account. Supplier payouts are
                released only after consignment arrival and buyer quality verification.
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-brand-300">
              Currently in Escrow
            </span>
            <span className="text-xl font-black text-white font-display">
              {money(metrics.inEscrow)}
            </span>
          </div>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <CreditCard className="size-4 text-emerald-700" />
            <span>Total Purchases</span>
          </div>
          <p className="mt-2 text-xl font-extrabold text-slate-900 font-display">
            {money(metrics.totalSpent)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">{metrics.paidCount} confirmed transactions</p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <ShieldCheck className="size-4 text-emerald-600" />
            <span>Escrow Protected</span>
          </div>
          <p className="mt-2 text-xl font-extrabold text-emerald-700 font-display">
            {money(metrics.inEscrow)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">{metrics.pendingCount} orders awaiting delivery</p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <CheckCircle className="size-4 text-blue-600" />
            <span>Released to Sellers</span>
          </div>
          <p className="mt-2 text-xl font-extrabold text-slate-900 font-display">
            {money(metrics.released)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">Successfully inspected & accepted</p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <Receipt className="size-4 text-amber-600" />
            <span>Invoices Available</span>
          </div>
          <p className="mt-2 text-xl font-extrabold text-slate-900 font-display">
            {metrics.totalCount}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">Downloadable PDF statements</p>
        </div>
      </div>

      {/* Transaction & Invoices Table Section */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-slate-100">
          <div className="flex items-center gap-2 overflow-x-auto">
            {[
              { id: 'ALL', label: 'All Invoices' },
              { id: 'ESCROW', label: 'In Escrow' },
              { id: 'RELEASED', label: 'Completed & Released' },
              { id: 'CANCELLED', label: 'Cancelled' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors shrink-0 ${
                  filter === tab.id
                    ? 'bg-emerald-800 text-white shadow-2xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by order ID or product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-1.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
            />
          </div>
        </div>

        {/* Content Table */}
        {loading ? (
          <TableSkeleton rows={4} />
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No payment records found"
            text="Completed order payments and escrow invoices will appear here."
            action={
              <Button to="/products" variant="primary" size="sm">
                Explore Marketplace
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto ts-slim-scrollbar scroll-smooth">
            <table className="ts-table">
              <thead>
                <tr>
                  <th scope="col">Invoice #</th>
                  <th scope="col">Date</th>
                  <th scope="col">Items / Order</th>
                  <th scope="col">Payment Method</th>
                  <th scope="col">Escrow Ledger</th>
                  <th scope="col">Total</th>
                  <th scope="col" className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const isDelivered = order.status === 'Delivered';
                  const isCancelled = order.status === 'Cancelled';
                  const invoiceNumber = `INV-${order.id.slice(-8).toUpperCase()}`;

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      <td>
                        <span className="font-mono font-bold text-emerald-800 text-xs">
                          {invoiceNumber}
                        </span>
                      </td>
                      <td className="text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(order.createdAt)}
                      </td>
                      <td>
                        <div className="max-w-xs">
                          <p className="text-xs font-semibold text-slate-900 truncate">
                            {order.items?.[0]?.name || 'Wholesale Goods'}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {order.items?.length || 1} line item{order.items?.length > 1 ? 's' : ''} · Order #{order.id}
                          </p>
                        </div>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                          <CreditCard className="size-3.5 text-slate-400" />
                          {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Direct Escrow'}
                        </span>
                      </td>
                      <td>
                        {isCancelled ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                            Cancelled / Void
                          </span>
                        ) : isDelivered ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                            <CheckCircle className="size-3" /> Released
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-200">
                            <ShieldCheck className="size-3 text-amber-600" /> Held in Escrow
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="font-mono font-bold text-slate-900 text-xs">
                          {money(order.total)}
                        </span>
                      </td>
                      <td className="text-right">
                        <Button
                          variant="outline"
                          size="xs"
                          icon={Eye}
                          onClick={() => setSelectedInvoice(order)}
                        >
                          Invoice
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Professional Tax Invoice View Modal */}
      {selectedInvoice && (
        <Modal
          open={Boolean(selectedInvoice)}
          onClose={() => setSelectedInvoice(null)}
          title={`B2B Wholesale Tax Invoice — ${selectedInvoice.id}`}
          size="lg"
        >
          <div className="space-y-6 p-2 text-slate-900">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-extrabold text-xl text-emerald-900">TradeExpress</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 border border-emerald-200 uppercase">
                    Tax Invoice
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Official Marketplace Procurement Record</p>
              </div>

              <div className="sm:text-right text-xs">
                <p className="font-mono font-bold text-slate-900">
                  Invoice #: INV-{selectedInvoice.id.slice(-8).toUpperCase()}
                </p>
                <p className="text-slate-500">Date: {formatDate(selectedInvoice.createdAt)}</p>
                <p className="text-slate-500">Order ID: {selectedInvoice.id}</p>
              </div>
            </div>

            {/* Buyer & Delivery Particulars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-xs">
              <div>
                <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Billed To (Buyer)</span>
                <p className="mt-1 font-bold text-slate-900 text-sm">{user?.name || selectedInvoice.buyerName}</p>
                <p className="text-slate-600">{user?.company || 'Enterprise Procurement Entity'}</p>
                <p className="text-slate-500">{user?.email}</p>
                <p className="text-slate-500">{selectedInvoice.buyerPhone || user?.phone}</p>
              </div>

              <div>
                <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Consignment Destination</span>
                <p className="mt-1 text-slate-700 leading-relaxed font-medium">
                  {selectedInvoice.deliveryAddress?.street || 'Registered Enterprise Address'}
                  <br />
                  {selectedInvoice.deliveryAddress?.city}, {selectedInvoice.deliveryAddress?.state} {selectedInvoice.deliveryAddress?.postalCode}
                  <br />
                  {selectedInvoice.deliveryAddress?.country || 'India'}
                </p>
              </div>
            </div>

            {/* Line items table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Item Description</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right">Tax (GST)</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(selectedInvoice.items || []).map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-3 font-medium text-slate-900">{item.name}</td>
                      <td className="p-3 text-center font-mono">{item.quantity}</td>
                      <td className="p-3 text-right font-mono">{money(item.price)}</td>
                      <td className="p-3 text-right font-mono text-slate-500">18% Included</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {money((item.price || 0) * (item.quantity || 1))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total calculation breakdown */}
            <div className="flex justify-end pt-2">
              <div className="w-full sm:w-64 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono">{money(selectedInvoice.subtotal || selectedInvoice.total * 0.82)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GST / Statutory Tax:</span>
                  <span className="font-mono">{money(selectedInvoice.tax || selectedInvoice.total * 0.18)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Freight & Logistics:</span>
                  <span className="font-mono text-emerald-700 font-medium">Included / ₹0</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-sm text-slate-900">
                  <span>Total Paid:</span>
                  <span className="font-mono text-emerald-800">{money(selectedInvoice.total)}</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="outline" size="sm" onClick={() => setSelectedInvoice(null)}>
                Close
              </Button>
              <Button variant="primary" size="sm" icon={Printer} onClick={() => window.print()}>
                Print / Save PDF
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

