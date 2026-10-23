import { useEffect, useState } from 'react';
import {
  LifeBuoy,
  Plus,
  Send,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import Button from '../common/Button';
import Modal from '../common/Modal';
import EmptyState from '../common/EmptyState';
import { TableSkeleton } from '../common/Skeleton';
import useAuth from '../../hooks/useAuth';
import useNotifications from '../../hooks/useNotifications';
import { formatDate, formatDateTime } from '../../utils/formatDate';
import { apiGet, apiPost } from '../../services/apiClient';

export default function SupportTicketsSection() {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketDetails, setTicketDetails] = useState(null);

  // New ticket form
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [priority, setPriority] = useState('NORMAL');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reply form
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const fetchUserTickets = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const res = await apiGet(`tickets?userId=${encodeURIComponent(user.id)}`);
      if (res && res.data) {
        setTickets(Array.isArray(res.data) ? res.data : res.data.tickets || []);
      }
    } catch (err) {
      console.warn('Could not fetch user support tickets:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserTickets();
  }, [user?.id]);

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    try {
      setSubmitting(true);
      await apiPost('tickets', {
        userId: user.id,
        subject: subject.trim(),
        category,
        priority,
        message: message.trim(),
      });

      showToast('Support ticket raised. Our team will respond shortly.', 'success');
      setSubject('');
      setMessage('');
      setCategory('GENERAL');
      setPriority('NORMAL');
      setNewModalOpen(false);
      fetchUserTickets();
    } catch (err) {
      showToast(err.message || 'Failed to submit ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openTicketThread = async (ticket) => {
    setSelectedTicket(ticket);
    try {
      const res = await apiGet(`tickets/${ticket.id}?userId=${encodeURIComponent(user?.id || '')}`);
      if (res && res.data) {
        setTicketDetails(res.data);
      } else {
        setTicketDetails(ticket);
      }
    } catch {
      setTicketDetails(ticket);
    }
  };

  const handleSendUserReply = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedTicket) return;

    try {
      setSendingReply(true);
      await apiPost(`tickets/${selectedTicket.id}/messages`, {
        senderRole: 'USER',
        message: replyMessage.trim(),
      });

      showToast('Message sent to support team.', 'success');
      setReplyMessage('');

      const updated = await apiGet(`tickets/${selectedTicket.id}?userId=${encodeURIComponent(user?.id || '')}`);
      if (updated && updated.data) {
        setTicketDetails(updated.data);
      }
      fetchUserTickets();
    } catch (err) {
      showToast(err.message || 'Failed to send reply', 'error');
    } finally {
      setSendingReply(false);
    }
  };

  if (!user) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
        <LifeBuoy className="mx-auto size-8 text-brand-600 mb-2" />
        <h3 className="text-base font-bold text-navy-900">Need Help or Have a Trade Query?</h3>
        <p className="mt-1 text-sm text-muted">Sign in to your TradeExpress account to raise support tickets and receive official responses.</p>
        <div className="mt-4 flex justify-center gap-3">
          <Button to="/login" variant="navy" size="sm">Sign In</Button>
          <Button to="/info/contact" variant="outline" size="sm">Contact Public Desk</Button>
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="support-tickets-heading" className="ts-card p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
        <div>
          <h2 id="support-tickets-heading" className="text-lg font-bold text-navy-900 flex items-center gap-2">
            <LifeBuoy className="size-5 text-brand-600" />
            Support & Help Desk
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Direct communication with TradeExpress marketplace operations & dispute staff.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={() => setNewModalOpen(true)}
        >
          Raise Ticket
        </Button>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : tickets.length === 0 ? (
        <div className="rounded-xl bg-slate-50 p-6 text-center border border-dashed">
          <HelpCircle className="mx-auto size-7 text-slate-400 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No open support tickets</p>
          <p className="text-xs text-muted mt-1">Have an issue with an order, billing, or shipping? Create a ticket and we will assist you.</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => setNewModalOpen(true)}
          >
            Create Your First Ticket
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {tickets.map((t) => (
            <div
              key={t.id}
              className="py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/60 px-2 rounded-lg transition-colors cursor-pointer"
              onClick={() => openTicketThread(t)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-navy-900 truncate">
                    {t.subject}
                  </span>
                  <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-bold uppercase text-slate-600">
                    {t.category}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  Ticket #{t.id.slice(0, 8)} · Created {formatDate(t.createdAt)} · {t._count?.messages || 1} messages
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    t.status === 'OPEN'
                      ? 'bg-emerald-100 text-emerald-800'
                      : t.status === 'IN_PROGRESS'
                      ? 'bg-blue-100 text-blue-800'
                      : t.status === 'RESOLVED'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {t.status}
                </span>
                <Button variant="ghost" size="sm" icon={MessageCircle}>
                  View Thread
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Raise New Ticket Modal */}
      <Modal
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        title="Raise a Support Ticket"
        className="max-w-lg"
      >
        <form onSubmit={handleCreateTicket} className="space-y-4">
          <div>
            <label htmlFor="ticketSubject" className="ts-label">
              Subject
            </label>
            <input
              id="ticketSubject"
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Inquiry regarding order shipment ETA"
              className="ts-input mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ticketCategory" className="ts-label">
                Category
              </label>
              <select
                id="ticketCategory"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="ts-input mt-1"
              >
                <option value="GENERAL">General Inquiry</option>
                <option value="ORDER">Order & Shipping</option>
                <option value="BILLING">Billing & GST</option>
                <option value="TECHNICAL">Technical / Account</option>
              </select>
            </div>
            <div>
              <label htmlFor="ticketPriority" className="ts-label">
                Priority
              </label>
              <select
                id="ticketPriority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="ts-input mt-1"
              >
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent (Delayed Shipment)</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="ticketMessage" className="ts-label">
              Description
            </label>
            <textarea
              id="ticketMessage"
              rows={4}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue with relevant Order/RFQ numbers..."
              className="ts-input mt-1"
            />
          </div>

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button type="button" variant="outline" onClick={() => setNewModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Submit Ticket
            </Button>
          </div>
        </form>
      </Modal>

      {/* Ticket Details & Chat Modal */}
      <Modal
        open={Boolean(selectedTicket)}
        onClose={() => {
          setSelectedTicket(null);
          setTicketDetails(null);
        }}
        title={`Ticket: ${ticketDetails?.subject || 'Details'}`}
        className="max-w-xl"
      >
        {ticketDetails && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700 border">
              <div>
                <span className="font-bold">Status: </span>
                <span
                  className={`rounded px-2 py-0.5 font-bold uppercase text-[10px] ${
                    ticketDetails.status === 'OPEN'
                      ? 'bg-emerald-100 text-emerald-800'
                      : ticketDetails.status === 'IN_PROGRESS'
                      ? 'bg-blue-100 text-blue-800'
                      : ticketDetails.status === 'RESOLVED'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {ticketDetails.status}
                </span>
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

            {/* Message thread */}
            <div className="max-h-72 overflow-y-auto space-y-3 p-2 rounded-lg border bg-surface/40">
              {(ticketDetails.messages || []).map((msg) => {
                const isAdmin = msg.senderRole === 'ADMIN';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isAdmin ? 'items-start' : 'items-end'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs ${
                        isAdmin
                          ? 'bg-white border text-ink shadow-sm rounded-bl-none'
                          : 'bg-navy-900 text-white rounded-br-none'
                      }`}
                    >
                      <p className={`font-bold mb-1 text-[11px] ${isAdmin ? 'text-brand-600' : 'text-brand-300'}`}>
                        {isAdmin ? 'TradeExpress Help Desk (Support Agent)' : 'You'}
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

            {/* Reply box if not closed */}
            {ticketDetails.status !== 'CLOSED' ? (
              <form onSubmit={handleSendUserReply} className="border-t pt-3 space-y-2">
                <label htmlFor="userReply" className="text-xs font-bold text-navy-900">
                  Send Follow-up Message
                </label>
                <textarea
                  id="userReply"
                  rows={2}
                  required
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your message to support..."
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
            ) : (
              <p className="text-center text-xs text-muted border-t pt-3">
                This support ticket has been closed. If you need further assistance, please open a new ticket.
              </p>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}
