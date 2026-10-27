import { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Building2,
  Calendar,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  IndianRupee,
  ShieldCheck,
} from 'lucide-react';
import superAdminApi from '../../api/superAdminApi';
import useNotifications from '../../hooks/useNotifications';

export default function SuperAdminRfqs() {
  const { showToast } = useNotifications();
  const [rfqs, setRfqs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');

  // Inspection modal
  const [selectedRfq, setSelectedRfq] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const fetchRfqs = async (page = 1) => {
    try {
      setLoading(true);
      const res = await superAdminApi.getRfqs({
        page,
        limit: pagination.limit,
        status,
        search,
      });
      setRfqs(res.rfqs);
      setPagination(res.pagination);
    } catch (err) {
      showToast(err.message || 'Failed to load RFQs.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRfqs(1);
  }, [status]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchRfqs(1);
  };

  const inspectRfq = async (rfqId) => {
    try {
      setDetailsLoading(true);
      setDetailsModalOpen(true);
      const data = await superAdminApi.getRfqDetails(rfqId);
      setSelectedRfq(data);
    } catch (err) {
      showToast(err.message || 'Failed to load RFQ quotations.', 'error');
      setDetailsModalOpen(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleStatusChange = async (rfqId, newStatus) => {
    try {
      await superAdminApi.updateRfqStatus(rfqId, newStatus);
      showToast(`RFQ status set to ${newStatus}.`, 'success');
      if (selectedRfq && selectedRfq.id === rfqId) {
        setSelectedRfq({ ...selectedRfq, status: newStatus });
      }
      fetchRfqs(pagination.page);
    } catch (err) {
      showToast(err.message || 'Failed to update RFQ status.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">B2B RFQs & Supplier Quotes</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit wholesale buyer requisitions and compare quotations from registered TradeExpress suppliers.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchRfqs(pagination.page)}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 self-start sm:self-auto"
          title="Refresh RFQs"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by RFQ number, title, buyer name, or company..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </form>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs text-slate-500 font-semibold">Status:</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">All RFQs</option>
            <option value="OPEN">Open (Bidding)</option>
            <option value="QUOTED">Quoted</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* RFQ Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {rfqs.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
            No RFQs recorded in database.
          </div>
        ) : (
          rfqs.map((rfq) => {
            const isOpen = rfq.status === 'OPEN';

            return (
              <div
                key={rfq.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between hover:border-emerald-500/40 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <span className="font-mono text-[11px] font-bold text-slate-400">{rfq.rfqNumber}</span>
                      <h3 className="text-sm font-bold text-slate-900 leading-tight mt-0.5 line-clamp-1">
                        {rfq.title}
                      </h3>
                    </div>

                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isOpen
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {rfq.status}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Buyer:</span>
                      <span className="font-semibold text-slate-800">{rfq.buyerName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Company:</span>
                      <span className="text-slate-800">{rfq.buyerCompany || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Required Qty:</span>
                      <span className="font-bold text-slate-900">{rfq.quantity} {rfq.unit}</span>
                    </div>
                    {rfq.targetPrice && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Target Budget:</span>
                        <span className="font-bold text-emerald-800">
                          ₹{Number(rfq.targetPrice).toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-400">Supplier Quotes:</span>
                      <span className="bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px] border border-emerald-200">
                        {rfq._count?.quotations || 0} quotes
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => inspectRfq(rfq.id)}
                    className="flex-1 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Eye className="size-3.5" />
                    <span>View RFQ & Quotes</span>
                  </button>

                  {isOpen ? (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(rfq.id, 'CLOSED')}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-bold transition-colors"
                    >
                      Close
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(rfq.id, 'OPEN')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quote Comparison Modal */}
      {detailsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="font-mono text-xs font-bold text-slate-400">{selectedRfq?.rfqNumber}</span>
                <h3 className="text-base font-bold text-slate-900">{selectedRfq?.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {detailsLoading ? (
              <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="size-6 animate-spin text-emerald-600" />
                <p className="text-xs">Loading supplier quotations from MySQL...</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Requisition Brief */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-slate-400 block font-semibold">Buyer</span>
                    <span className="font-bold text-slate-900">{selectedRfq?.buyerName}</span>
                    <p className="text-[10px] text-slate-500">{selectedRfq?.buyerCompany}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Quantity</span>
                    <span className="font-bold text-slate-900">{selectedRfq?.quantity} {selectedRfq?.unit}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Target Unit Price</span>
                    <span className="font-bold text-slate-900">
                      {selectedRfq?.targetPrice ? `₹${Number(selectedRfq.targetPrice).toLocaleString('en-IN')}` : 'Open'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Status</span>
                    <span className="font-bold text-emerald-800">{selectedRfq?.status}</span>
                  </div>
                </div>

                {/* Submitted Quotes by Registered Suppliers */}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                    Registered TradeExpress Supplier Quotes ({selectedRfq?.quotations?.length || 0})
                  </h4>

                  {selectedRfq?.quotations?.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center bg-slate-50 rounded-xl border border-slate-100">
                      No suppliers have submitted quotes for this RFQ yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                        <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase">
                          <tr>
                            <th className="py-2.5 px-3">Supplier</th>
                            <th className="py-2.5 px-3">Unit Price</th>
                            <th className="py-2.5 px-3">MOQ</th>
                            <th className="py-2.5 px-3">Lead Time</th>
                            <th className="py-2.5 px-3">GST %</th>
                            <th className="py-2.5 px-3">Freight</th>
                            <th className="py-2.5 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedRfq?.quotations?.map((q) => (
                            <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-900">{q.supplier?.company || q.supplier?.name}</span>
                                  {q.supplier?.isVerified && (
                                    <ShieldCheck className="size-3.5 text-emerald-600" title="Verified Supplier" />
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400">{q.supplier?.city || 'India'}</p>
                              </td>
                              <td className="py-3 px-3 font-bold text-slate-900">
                                ₹{Number(q.unitPrice || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="py-3 px-3">{q.moq || 1}</td>
                              <td className="py-3 px-3">{q.leadTimeDays} days</td>
                              <td className="py-3 px-3">{q.gstPercentage}%</td>
                              <td className="py-3 px-3">₹{Number(q.freightCharge || 0).toLocaleString('en-IN')}</td>
                              <td className="py-3 px-3">
                                <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                  {q.status}
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
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDetailsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
