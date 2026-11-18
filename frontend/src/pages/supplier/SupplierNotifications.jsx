import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  ChartColumn,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  FileText,
  Handshake,
  MessageSquareText,
  MoreVertical,
  Package,
  Search,
  Settings,
  ShoppingCart,
  Zap,
  Megaphone,
} from 'lucide-react';
import Button from '../../components/common/Button';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import {
  NOTIFICATION_CATEGORIES, badgeOf, categoryOf, destinationOf, isUnread, notificationSummary, notificationTime, referencesOf, withinDays,
} from '../../utils/notificationView';

const PAGE_SIZE = 10;
const CARD = 'rounded-[1.25rem] border border-[#E2E8E5] bg-white shadow-[0_1px_2px_rgba(20,45,36,0.04),0_10px_28px_-18px_rgba(6,78,59,0.22)]';

const TAB_ICONS = { all: ShoppingCart, orders: ShoppingCart, rfqs: MessageSquareText, products: Package, payments: CircleDollarSign, system: Megaphone };
const ICON_STYLE = {
  orders: ['bg-orange-50 text-orange-600', ShoppingCart],
  rfqs: ['bg-emerald-50 text-[#047857]', MessageSquareText],
  quotation: ['bg-violet-50 text-violet-600', Handshake],
  products: ['bg-blue-50 text-blue-600', Package],
  payments: ['bg-teal-50 text-teal-700', CircleDollarSign],
  system: ['bg-slate-100 text-slate-600', Bell],
};
const BADGE_STYLE = {
  Order: 'bg-orange-50 text-orange-700', RFQ: 'bg-emerald-50 text-[#047857]', Quotation: 'bg-violet-50 text-violet-700',
  Product: 'bg-blue-50 text-blue-700', Payment: 'bg-teal-50 text-teal-700', System: 'bg-slate-100 text-slate-700',
};
const STATUS_OPTIONS = [['all', 'All Status'], ['unread', 'Unread'], ['read', 'Read']];
const DATE_OPTIONS = [[7, 'Last 7 Days'], [30, 'Last 30 Days'], [90, 'Last 90 Days'], [0, 'All Time']];

const selectClass = 'h-9 w-full rounded-lg border border-[#E2E8E5] bg-white px-3 text-[0.8125rem] font-medium text-[#142D24] focus:border-[#047857] focus:outline-none focus:ring-2 focus:ring-emerald-600/20';

function NotificationMenu({ notification, open, onToggle, onClose, onRead, onUnread, onOpen }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', esc); };
  }, [open, onClose]);
  const unread = isUnread(notification);
  const item = 'block w-full rounded-lg px-3 py-2 text-left text-sm text-[#142D24] hover:bg-[#ECFDF5]';
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={onToggle} aria-haspopup="menu" aria-expanded={open} aria-label={`Actions for “${notification.title}”`}
        className="inline-flex size-7 items-center justify-center rounded-lg text-[#142D24] hover:bg-slate-100">
        <MoreVertical className="size-4" aria-hidden="true" />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-9 z-20 w-44 rounded-xl border border-[#E2E8E5] bg-white p-1 shadow-[0_16px_32px_-16px_rgba(20,45,36,0.35)]">
          {unread
            ? <button type="button" role="menuitem" className={item} onClick={() => { onRead(); onClose(); }}>Mark as read</button>
            : <button type="button" role="menuitem" className={item} onClick={() => { onUnread(); onClose(); }}>Mark as unread</button>}
          {onOpen ? <button type="button" role="menuitem" className={item} onClick={() => { onOpen(); onClose(); }}>Open details</button> : null}
        </div>
      ) : null}
    </div>
  );
}

function NotificationCard({ n, menuOpen, setMenuOpen, onOpen, markRead, markUnread }) {
  const unread = isUnread(n);
  const badge = badgeOf(n);
  const [iconTone, Icon] = ICON_STYLE[badge === 'Quotation' ? 'quotation' : categoryOf(n)];
  const { refs, amount } = referencesOf(n);
  const dest = destinationOf(n);
  return (
    <li>
      <div
        role={dest ? 'link' : undefined}
        tabIndex={dest ? 0 : undefined}
        onClick={() => onOpen(n)}
        onKeyDown={(e) => { if (dest && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(n); } }}
        className={`flex gap-3 rounded-xl border px-3.5 py-3 transition-colors ${dest ? 'cursor-pointer' : ''} ${
          unread ? 'border-emerald-100 bg-[#F0FDF4] hover:bg-[#E8FBEF]' : 'border-[#E2E8E5] bg-white hover:bg-[#F8FAF8]'
        }`}
      >
        <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-xl ${iconTone}`}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <p className={`text-[0.8125rem] leading-snug text-[#142D24] ${unread ? 'font-bold' : 'font-semibold'}`}>{n.title}</p>
            <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] text-[#64748B]">
              <Clock className="size-3" aria-hidden="true" />{notificationTime(n)}
            </span>
          </div>
          {n.body || n.message ? <p className="mt-0.5 text-xs leading-relaxed text-[#475569]">{n.body || n.message}</p> : null}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className={`rounded-md px-1.5 py-px text-[11px] font-semibold ${BADGE_STYLE[badge]}`}>{badge}</span>
            {refs.map((r) => <span key={r} className="rounded-md border border-[#E2E8E5] bg-white px-1.5 py-px font-mono text-[11px] font-medium text-[#142D24]">{r}</span>)}
            {amount ? <span className="rounded-md border border-[#E2E8E5] bg-white px-1.5 py-px text-[11px] font-semibold text-[#142D24]">{amount}</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-1.5">
          <span className={`mt-2.5 size-2 rounded-full ${unread ? 'bg-emerald-500' : 'bg-transparent'}`} aria-hidden="true" />
          <span className="sr-only">{unread ? 'Unread' : 'Read'}</span>
          <NotificationMenu
            notification={n}
            open={menuOpen}
            onToggle={() => setMenuOpen(menuOpen ? null : n.id)}
            onClose={() => setMenuOpen(null)}
            onRead={() => markRead(n.id)}
            onUnread={() => markUnread(n.id)}
            onOpen={dest ? () => onOpen(n) : null}
          />
        </div>
      </div>
    </li>
  );
}

export default function SupplierNotifications() {
  useDocumentTitle('Notifications');
  const navigate = useNavigate();
  const { notifications, markRead, markUnread, markAllRead, hasOlderNotifications, backendTotal } = useNotifications();

  const [tab, setTab] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [days, setDays] = useState(30);
  const [shown, setShown] = useState(PAGE_SIZE);
  const [menuOpen, setMenuOpen] = useState(null);

  // Search applies after a short pause in typing
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);
  useEffect(() => { setShown(PAGE_SIZE); }, [tab, search, status, days]);

  const list = notifications || [];
  // Tab counts follow the search, status and date filters, so each tab shows what it will list
  const baseFiltered = useMemo(() => list.filter((n) => {
    if (!withinDays(n, days)) return false;
    if (status === 'unread' && !isUnread(n)) return false;
    if (status === 'read' && isUnread(n)) return false;
    if (search && !`${n.title} ${n.body || n.message || ''}`.toLowerCase().includes(search)) return false;
    return true;
  }), [list, days, status, search]);
  const counts = useMemo(() => {
    const c = { all: baseFiltered.length, orders: 0, rfqs: 0, products: 0, payments: 0, system: 0 };
    for (const n of baseFiltered) c[categoryOf(n)] += 1;
    return c;
  }, [baseFiltered]);
  const visible = tab === 'all' ? baseFiltered : baseFiltered.filter((n) => categoryOf(n) === tab);
  const summary = useMemo(() => notificationSummary(list), [list]);
  const unreadInView = list.filter(isUnread).length;

  // Server-side notification preferences (muted categories are not created) live in Account Settings
  const settingsPath = '/supplier/account-settings/notifications';

  const open = (n) => {
    if (isUnread(n)) markRead(n.id);
    const dest = destinationOf(n);
    if (dest) navigate(dest);
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb + header */}
      <div className="space-y-3">
        <nav aria-label="Breadcrumb" className="text-[0.8125rem]">
          <ol className="flex flex-wrap items-center gap-1.5 text-[#64748B]">
            <li><Link to="/supplier" className="font-medium text-[#142D24] hover:text-[#047857]">Dashboard</Link></li>
            <li aria-hidden="true"><ChevronRight className="size-3.5" /></li>
            <li aria-current="page" className="font-semibold text-[#142D24]">Notifications</li>
          </ol>
        </nav>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#ECFDF5] text-[#064E3B] ring-1 ring-emerald-600/10">
              <Bell className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-xl font-extrabold leading-tight tracking-[-0.02em] text-[#142D24] sm:text-[1.5rem]">Notifications</h1>
              <p className="mt-0.5 text-[0.8125rem] text-[#64748B]">Stay updated with RFQs, orders, quotations, payments, and account alerts.</p>
            </div>
          </div>
          <Link to={settingsPath}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start whitespace-nowrap rounded-full border border-[#E2E8E5] bg-white px-4 text-[0.8125rem] font-semibold text-[#142D24] shadow-[0_4px_14px_-10px_rgba(20,45,36,0.35)] transition-colors hover:border-[#047857]/50 hover:text-[#047857] md:self-auto">
            <Settings className="size-4" aria-hidden="true" /> Notification Settings
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_15.5rem]">
        {/* Main column */}
        <div className="min-w-0 space-y-4">
          {/* Category tabs (scroll sideways on small screens) */}
          <div role="tablist" aria-label="Notification categories" className="ts-no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
            {NOTIFICATION_CATEGORIES.map((c) => {
              const Icon = TAB_ICONS[c.id];
              const active = tab === c.id;
              return (
                <button key={c.id} type="button" role="tab" aria-selected={active} onClick={() => setTab(c.id)}
                  className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-semibold transition-colors ${
                    active ? 'bg-gradient-to-b from-[#047857] to-[#064E3B] text-white shadow-[0_8px_18px_-10px_rgba(6,78,59,0.8)]' : 'border border-[#E2E8E5] bg-white text-[#142D24] hover:border-[#047857]/40'
                  }`}>
                  <Icon className="size-3.5" aria-hidden="true" />
                  {c.label}
                  {c.id === 'all'
                    ? <span className={`rounded-full px-1.5 py-px text-[10px] font-bold ${active ? 'bg-white text-[#064E3B]' : 'bg-[#ECFDF5] text-[#047857]'}`}>{counts.all}</span>
                    : <span>({counts[c.id]})</span>}
                </button>
              );
            })}
          </div>

          <div className={`${CARD} space-y-3 p-3.5 sm:p-4`}>
            {/* Toolbar */}
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[12rem] flex-[1_1_100%] 2xl:flex-[1_1_14rem]">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search notifications..."
                  aria-label="Search notifications"
                  className="h-9 w-full rounded-lg border border-[#E2E8E5] bg-white pl-9 pr-3 text-[0.8125rem] text-[#142D24] placeholder:text-slate-400 focus:border-[#047857] focus:outline-none focus:ring-2 focus:ring-emerald-600/20" />
              </div>
              <select aria-label="Read status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${selectClass} !w-auto flex-1 sm:flex-none sm:min-w-[8.5rem]`}>
                {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <div className="relative flex-1 sm:flex-none sm:min-w-[9.5rem]">
                <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#142D24]" aria-hidden="true" />
                <select aria-label="Date range" value={days} onChange={(e) => setDays(Number(e.target.value))} className={`${selectClass} pl-8`}>
                  {DATE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <button type="button" onClick={markAllRead} disabled={!unreadInView}
                className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[#ECFDF5] px-3 text-[0.8125rem] font-semibold text-[#064E3B] transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">
                <CheckCircle2 className="size-4" aria-hidden="true" /> Mark All as Read
              </button>
            </div>

            {/* List */}
            {visible.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#E2E8E5] bg-[#F8FAF8] px-4 py-12 text-center">
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-[#ECFDF5] text-[#047857]"><Bell className="size-6" aria-hidden="true" /></span>
                <p className="mt-3 font-semibold text-[#142D24]">{list.length ? 'No notifications match these filters' : 'You’re all caught up'}</p>
                <p className="mt-1 max-w-sm text-sm text-[#64748B]">
                  {list.length ? 'Try another category, status or a longer date range such as All Time.' : 'New RFQs, orders, quotation decisions and payment updates will appear here.'}
                </p>
              </div>
            ) : (
              <>
                <ul className="space-y-2.5">
                  {visible.slice(0, shown).map((n) => (
                    <NotificationCard key={`${n.id}-${n.title}`} n={n} menuOpen={menuOpen === n.id} setMenuOpen={setMenuOpen} onOpen={open} markRead={markRead} markUnread={markUnread} />
                  ))}
                </ul>
                <div className="flex flex-col items-center gap-2 pt-1 text-center">
                  <p className="text-xs text-[#64748B]">Showing {Math.min(shown, visible.length)} of {visible.length}</p>
                  {shown < visible.length ? (
                    <Button variant="outline" size="sm" onClick={() => setShown((s) => s + PAGE_SIZE)}>Show more</Button>
                  ) : null}
                  {hasOlderNotifications ? <p className="text-xs text-[#64748B]">Your latest 100 of {backendTotal} notifications are loaded.</p> : null}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right panel */}
        <aside className="space-y-4" aria-label="Notification overview">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#047857] via-[#065F46] to-[#064E3B] p-4 text-white shadow-[0_16px_32px_-18px_rgba(6,78,59,0.9)]">
            <span className="pointer-events-none absolute -left-6 -top-6 size-32 rounded-full bg-emerald-300/20 blur-2xl" aria-hidden="true" />
            <div className="relative flex items-center gap-3">
              <span className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                <Bell className="size-6 text-emerald-200 drop-shadow-[0_0_12px_rgba(167,243,208,0.7)]" aria-hidden="true" />
                {summary.unread ? <span className="absolute -right-1.5 -top-1.5 rounded-full bg-orange-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white ring-2 ring-[#065F46]">{summary.unread > 99 ? '99+' : summary.unread}</span> : null}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-snug">
                  {summary.unread
                    ? <>You have <span className="text-lg">{summary.unread}</span> unread notification{summary.unread === 1 ? '' : 's'}</>
                    : 'You’re all caught up'}
                </p>
                <p className="mt-0.5 text-[11px] text-emerald-50/90">{summary.unread ? 'Check the latest updates and take action.' : 'No unread notifications right now.'}</p>
              </div>
            </div>
          </div>

          <section className={`${CARD} p-4`} aria-labelledby="notif-summary">
            <h2 id="notif-summary" className="flex items-center gap-2 text-sm font-bold text-[#142D24]"><ChartColumn className="size-4 text-[#047857]" aria-hidden="true" /> Notification Summary</h2>
            <dl className="mt-2 space-y-0.5 text-xs">
              {[['Total Notifications', summary.total], ['Unread', summary.unread, true], ['This Week', summary.thisWeek], ['This Month', summary.thisMonth]].map(([label, value, hi]) => (
                <div key={label} className={`flex items-center justify-between rounded-md px-2.5 py-1.5 ${hi ? 'bg-[#ECFDF5]' : ''}`}>
                  <dt className="flex items-center gap-2 text-[#142D24]"><Clock className="size-3 text-[#64748B]" aria-hidden="true" />{label}</dt>
                  <dd className="font-bold text-[#142D24]">{value}</dd>
                </div>
              ))}
            </dl>
            {hasOlderNotifications ? <p className="mt-2 px-3 text-xs text-[#64748B]">Based on your latest 100 notifications.</p> : null}
          </section>

          <section className={`${CARD} p-4`} aria-labelledby="notif-actions">
            <h2 id="notif-actions" className="flex items-center gap-2 text-sm font-bold text-[#142D24]"><Zap className="size-4 text-[#047857]" aria-hidden="true" /> Quick Actions</h2>
            <ul className="mt-2 space-y-1.5">
              {[
                { label: 'View Order Updates', icon: ShoppingCart, to: '/supplier/orders' },
                { label: 'Check RFQs', icon: FileText, to: '/supplier/inquiries' },
                // Quotes are sent and negotiated inside Buyer RFQs (no separate Quotations section)
                { label: 'Review Quotations', icon: Handshake, to: '/supplier/inquiries' },
                { label: 'Manage Notification Settings', icon: Settings, to: settingsPath },
              ].map((a) => {
                const inner = (
                  <>
                    <span className="flex items-center gap-2"><a.icon className="size-3.5 text-[#142D24]" aria-hidden="true" />{a.label}</span>
                    <ChevronRight className="size-3.5 text-[#64748B]" aria-hidden="true" />
                  </>
                );
                const cls = 'flex w-full items-center justify-between rounded-lg border border-[#E2E8E5] px-3 py-2 text-left text-xs font-medium text-[#142D24] transition-colors hover:border-[#047857]/40 hover:bg-[#ECFDF5]';
                return <li key={a.label}><Link to={a.to} className={cls}>{inner}</Link></li>;
              })}
            </ul>
          </section>
        </aside>
      </div>

    </div>
  );
}
