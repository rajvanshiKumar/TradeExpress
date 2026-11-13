import {
  Bell,
  CheckCircle2,
  Package,
  FileText,
  CircleDollarSign,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import useNotifications from '../../hooks/useNotifications';
import { formatDate } from '../../utils/formatDate';

export default function SupplierNotifications() {
  const { notifications, markRead, markAllRead, showToast } = useNotifications();

  function handleMarkAllRead() {
    markAllRead();
    showToast('All notifications marked as read.', 'success');
  }

  function handleMarkRead(id) {
    markRead(id);
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Supplier Notifications"
        description="Real-time alerts for incoming buyer RFQs, quotation acceptances, purchase orders, and escrow payout updates."
        actions={
          <Button variant="outline" size="sm" icon={CheckCircle2} onClick={handleMarkAllRead}>
            Mark All as Read
          </Button>
        }
      />

      {!notifications || notifications.length === 0 ? (
        <div className="ts-card p-8">
          <EmptyState
            icon={Bell}
            title="No notifications"
            text="You are all caught up! New inquiries, order updates, and settlement alerts will appear here."
          />
        </div>
      ) : (
        <div className="ts-card overflow-hidden divide-y divide-slate-100">
          {notifications.map((n) => {
            const isUnread = !n.read && !n.isRead;
            return (
              <div
                key={n.id}
                onClick={() => isUnread && handleMarkRead(n.id)}
                className={`p-4 flex items-start gap-4 transition-colors ${
                  isUnread ? 'bg-emerald-50/30' : 'bg-white hover:bg-slate-50/60'
                }`}
              >
                <div
                  className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${
                    n.type === 'ORDER_UPDATE' || n.type === 'ORDER'
                      ? 'bg-blue-100 text-blue-700'
                      : n.type === 'QUOTATION' || n.type === 'RFQ'
                      ? 'bg-emerald-100 text-emerald-800'
                      : n.type === 'PAYMENT'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {n.type === 'ORDER_UPDATE' || n.type === 'ORDER' ? (
                    <Package className="size-4" />
                  ) : n.type === 'QUOTATION' || n.type === 'RFQ' ? (
                    <FileText className="size-4" />
                  ) : n.type === 'PAYMENT' ? (
                    <CircleDollarSign className="size-4" />
                  ) : (
                    <Bell className="size-4" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-xs text-navy-950 truncate">
                      {n.title}
                    </h4>
                    <span className="text-[10px] text-muted shrink-0 flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatDate(n.createdAt || n.at)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{n.message || n.body}</p>
                  {n.link && (
                    <Button
                      to={n.link}
                      variant="link"
                      size="sm"
                      className="text-xs text-emerald-800 hover:text-emerald-900 mt-1 !p-0 inline-flex items-center gap-1 font-semibold"
                    >
                      <span>View details</span>
                      <ExternalLink className="size-3" />
                    </Button>
                  )}
                </div>

                {isUnread && (
                  <span className="size-2 rounded-full bg-emerald-600 shrink-0 mt-2" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
