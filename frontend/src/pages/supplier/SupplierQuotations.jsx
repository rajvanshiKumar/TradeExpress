import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  Search,
  Filter,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Plus,
  Send,
  FileText,
  IndianRupee,
  Truck,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import { TableSkeleton } from '../../components/common/Skeleton';
import useCurrency from '../../hooks/useCurrency';
import useNotifications from '../../hooks/useNotifications';
import { fetchSupplierQuotations, submitSupplierQuotation } from '../../services/supplierDashboardApi';
import { formatDate } from '../../utils/formatDate';

const STATUS_TABS = [
  { id: 'ALL', label: 'All Quotes' },
  { id: 'SENT', label: 'Submitted' },
  { id: 'ACCEPTED', label: 'Accepted' },
  { id: 'COUNTERED', label: 'Negotiation' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'EXPIRED', label: 'Expired' },
];

export default function SupplierQuotations() {
  const { money } = useCurrency();
  const { showToast } = useNotifications();

  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    loadQuotes();
  }, [activeTab]);

  async function loadQuotes() {
    setLoading(true);
    try {
      const res = await fetchSupplierQuotations({
        status: activeTab === 'ALL' ? undefined : activeTab,
        search: search.trim() || undefined,
      });
      setQuotations(res?.data || []);
    } catch (err) {
      showToast(err.message || 'Failed to load quotations', 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    loadQuotes();
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="My Quotations & Proposals"
        description="Manage submitted price proposals, monitor validity periods, and review buyer contract terms."
        actions={
          <Button to="/supplier/inquiries" size="sm" icon={FileText} variant="navy">
            View Buyer RFQs
          </Button>
        }
      />

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-navy-900/[0.08] pb-3">
        <div className="ts-no-scrollbar flex gap-2 overflow-x-auto">
          {STATUS_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'bg-white text-navy-800 ring-1 ring-navy-900/10 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSearchSubmit} className="relative sm:w-64">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by quote # or buyer..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-navy-950 focus:border-emerald-700 focus:outline-none"
          />
          <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
        </form>
      </div>

      {/* Quotation Table / Cards */}
      {loading ? (
        <div className="ts-card p-6">
          <TableSkeleton />
        </div>
      ) : quotations.length === 0 ? (
        <div className="ts-card p-8">
          <EmptyState
            icon={ClipboardList}
            title="No quotations found"
            text={
              activeTab === 'ALL'
                ? "You haven't submitted any quotations yet. Browse active buyer RFQs to propose pricing."
                : `No quotations found with status "${activeTab}".`
            }
            action={
              <Button to="/supplier/inquiries" variant="primary" size="sm">
                Browse Buyer RFQs
              </Button>
            }
          />
        </div>
      ) : (
        <div className="ts-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-slate-50/80 font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Quote ID & RFQ</th>
                  <th className="px-4 py-3.5">Buyer</th>
                  <th className="px-4 py-3.5">Unit Price & MOQ</th>
                  <th className="px-4 py-3.5">Grand Total</th>
                  <th className="px-4 py-3.5">Lead Time</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-navy-950">
                {quotations.map((q) => {
                  const isExpiring =
                    q.status === 'SENT' &&
                    q.validityDate &&
                    (new Date(q.validityDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 3 &&
                    new Date(q.validityDate).getTime() > Date.now();

                  return (
                    <tr key={q.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-mono font-bold text-emerald-800 block text-xs">
                          {q.quoteNumber}
                        </span>
                        <span className="text-[11px] text-muted truncate max-w-xs block mt-0.5">
                          {q.rfq?.title || 'Wholesale Requirement'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-semibold block">{q.rfq?.buyerCompany || q.rfq?.buyerName || 'Buyer'}</span>
                        <span className="text-[11px] text-muted">{q.rfq?.destinationCountry || 'India'}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-bold text-navy-900 block">{money(q.unitPrice)}</span>
                        <span className="text-[11px] text-muted">MOQ: {q.moq} {q.rfq?.unit || 'units'}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-black text-emerald-900 block">{money(q.grandTotal || (q.unitPrice * (q.rfq?.quantity || 1)))}</span>
                        <span className="text-[10px] text-muted">incl. GST & Freight</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-xs">{q.leadTimeDays} days</span>
                        {q.estimatedDeliveryDate && (
                          <span className="text-[10px] text-muted block">
                            Est: {formatDate(q.estimatedDeliveryDate)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            q.status === 'ACCEPTED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : q.status === 'SENT'
                              ? 'bg-blue-100 text-blue-800'
                              : q.status === 'COUNTERED'
                              ? 'bg-amber-100 text-amber-800'
                              : q.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {q.status}
                        </span>
                        {isExpiring && (
                          <span className="block text-[10px] text-amber-600 font-bold mt-1">
                            ⚠️ Expiring soon
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          icon={Eye}
                          onClick={() => {
                            setSelectedQuote(q);
                            setShowDetailModal(true);
                          }}
                          className="text-xs"
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quote Details Modal */}
      {selectedQuote && (
        <Modal
          open={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          title={`Quotation #${selectedQuote.quoteNumber}`}
          className="max-w-2xl"
        >
          <div className="space-y-5 text-xs text-navy-950">
            {/* Header Summary */}
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 flex flex-wrap justify-between items-center gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted block">Inquiry / RFQ</span>
                <p className="font-bold text-sm text-navy-900">{selectedQuote.rfq?.title}</p>
                <p className="text-muted text-[11px]">
                  Buyer: {selectedQuote.rfq?.buyerCompany || selectedQuote.rfq?.buyerName} · Qty: {selectedQuote.rfq?.quantity} {selectedQuote.rfq?.unit || 'units'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-muted block">Proposal Status</span>
                <span className="rounded-full bg-emerald-100 text-emerald-800 font-bold px-3 py-1 text-xs">
                  {selectedQuote.status}
                </span>
              </div>
            </div>

            {/* Financial Breakdown Table */}
            <div>
              <h4 className="font-bold text-navy-900 mb-2 border-b pb-1 text-sm">Commercial & Cost Breakdown</h4>
              <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-100">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-muted">Unit Base Price:</span>
                  <span className="font-semibold font-mono">{money(selectedQuote.unitPrice)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-muted">Target Quantity:</span>
                  <span className="font-semibold">{selectedQuote.rfq?.quantity || 1} {selectedQuote.rfq?.unit || 'units'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-muted">Subtotal (Goods):</span>
                  <span className="font-semibold font-mono">{money(selectedQuote.subtotal || (selectedQuote.unitPrice * (selectedQuote.rfq?.quantity || 1)))}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-muted">Freight & Logistics Charge:</span>
                  <span className="font-semibold font-mono">{money(selectedQuote.freightCharge || 0)}</span>
                </div>
                {Number(selectedQuote.otherCharges || 0) > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-muted">Other Charges ({selectedQuote.otherChargesDesc || 'Handling'}):</span>
                    <span className="font-semibold font-mono">{money(selectedQuote.otherCharges)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-muted">Taxable Amount:</span>
                  <span className="font-semibold font-mono">{money(selectedQuote.taxableAmount || selectedQuote.subtotal)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-muted">Applicable GST ({selectedQuote.gstPercentage || 18}%):</span>
                  <span className="font-semibold font-mono text-emerald-800">+{money(selectedQuote.gstAmount || 0)}</span>
                </div>
                <div className="flex justify-between py-2 text-sm font-black border-t-2 border-slate-900 pt-2">
                  <span className="text-navy-950">Grand Total Proposal:</span>
                  <span className="text-emerald-900 font-mono">{money(selectedQuote.grandTotal || (selectedQuote.unitPrice * (selectedQuote.rfq?.quantity || 1)))}</span>
                </div>
              </div>
            </div>

            {/* Logistics & Commercial Terms */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100 text-[11px]">
              <div>
                <span className="text-muted block">Shipping Method:</span>
                <span className="font-semibold text-navy-900">{selectedQuote.shippingMethod || 'Standard Surface Express'}</span>
              </div>
              <div>
                <span className="text-muted block">Lead Time:</span>
                <span className="font-semibold text-navy-900">{selectedQuote.leadTimeDays} Calendar Days</span>
              </div>
              <div>
                <span className="text-muted block">Payment Terms:</span>
                <span className="font-semibold text-navy-900">{selectedQuote.paymentTerms || '100% Escrow Advance'}</span>
              </div>
              <div>
                <span className="text-muted block">Quote Validity:</span>
                <span className="font-semibold text-navy-900">{selectedQuote.validityDate ? formatDate(selectedQuote.validityDate) : '14 Days from issuance'}</span>
              </div>
            </div>

            {selectedQuote.notes && (
              <div>
                <span className="font-bold text-navy-900 block mb-1">Supplier Notes & Terms:</span>
                <p className="p-2.5 rounded-lg bg-amber-50/50 border border-amber-100 text-slate-700 text-xs italic">
                  "{selectedQuote.notes}"
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowDetailModal(false)}>
                Close
              </Button>
              <Button
                to={`/messages`}
                variant="primary"
                size="sm"
                icon={Send}
              >
                Message Buyer
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
