import { useEffect, useState } from 'react';
import {
  LifeBuoy,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
} from 'lucide-react';
import Button from '../common/Button';
import CustomSelect from '../common/CustomSelect';
import Modal from '../common/Modal';
import EmptyState from '../common/EmptyState';
import { TableSkeleton } from '../common/Skeleton';
import useNotifications from '../../hooks/useNotifications';
import { formatDate, formatDateTime } from '../../utils/formatDate';
import { apiGet, apiPatch, apiPost } from '../../services/apiClient';

export default function AdminSupportDesk() {
  const { showToast } = useNotifications();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketDetails, setTicketDetails] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await apiGet('tickets?admin=true');
      if (res && res.data) {
        setTickets(res.data.tickets || []);
      }
    } catch (err) {
      console.warn('Failed to fetch support tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const openTicketModal = async (ticket) => {
    setSelectedTicket(ticket);
    try {
      const res = await apiGet(`tickets/${ticket.id}?admin=true`);
      if (res && res.data) {
        setTicketDetails(res.data);
      } else {
        setTicketDetails(ticket);
      }
    } catch (err) {
      setTicketDetails(ticket);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedTicket) return;

    try {
      setSendingReply(true);
      const res = await apiPost(`tickets/${selectedTicket.id}/messages`, {
        senderRole: 'ADMIN',
        message: replyMessage.trim(),
      });

      showToast('Support reply sent to user.', 'success');
      setReplyMessage('');

      // Refresh ticket details
      const updated = await apiGet(`tickets/${selectedTicket.id}?admin=true`);
      if (updated && updated.data) {
        setTicketDetails(updated.data);
      }
      fetchTickets();
    } catch (err) {
      showToast(err.message || 'Failed to send message', 'error');
    } finally {
      setSendingReply(false);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedTicket) return;
    try {
      setUpdatingStatus(true);
      await apiPatch(`tickets/${selectedTicket.id}/status`, { status: newStatus });
      showToast(`Ticket status updated to ${newStatus}.`, 'success');

      // Refresh details
      const updated = await apiGet(`tickets/${selectedTicket.id}?admin=true`);
      if (updated && updated.data) {
        setTicketDetails(updated.data);
      }
      fetchTickets();
    } catch (err) {
      showToast(err.message || 'Failed to update status', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filtered = tickets.filter((t) => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchSubject = t.subject?.toLowerCase().includes(q);
      const matchUser = t.user?.name?.toLowerCase().includes(q) || t.user?.email?.toLowerCase().includes(q);
      return matchSubject || matchUser;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              placeholder="Search by subject or user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ts-input pl-9"
            />
          </div>
          <div className="w-44">
            <CustomSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'OPEN', label: 'Open Only' },
                { value: 'IN_PROGRESS', label: 'In Progress' },
                { value: 'RESOLVED', label: 'Resolved' },
                { value: 'CLOSED', label: 'Closed' }
              ]}
            />
          </div>
        </div>
        <Button variant="ghost" size="sm" icon={RefreshCw} onClick={fetchTickets} loading={loading}>
          Refresh
        </Button>
      </div>

      {/* Tickets Table */}
      <div className="ts-card overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={LifeBuoy}
            title="No support tickets found"
            text="Support tickets raised by buyers and suppliers will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="ts-table">
              <thead>
                <tr>
                  <th scope="col">Subject</th>
                  <th scope="col">User / Company</th>
                  <th scope="col">Category</th>
                  <th scope="col">Priority</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last Activity</th>
                  <th scope="col" className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <span className="block font-semibold text-navy-900">{ticket.subject}</span>
                      <span className="text-[11px] text-muted">#{ticket.id.slice(0, 8)}</span>
                    </td>
                    <td>
                      <p className="font-semibold text-sm text-ink">{ticket.user?.name || 'User'}</p>
                      <p className="text-xs text-muted">
                        {ticket.user?.company ? `${ticket.user.company} · ` : ''}
                        <span className="uppercase text-[10px] font-bold text-slate-500">{ticket.user?.role}</span>
                      </p>
                    </td>
                    <td>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase text-slate-700">
                        {ticket.category}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${
                          ticket.priority === 'URGENT'
                            ? 'bg-rose-100 text-rose-800'
                            : ticket.priority === 'HIGH'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {ticket.priority}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          ticket.status === 'OPEN'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ticket.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-800'
                            : ticket.status === 'RESOLVED'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-xs text-muted">
                      {formatDate(ticket.updatedAt || ticket.createdAt)}
                    </td>
                    <td className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={MessageCircle}
                        onClick={() => openTicketModal(ticket)}
                      >
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket Details & Mediation Modal */}
      <Modal
        open={Boolean(selectedTicket)}
        onClose={() => {
          setSelectedTicket(null);
          setTicketDetails(null);
        }}
        title={`Support Ticket: ${ticketDetails?.subject || 'Details'}`}
        className="max-w-2xl"
      >
        {ticketDetails && (
          <div className="space-y-4">
            {/* Meta bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700 border">
              <div>
                <span className="font-bold">User: </span>
                {ticketDetails.user?.name} ({ticketDetails.user?.email})
                {ticketDetails.user?.company ? ` · ${ticketDetails.user.company}` : ''}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold uppercase bg-white border px-2 py-0.5 rounded">
                  {ticketDetails.category}
                </span>
                <span className="font-semibold uppercase bg-white border px-2 py-0.5 rounded">
                  {ticketDetails.priority}
                </span>
              </div>
            </div>

            {/* Conversation Thread */}
            <div className="max-h-72 overflow-y-auto space-y-3 p-2 rounded-lg border bg-surface/40">
              {(ticketDetails.messages || []).map((msg) => {
                const isAdmin = msg.senderRole === 'ADMIN';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs ${
                        isAdmin
                          ? 'bg-navy-900 text-white rounded-br-none'
                          : 'bg-white border text-ink shadow-sm rounded-bl-none'
                      }`}
                    >
                      <p className={`font-bold mb-1 text-[11px] ${isAdmin ? 'text-brand-300' : 'text-navy-900'}`}>
                        {isAdmin ? 'TradeExpress Support (Admin)' : ticketDetails.user?.name || 'User'}
                      </p>
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                    </div>
                    <span className="mt-1 text-[10px] text-muted px-1">
                      {formatDateTime(msg.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Admin Status Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <span className="text-xs font-bold text-muted">Status:</span>
              <div className="flex flex-wrap gap-2">
                {ticketDetails.status !== 'IN_PROGRESS' && (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={updatingStatus}
                    onClick={() => handleUpdateStatus('IN_PROGRESS')}
                  >
                    Mark In Progress
                  </Button>
                )}
                {ticketDetails.status !== 'RESOLVED' && (
                  <Button
                    size="sm"
                    variant="success"
                    loading={updatingStatus}
                    onClick={() => handleUpdateStatus('RESOLVED')}
                  >
                    Mark Resolved
                  </Button>
                )}
                {ticketDetails.status !== 'CLOSED' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={updatingStatus}
                    onClick={() => handleUpdateStatus('CLOSED')}
                  >
                    Close Ticket
                  </Button>
                )}
              </div>
            </div>

            {/* Reply Input Form */}
            {ticketDetails.status !== 'CLOSED' && (
              <form onSubmit={handleSendReply} className="border-t pt-3 space-y-2">
                <label htmlFor="adminReply" className="text-xs font-bold text-navy-900">
                  Send Official Admin Reply
                </label>
                <textarea
                  id="adminReply"
                  rows={3}
                  required
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type support response to buyer/supplier..."
                  className="ts-input text-xs"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    icon={Send}
                    loading={sendingReply}
                  >
                    Send Reply
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
