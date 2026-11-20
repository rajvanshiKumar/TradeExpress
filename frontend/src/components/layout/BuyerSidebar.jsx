import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileBadge2,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Receipt,
  X,
} from 'lucide-react';
import Logo from '../common/Logo';
import useAuth from '../../hooks/useAuth';
import useNotifications from '../../hooks/useNotifications';
import useWishlist from '../../hooks/useWishlist';
import useOrders from '../../hooks/useOrders';
import useInquiries from '../../hooks/useInquiries';
import useMessages from '../../hooks/useMessages';
import { markQuotesSeen, readSeenQuotes, unseenQuotesCount, writeSeenQuotes } from '../../utils/quoteBadge';
import { markSavedSeen, readSeenSaved, unseenSavedCount, writeSeenSaved } from '../../utils/savedProductsBadge';

export const BUYER_NAV_GROUPS = [
  {
    group: 'Marketplace & Sourcing',
    items: [
      { id: 'overview', label: 'Dashboard', to: '/buyer', icon: LayoutDashboard },
    ],
  },
  {
    group: 'Orders & Transactions',
    items: [
      { id: 'orders', label: 'My Orders', to: '/buyer/orders', icon: Package, badgeKey: 'orders' },
      { id: 'payments', label: 'Payments & Invoices', to: '/buyer/payments', icon: Receipt },
      { id: 'saved', label: 'Saved Products', to: '/buyer/wishlist', icon: Heart, badgeKey: 'wishlist' },
      { id: 'messages', label: 'Messages', to: '/buyer/messages', icon: MessageSquare, badgeKey: 'messages' },
      { id: 'quotes', label: 'My Quotes', to: '/buyer/quotes', icon: ClipboardList, badgeKey: 'quotes' },
    ],
  },
  {
    group: 'Account & Support',
    items: [
      { id: 'documents', label: 'TradeExpress ID & Certificates', to: '/buyer/documents', icon: FileBadge2 },
      { id: 'account-settings', label: 'My Business Profile', to: '/buyer/account-settings', icon: Building2 },
    ],
  },
];

export default function BuyerSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Badges data
  const { unreadCount: unreadNotifications } = useNotifications();
  const { items: savedProducts } = useWishlist();
  const { orders, unseenOrdersCount, markAllOrdersSeen } = useOrders();
  const { inquiries } = useInquiries();
  const { unreadCount: unreadMessages } = useMessages();

  const activeOrdersCount = useMemo(() => {
    return (orders || []).filter(
      (o) => o.buyerId === user?.id && !['Delivered', 'Cancelled'].includes(o.status)
    ).length;
  }, [orders, user?.id]);

  // My Quotes badge: supplier quotes not seen yet (cleared by opening My Quotes, like My Orders)
  const [seenQuoteKeys, setSeenQuoteKeys] = useState(() => readSeenQuotes(user?.id));
  useEffect(() => {
    setSeenQuoteKeys(readSeenQuotes(user?.id));
  }, [user?.id]);
  const newQuotesCount = useMemo(
    () => unseenQuotesCount(inquiries, user?.id, seenQuoteKeys),
    [inquiries, user?.id, seenQuoteKeys]
  );
  useEffect(() => {
    if (!user?.id || location.pathname !== '/buyer/quotes' || newQuotesCount === 0) return;
    const next = markQuotesSeen(inquiries, user.id, seenQuoteKeys);
    writeSeenQuotes(user.id, next);
    setSeenQuoteKeys(next);
  }, [location.pathname, newQuotesCount, inquiries, user?.id, seenQuoteKeys]);

  // Saved Products badge: products saved since the buyer last opened Saved Products
  const savedProductIds = useMemo(() => (savedProducts || []).map((p) => p.id), [savedProducts]);
  const [seenSavedIds, setSeenSavedIds] = useState(() => readSeenSaved(user?.id));
  useEffect(() => {
    setSeenSavedIds(readSeenSaved(user?.id));
  }, [user?.id]);
  const newSavedCount = useMemo(
    () => unseenSavedCount(savedProductIds, seenSavedIds),
    [savedProductIds, seenSavedIds]
  );
  useEffect(() => {
    if (!user?.id || location.pathname !== '/buyer/wishlist' || newSavedCount === 0) return;
    const next = markSavedSeen(savedProductIds);
    writeSeenSaved(user.id, next);
    setSeenSavedIds(next);
  }, [location.pathname, newSavedCount, savedProductIds, user?.id]);

  // Desktop collapsible state (persisted)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('tradeexpress_buyer_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Mobile drawer state
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('tradeexpress_buyer_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Automatically mark orders as seen when viewing /buyer/orders
  useEffect(() => {
    if (location.pathname === '/buyer/orders' && unseenOrdersCount > 0 && markAllOrdersSeen) {
      markAllOrdersSeen();
    }
  }, [location.pathname, unseenOrdersCount, markAllOrdersSeen]);

  // Handle escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login');
    }
  };

  const isItemActive = (to) => {
    if (to === '/buyer') {
      return location.pathname === '/buyer';
    }
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  const getBadgeValue = (key) => {
    if (key === 'notifications' && unreadNotifications > 0) return unreadNotifications;
    if (key === 'wishlist' && newSavedCount > 0) return newSavedCount;
    if (key === 'orders' && unseenOrdersCount > 0) return unseenOrdersCount;
    if (key === 'quotes' && newQuotesCount > 0) return newQuotesCount;
    if (key === 'messages' && unreadMessages > 0) return unreadMessages;
    return null;
  };

  const initials = useMemo(() => {
    if (!user?.name) return 'BP';
    return user.name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }, [user?.name]);

  return (
    <>
      {/* Mobile Top Navigation Bar with Toggle Button */}
      <div className="lg:hidden mb-4 flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open buyer navigation menu"
            className="flex size-10 items-center justify-center rounded-xl bg-slate-50 text-slate-700 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-800 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
          >
            <Menu className="size-5" />
          </button>
          <Logo size="xs" to="/buyer" />
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider text-emerald-800 border border-emerald-200 uppercase">
            Buyer
          </span>
        </div>

        <div className="flex items-center gap-2">
          {unreadNotifications > 0 && (
            <Link
              to="/buyer/notifications"
              className="relative p-2 text-slate-600 hover:text-emerald-800 transition-colors"
              aria-label={`${unreadNotifications} unread notifications`}
            >
              <Bell className="size-5" />
              <span className="absolute top-1 right-1 flex size-2 rounded-full bg-emerald-600 ring-2 ring-white" />
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Off-Canvas Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Off-Canvas Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-76 flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Buyer Navigation Drawer"
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div className="flex items-center gap-2.5">
            <Logo size="sm" to="/buyer" />
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-emerald-800 border border-emerald-200">
              Buyer
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation drawer"
            className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Buyer Profile Header in Drawer */}
        <div className="border-b border-slate-100 bg-slate-50/70 p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-800 font-display font-extrabold text-brand-300 shadow-sm">
              {initials}
              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">{user?.name || 'Buyer Partner'}</p>
              <p className="truncate text-xs text-slate-500">{user?.company || user?.email}</p>
            </div>
          </div>
        </div>

        {/* Scrollable Nav Items */}
        <div className="flex-1 overflow-y-auto overscroll-contain ts-slim-scrollbar scroll-smooth p-3 space-y-6">
          {BUYER_NAV_GROUPS.map((grp) => (
            <div key={grp.group} className="space-y-1">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {grp.group}
              </p>
              <ul className="space-y-0.5">
                {grp.items.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(item.to);
                  const badge = getBadgeValue(item.badgeKey);

                  return (
                    <li key={item.id}>
                      <Link
                        to={item.to}
                        onClick={() => {
                          setMobileOpen(false);
                          if (item.to === '/buyer/orders' && markAllOrdersSeen) markAllOrdersSeen();
                        }}
                        aria-current={active ? 'page' : undefined}
                        className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
                          active
                            ? 'bg-emerald-50 text-emerald-900 font-bold border-l-4 border-emerald-700 shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon
                            className={`size-4.5 shrink-0 transition-colors ${
                              active ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-700'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {badge !== null && (
                          <span className="ml-2 rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                            {badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Drawer Logout Action */}
        <div className="border-t border-slate-100 p-3 bg-white">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="size-4.5 text-rose-500" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Desktop Sticky Sidebar */}
      <aside
        className={`hidden lg:block lg:sticky lg:top-24 transition-all duration-300 ease-in-out shrink-0 select-none ${
          collapsed ? 'w-20' : 'w-68'
        }`}
        aria-label="Buyer Dashboard Navigation"
      >
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-card flex flex-col h-[calc(100dvh-7.5rem)] max-h-[calc(100dvh-7.5rem)]">
          {/* Header Brand Bar & Collapse Toggle */}
          <div
            className={`relative border-b border-emerald-950/40 bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-900 text-white transition-all duration-200 ${
              collapsed
                ? 'flex flex-col items-center justify-center gap-3 py-3.5 px-2'
                : 'flex items-center justify-between p-3.5'
            }`}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_100%_0%,rgb(201_166_107/0.25),transparent_60%)] pointer-events-none" />
            {!collapsed ? (
              <div className="relative flex items-center gap-2.5 min-w-0">
                <Logo size="xs" markOnly light to="/buyer" />
                <div className="min-w-0">
                  <span className="block font-display text-xs font-extrabold tracking-tight text-white leading-tight">
                    TradeExpress
                  </span>
                  <span className="block text-[9px] font-extrabold uppercase tracking-widest text-brand-300">
                    Buyer Portal
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative flex items-center justify-center py-0.5">
                <Logo size="xs" markOnly light to="/buyer" />
              </div>
            )}

            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="relative flex size-7.5 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            </button>
          </div>

          {/* Buyer Identity Profile Pill */}
          <div className="border-b border-slate-100 bg-slate-50/60 p-3">
            {!collapsed ? (
              <div className="flex items-center gap-3">
                <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-800 font-display font-extrabold text-brand-300 shadow-sm ring-1 ring-emerald-900/10">
                  {initials}
                  <span className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ${user?.kycStatus === 'VERIFIED' ? 'bg-emerald-500' : 'bg-amber-400'} ring-2 ring-white`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-xs font-bold text-slate-900">
                      {user?.name || 'Buyer Partner'}
                    </p>
                    <span className={`inline-block size-1.5 rounded-full ${user?.kycStatus === 'VERIFIED' ? 'bg-emerald-600' : 'bg-amber-500'}`} />
                  </div>
                  <p className="truncate text-[11px] font-medium text-slate-500">
                    {user?.company || (user?.kycStatus === 'VERIFIED' ? 'Verified Buyer' : 'Verification Pending')}
                  </p>
                </div>
              </div>
            ) : (
              <div
                className="relative mx-auto flex size-9 items-center justify-center rounded-xl bg-emerald-800 font-display font-extrabold text-brand-300 shadow-sm cursor-default"
                title={`${user?.name || 'Buyer Partner'} (${user?.company || (user?.kycStatus === 'VERIFIED' ? 'Verified Buyer' : 'Verification Pending')})`}
              >
                {initials}
              </div>
            )}
          </div>

          {/* Navigation Groups Feed */}
          <nav
            aria-label="Buyer Workspace Links"
            className="flex-1 overflow-y-auto overscroll-contain ts-slim-scrollbar scroll-smooth p-2.5 space-y-4"
          >
            {BUYER_NAV_GROUPS.map((grp) => (
              <div key={grp.group} className="space-y-0.5">
                {!collapsed && (
                  <p className="px-2.5 pt-1 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    {grp.group}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {grp.items.map((item) => {
                    const Icon = item.icon;
                    const active = isItemActive(item.to);
                    const badge = getBadgeValue(item.badgeKey);

                    return (
                      <li key={item.id}>
                        <Link
                          to={item.to}
                          onClick={() => {
                            if (item.to === '/buyer/orders' && markAllOrdersSeen) markAllOrdersSeen();
                          }}
                          aria-current={active ? 'page' : undefined}
                          title={collapsed ? item.label : undefined}
                          className={`group relative flex items-center rounded-xl transition-all duration-150 ${
                            collapsed
                              ? 'justify-center mx-auto size-10'
                              : 'justify-between px-3 py-2 text-xs font-semibold'
                          } ${
                            active
                              ? collapsed
                                ? 'bg-emerald-100 text-emerald-900 font-bold ring-1 ring-emerald-600/30 shadow-2xs'
                                : 'bg-emerald-50 text-emerald-900 font-bold border-l-[3.5px] border-emerald-700 shadow-2xs'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5 min-w-0'}`}>
                            <Icon
                              className={`size-4.5 shrink-0 transition-colors ${
                                active
                                  ? 'text-emerald-700'
                                  : 'text-slate-400 group-hover:text-slate-700'
                              }`}
                            />
                            {!collapsed && <span className="truncate">{item.label}</span>}
                          </div>

                          {/* Badge indicator: only shown when expanded to avoid floating dots when closed */}
                          {!collapsed && badge !== null && (
                            <span className="ml-2 shrink-0 rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                              {badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {/* Bottom Footer Section: Logout Action */}
          <div className="border-t border-slate-100 p-2.5 bg-slate-50/50">
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sign out of buyer account"
              title={collapsed ? 'Sign Out' : undefined}
              className={`flex items-center rounded-xl text-xs font-semibold text-rose-700 hover:bg-rose-50 hover:text-rose-800 transition-colors ${
                collapsed ? 'mx-auto size-10 justify-center' : 'w-full gap-2.5 px-3 py-2'
              }`}
            >
              <LogOut className="size-4 shrink-0 text-rose-500" />
              {!collapsed && <span>Sign Out</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

