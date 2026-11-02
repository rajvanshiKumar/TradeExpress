import { useState, useEffect } from 'react';
import {
  LifeBuoy,
  Search,
  MessageSquare,
  Send,
  RefreshCw,
  CheckCircle2,
  Clock,
  ArrowRight,
  User,
} from 'lucide-react';
import superAdminApi from '../../api/superAdminApi';
import useNotifications from '../../hooks/useNotifications';
import CustomSelect from '../../components/common/CustomSelect';

export default function SuperAdminTickets() {
  const { showToast } = useNotifications();
  const [tickets, setTickets] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');

  // Selected Ticket Modal
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [targetStatus, setTargetStatus] = useState('IN_PROGRESS');
  const [sending, setSending] = useState(false);

  const fetchTickets = async (page = 1) => {
    try {
      setLoading(true);
      const res = await superAdminApi.getSupportTickets({
        page,
        limit: pagination.limit,
        status,
        search,
      });
      setTickets(res.tickets);
      setPagination(res.pagination);
    } catch (err) {
      showToast(err.message || 'Failed to load support tickets.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets(1);
  }, [status]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchTickets(1);
  };

  const openTicket = async (ticketId) => {
    try {
      setLoadingDetails(true);
      setModalOpen(true);
      const data = await superAdminApi.getSupportTicketDetails(ticketId);
      setSelectedTicket(data);
      setTargetStatus(data.status);
      setReplyMessage('');
    } catch (err) {
      showToast(err.message || 'Failed to load ticket.', 'error');
      setModalOpen(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim()) return;

    try {
      setSending(true);
      await superAdminApi.replySupportTicket(selectedTicket.id, {
        message: replyMessage,
        status: targetStatus,
      });
      showToast('Support reply sent.', 'success');
      setReplyMessage('');
      const refreshed = await superAdminApi.getSupportTicketDetails(selectedTicket.id);
      setSelectedTicket(refreshed);
      fetchTickets(pagination.page);
    } catch (err) {
      showToast(err.message || 'Failed to post reply.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Enterprise Support Desk</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Resolve buyer and vendor customer inquiries, account verifications, and technical support cases.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchTickets(pagination.page)}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 self-start sm:self-auto"
          title="Refresh Tickets"
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
            placeholder="Search by subject, user name, or email..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </form>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs text-slate-500 font-semibold">Status:</span>
          <div className="w-40">
            <CustomSelect
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Tickets' },
                { value: 'OPEN', label: 'Open (New)' },
                { value: 'IN_PROGRESS', label: 'In Progress' },
                { value: 'RESOLVED', label: 'Resolved' },
                { value: 'CLOSED', label: 'Closed' }
              ]}
            />
          </div>
        </div>
      </div>

      {/* Tickets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {tickets.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
            No support tickets found in this view.
          </div>
        ) : (
          tickets.map((t) => {
            const isOpen = t.status === 'OPEN';

            return (
              <div
                key={t.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between hover:border-emerald-500/40 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      {t.category}
                    </span>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        isOpen ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mt-2.5 line-clamp-1">{t.subject}</h3>

                  <div className="mt-3 space-y-1 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <User className="size-3 text-slate-400" />
                      <span className="font-semibold text-slate-800">{t.user?.name}</span>
                      <span className="text-[10px] text-slate-400">({t.user?.role})</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">{t.user?.email}</p>
                    <p className="text-[11px] text-slate-400 pt-1">
                      Priority: <strong className="text-slate-700">{t.priority}</strong> | Messages: {t._count?.messages || 0}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => openTicket(t.id)}
                    className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-emerald-950 text-white font-bold text-xs transition-colors flex items-center gap-1.5"
                  >
                    <span>Open Case</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Ticket Details & Reply Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="font-bold text-[10px] text-emerald-800 uppercase tracking-wider">
                  {selectedTicket?.category} • {selectedTicket?.priority} Priority
                </span>
                <h3 className="text-base font-bold text-slate-900">{selectedTicket?.subject}</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {loadingDetails ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw className="size-6 animate-spin text-emerald-600 mx-auto mb-2" />
                <p className="text-xs">Loading case messages...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Messages Feed */}
                <div className="space-y-2.5 max-h-64 overflow-y-auto p-3 rounded-xl bg-slate-50 border border-slate-200">
                  {selectedTicket?.messages?.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No responses in this ticket yet.</p>
                  ) : (
                    selectedTicket?.messages?.map((m) => {
                      const isAdmin = m.senderRole === 'SUPER_ADMIN' || m.senderRole === 'ADMIN';

                      return (
                        <div
                          key={m.id}
                          className={`p-3 rounded-xl text-xs max-w-[85%] ${
                            isAdmin ? 'bg-emerald-900 text-white ml-auto' : 'bg-white border border-slate-200 text-slate-800 mr-auto'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4 mb-1 text-[10px] opacity-75">
                            <span className="font-bold">{m.senderRole}</span>
                            <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p>{m.message}</p>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Reply Form */}
                <form onSubmit={handleSendReply} className="space-y-3 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <label className="font-bold text-slate-700">Send Administrative Reply</label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-semibold">Update Status:</span>
                      <div className="w-36">
                        <CustomSelect
                          value={targetStatus}
                          onChange={(e) => setTargetStatus(e.target.value)}
                          options={[
                            { value: 'IN_PROGRESS', label: 'In Progress' },
                            { value: 'RESOLVED', label: 'Resolved' },
                            { value: 'CLOSED', label: 'Closed' }
                          ]}
                        />
                      </div>
                    </div>
                  </div>

                  <textarea
                    rows="3"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type official support message to the customer..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={sending}
                      className="px-5 py-2 rounded-xl bg-[#0b2716] hover:bg-emerald-950 text-white font-bold transition-colors inline-flex items-center gap-1.5"
                    >
                      <Send className="size-3.5" />
                      <span>{sending ? 'Sending...' : 'Transmit Reply'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
