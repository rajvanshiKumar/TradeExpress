import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  FileText,
  MessageSquare,
  Package,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { formatDate } from '../../utils/formatDate';

export default function BuyerNotifications() {
  const { notifications, unreadCount, markRead, markAllRead, clearNotifications } = useNotifications();
  const [tab, setTab] = useState('ALL');
  useDocumentTitle('Notifications — Buyer Workspace');

  const filtered = useMemo(() => {
    return (notifications || []).filter((item) => {
      if (tab === 'UNREAD') return !item.read;
      if (tab === 'ORDERS') return item.type === 'orders';
      if (tab === 'QUOTES') return item.type === 'quotes';
      return true;
    });
  }, [notifications, tab]);

  const getTypeIcon = (type) => {
    switch (type) {
      case 'orders':
        return <Package className="size-4 text-emerald-700" />;
      case 'quotes':
        return <FileText className="size-4 text-brand-600" />;
      case 'messages':
        return <MessageSquare className="size-4 text-blue-600" />;
      default:
        return <Bell className="size-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Notifications"
        description="Stay updated with order fulfillments, quote updates from suppliers, and marketplace notices."
        actions={
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                icon={CheckCheck}
                onClick={markAllRead}
              >
                Mark all as read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                icon={Trash2}
                onClick={clearNotifications}
                className="text-slate-500 hover:text-rose-600"
              >
                Clear all
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs Filter */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'ALL', label: 'All Alerts', count: notifications.length },
          { id: 'UNREAD', label: 'Unread', count: unreadCount },
          { id: 'ORDERS', label: 'Orders', count: notifications.filter((n) => n.type === 'orders').length },
          { id: 'QUOTES', label: 'Quotes & RFQs', count: notifications.filter((n) => n.type === 'quotes').length },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.id
                ? 'bg-emerald-800 text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            <span>{t.label}</span>
            {t.count > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  tab === t.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {filtered.length === 0 ? (
        <div className="ts-card p-6">
          <EmptyState
            icon={Bell}
            title={tab === 'UNREAD' ? 'No unread notifications' : 'No notifications yet'}
            text="When suppliers update quotes, orders change status, or escrow milestones clear, alerts appear here."
            action={
              <Button to="/buyer" variant="outline" size="sm">
                Back to Dashboard
              </Button>
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs divide-y divide-slate-100">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-3.5 p-4 transition-colors ${
                !item.read ? 'bg-emerald-50/40' : 'hover:bg-slate-50/60'
              }`}
            >
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                {getTypeIcon(item.type)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    {item.title}
                    {!item.read && (
                      <span className="size-2 rounded-full bg-emerald-600" />
                    )}
                  </h4>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">
                    {formatDate(item.at)}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  {item.body}
                </p>

                {item.link && (
                  <div className="mt-2.5 flex items-center gap-3">
                    <Link
                      to={item.link}
                      onClick={() => markRead(item.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-950 transition-colors"
                    >
                      <span>View details</span>
                      <ExternalLink className="size-3" />
                    </Link>
                  </div>
                )}
              </div>

              {!item.read && (
                <button
                  type="button"
                  onClick={() => markRead(item.id)}
                  aria-label="Mark as read"
                  title="Mark as read"
                  className="size-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"
                >
                  <Check className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

