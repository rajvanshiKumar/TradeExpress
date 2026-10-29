import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Search,
  MessageSquare,
  ShieldCheck,
  Send,
  IndianRupee,
  RefreshCw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import superAdminApi from '../../api/superAdminApi';
import useNotifications from '../../hooks/useNotifications';
import CustomSelect from '../../components/common/CustomSelect';

export default function SuperAdminDisputes() {
  const { showToast } = useNotifications();
  const [disputes, setDisputes] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');

  // Selected Dispute Console
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Resolution Form
  const [adminMessage, setAdminMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [resolutionAction, setResolutionAction] = useState('REFUND_BUYER');
  const [resolutionText, setResolutionText] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [resolving, setResolving] = useState(false);

  const fetchDisputes = async (page = 1) => {
    try {
      setLoading(true);
      const res = await superAdminApi.getDisputes({
        page,
        limit: pagination.limit,
        status,
        search,
      });
      setDisputes(res.disputes);
      setPagination(res.pagination);
    } catch (err) {
      showToast(err.message || 'Failed to fetch disputes.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes(1);
  }, [status]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDisputes(1);
  };

  const openConsole = async (disputeId) => {
    try {
      setLoadingDetails(true);
      setConsoleOpen(true);
      const data = await superAdminApi.getDisputeDetails(disputeId);
      setSelectedDispute(data);
      setRefundAmount(String(data.order?.total || ''));
      setResolutionText('');
      setAdminMessage('');
    } catch (err) {
      showToast(err.message || 'Failed to load dispute conversation.', 'error');
      setConsoleOpen(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!adminMessage.trim()) return;

    try {
      setSendingMsg(true);
      await superAdminApi.addDisputeMessage(selectedDispute.id, { message: adminMessage });
      setAdminMessage('');
      const refreshed = await superAdminApi.getDisputeDetails(selectedDispute.id);
      setSelectedDispute(refreshed);
    } catch (err) {
      showToast(err.message || 'Failed to send message.', 'error');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleResolveSubmit = async () => {
    if (!resolutionText.trim()) {
      showToast('Please summarize the official mediation resolution.', 'error');
      return;
    }

    try {
      setResolving(true);
      await superAdminApi.resolveDispute(selectedDispute.id, {
        resolution: resolutionText,
        action: resolutionAction,
        refundAmount: resolutionAction === 'REFUND_BUYER' ? refundAmount : 0,
      });
      showToast('Dispute resolved and escrow instruction executed.', 'success');
      const refreshed = await superAdminApi.getDisputeDetails(selectedDispute.id);
      setSelectedDispute(refreshed);
      fetchDisputes(pagination.page);
    } catch (err) {
      showToast(err.message || 'Failed to resolve dispute.', 'error');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">B2B Dispute Mediation Center</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Fairly adjudicate merchant-buyer grievances, review photographic proofs, and govern escrow releases.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchDisputes(pagination.page)}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 self-start sm:self-auto"
          title="Refresh Disputes"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order number, buyer name, dispute reason..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </form>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs text-slate-500 font-semibold">Dispute Status:</span>
          <div className="w-44">
            <CustomSelect
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Disputes' },
                { value: 'OPEN', label: 'Open (Active)' },
                { value: 'UNDER_REVIEW', label: 'Under Review' },
                { value: 'RESOLVED_REFUND', label: 'Resolved (Refunded)' },
                { value: 'RESOLVED_REJECTED', label: 'Resolved (Rejected)' }
              ]}
            />
          </div>
        </div>
      </div>

      {/* Disputes List */}
      <div className="space-y-4">
        {disputes.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
            No disputes filed in this status view.
          </div>
        ) : (
          disputes.map((d) => {
            const isOpen = d.status === 'OPEN' || d.status === 'UNDER_REVIEW';

            return (
              <div
                key={d.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 hover:border-emerald-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isOpen ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {d.status}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-400">
                      Order #{d.order?.orderNumber}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">{d.reason}</h3>
                  <p className="text-xs text-slate-500 line-clamp-1">{d.description}</p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                    <span>Buyer: <strong className="text-slate-800">{d.buyer?.name}</strong></span>
                    <span>Supplier: <strong className="text-slate-800">{d.order?.supplier?.company || 'Direct'}</strong></span>
                    <span>Order Value: <strong className="text-slate-800">₹{Number(d.order?.total || 0).toLocaleString('en-IN')}</strong></span>
                    <span>Messages: <strong className="text-emerald-700">{d._count?.messages || 0}</strong></span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openConsole(d.id)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-emerald-950 text-white font-bold text-xs transition-colors shrink-0 self-start sm:self-auto flex items-center gap-1.5"
                >
                  <span>Open Console</span>
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Dispute Resolution Console Modal */}
      {consoleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-xl border border-slate-200 max-h-[92vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
                  <AlertTriangle className="size-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Dispute Mediation #{selectedDispute?.order?.orderNumber}
                  </h3>
                  <p className="text-xs text-slate-500">{selectedDispute?.reason}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConsoleOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {loadingDetails ? (
              <div className="py-16 text-center text-slate-400">
                <RefreshCw className="size-6 animate-spin text-emerald-600 mx-auto mb-2" />
                <p className="text-xs">Loading dispute timeline...</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Dispute Dossier */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <span className="text-slate-400 block font-semibold">Buyer</span>
                      <span className="font-bold text-slate-800">{selectedDispute?.buyer?.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold">Supplier</span>
                      <span className="font-bold text-slate-800">{selectedDispute?.order?.supplier?.company || 'Direct'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold">Escrow Held</span>
                      <span className="font-bold text-emerald-800">
                        ₹{Number(selectedDispute?.order?.escrowLedger?.amountHeld || selectedDispute?.order?.total || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold">Status</span>
                      <span className="font-bold text-slate-900">{selectedDispute?.status}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200">
                    <span className="font-bold text-slate-700">Buyer Statement:</span>
                    <p className="text-slate-600 mt-0.5">{selectedDispute?.description}</p>
                  </div>

                  {selectedDispute?.photoProof && (
                    <div className="pt-2">
                      <span className="font-bold text-slate-700">Photographic Evidence:</span>
                      <a
                        href={selectedDispute.photoProof}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-700 underline font-semibold ml-2"
                      >
                        View Photo Proof
                      </a>
                    </div>
                  )}

                  {selectedDispute?.resolution && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 mt-2">
                      <span className="font-bold">Formal Decision:</span> {selectedDispute.resolution}
                    </div>
                  )}
                </div>

                {/* Mediation Conversation Thread */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Mediation Thread ({selectedDispute?.messages?.length || 0})
                  </h4>

                  <div className="space-y-2.5 max-h-60 overflow-y-auto p-3 rounded-xl bg-slate-50 border border-slate-200">
                    {selectedDispute?.messages?.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">No thread messages yet.</p>
                    ) : (
                      selectedDispute?.messages?.map((msg) => {
                        const isAdmin = msg.senderRole === 'SUPER_ADMIN' || msg.senderRole === 'ADMIN';
                        const isBuyer = msg.senderRole === 'BUYER';

                        return (
                          <div
                            key={msg.id}
                            className={`p-3 rounded-xl text-xs max-w-[85%] ${
                              isAdmin
                                ? 'bg-emerald-900 text-white ml-auto'
                                : isBuyer
                                ? 'bg-white border border-slate-200 text-slate-800 mr-auto'
                                : 'bg-slate-200 text-slate-900 mr-auto'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4 mb-1 text-[10px] opacity-75">
                              <span className="font-bold">{msg.senderRole}</span>
                              <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p>{msg.message}</p>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Send Admin Message Form */}
                  <form onSubmit={handleSendMessage} className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={adminMessage}
                      onChange={(e) => setAdminMessage(e.target.value)}
                      placeholder="Post official mediation instructions or question..."
                      className="flex-1 p-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="submit"
                      disabled={sendingMsg}
                      className="px-4 py-2 rounded-xl bg-[#0b2716] text-white text-xs font-bold hover:bg-emerald-950 transition-colors inline-flex items-center gap-1.5"
                    >
                      <Send className="size-3.5" />
                      <span>{sendingMsg ? 'Posting...' : 'Post Note'}</span>
                    </button>
                  </form>
                </div>

                {/* Final Ruling / Resolution Console */}
                {selectedDispute?.status === 'OPEN' || selectedDispute?.status === 'UNDER_REVIEW' ? (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3 text-xs">
                    <h4 className="font-bold text-slate-800 uppercase tracking-wider">Execute Final Adjudication</h4>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">Mediation Verdict</label>
                        <CustomSelect
                          value={resolutionAction}
                          onChange={(e) => setResolutionAction(e.target.value)}
                          options={[
                            { value: 'REFUND_BUYER', label: 'Refund Buyer (Full / Partial)' },
                            { value: 'RELEASE_SUPPLIER', label: 'Release Escrow to Supplier' },
                            { value: 'REJECT_CLAIM', label: 'Reject Dispute Claim' }
                          ]}
                        />
                      </div>

                      {resolutionAction === 'REFUND_BUYER' && (
                        <div>
                          <label className="block font-semibold text-slate-600 mb-1">Refund Amount (₹)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                            className="w-full p-2 rounded-lg border border-slate-200 bg-white font-bold"
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">
                        Resolution Summary & Rationale <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows="2"
                        value={resolutionText}
                        onChange={(e) => setResolutionText(e.target.value)}
                        placeholder="Detail the investigation outcome for both parties..."
                        className="w-full p-2 rounded-lg border border-slate-200 bg-white"
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        disabled={resolving}
                        onClick={handleResolveSubmit}
                        className="px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs transition-colors"
                      >
                        {resolving ? 'Executing...' : 'Authorize Adjudication & Close'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConsoleOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Close Console
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
