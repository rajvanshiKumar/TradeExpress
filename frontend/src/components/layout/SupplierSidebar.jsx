import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Boxes,
  Building2,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Plus,
  Settings,
  ShieldCheck,
  Truck,
  Warehouse,
  X,
  Star,
  ExternalLink,
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import useMessages from '../../hooks/useMessages';
import useNotifications from '../../hooks/useNotifications';
import useOrders from '../../hooks/useOrders';
import useInquiries from '../../hooks/useInquiries';
import useProducts from '../../hooks/useProducts';
import useSupplierCompany from '../../pages/supplier/useSupplierCompany';

export const SUPPLIER_NAV_GROUPS = [
  {
    group: 'Enterprise Command',
    items: [
      { id: 'overview', label: 'Dashboard Overview', to: '/supplier', icon: LayoutDashboard },
      { id: 'analytics', label: 'Performance Analytics', to: '/supplier/analytics', icon: ChartColumn },
    ],
  },
  {
    group: 'Catalogue & Inventory',
    items: [
      { id: 'products', label: 'Product Catalogue', to: '/supplier/products', icon: Boxes, badgeKey: 'products' },
      { id: 'new-product', label: 'Add New Product', to: '/supplier/products/new', icon: Plus },
      { id: 'inventory', label: 'Real-Time Inventory', to: '/supplier/inventory', icon: Warehouse, badgeKey: 'lowStock' },
    ],
  },
  {
    group: 'Orders & Fulfillment',
    items: [
      { id: 'orders', label: 'Purchase Orders', to: '/supplier/orders', icon: Package, badgeKey: 'orders' },
      { id: 'quotations', label: 'Quotations & RFQs', to: '/supplier/quotations', icon: ClipboardList, badgeKey: 'quotes' },
      { id: 'messages', label: 'Buyer Inquiries', to: '/messages', icon: MessageSquare, badgeKey: 'messages' },
      { id: 'shipping', label: 'Shipping & Logistics', to: '/supplier/shipping', icon: Truck },
    ],
  },
  {
    group: 'Finance & Compliance',
    items: [
      { id: 'payments', label: 'Payments & Payouts', to: '/supplier/payments', icon: CircleDollarSign },
      { id: 'verification', label: 'Business Verification', to: '/supplier/verification', icon: ShieldCheck, badgeKey: 'kyc' },
    ],
  },
  {
    group: 'Account & Settings',
    items: [
      { id: 'profile', label: 'Company Profile', to: '/supplier/profile', icon: Building2 },
      { id: 'notifications', label: 'Notifications', to: '/supplier/notifications', icon: Bell, badgeKey: 'notifications' },
      { id: 'settings', label: 'Store Settings', to: '/supplier/settings', icon: Settings },
    ],
  },
];

export default function SupplierSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { company, companyProducts } = useSupplierCompany();

  // Badges & Real Counts
  const { unreadCount: unreadMessages } = useMessages();
  const { unreadCount: unreadNotifications } = useNotifications();
  const { orders } = useOrders();
  const { inquiries } = useInquiries();

  const myCompanyId = company?.id || user?.companyId || user?.id;

  const activeOrdersCount = useMemo(() => {
    return (orders || []).filter(
      (o) =>
        o.items?.some((item) => item.companyId === myCompanyId) &&
        !['Delivered', 'Cancelled'].includes(o.status)
    ).length;
  }, [orders, myCompanyId]);

  const openQuotesCount = useMemo(() => {
    return (inquiries || []).filter(
      (i) => (i.companyId === myCompanyId || i.supplierId === user?.id) && i.status !== 'Closed'
    ).length;
  }, [inquiries, myCompanyId, user?.id]);

  const lowStockCount = useMemo(() => {
    return (companyProducts || []).filter(
      (p) => Number(p.stock) < Number(p.lowStockThreshold || 10)
    ).length;
  }, [companyProducts]);

  // Desktop collapsible state (persisted)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('tradeexpress_supplier_sidebar_collapsed') === 'true';
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
        localStorage.setItem('tradeexpress_supplier_sidebar_collapsed', String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const isActiveRoute = (itemTo) => {
    if (itemTo === '/supplier') {
      return location.pathname === '/supplier' || location.pathname === '/supplier/' || location.pathname === '/supplier/dashboard';
    }
    return location.pathname === itemTo || location.pathname.startsWith(`${itemTo}/`);
  };

  const getBadgeValue = (badgeKey) => {
    switch (badgeKey) {
      case 'messages':
        return unreadMessages > 0 ? (unreadMessages > 99 ? '99+' : unreadMessages) : null;
      case 'notifications':
        return unreadNotifications > 0 ? (unreadNotifications > 99 ? '99+' : unreadNotifications) : null;
      case 'orders':
        return activeOrdersCount > 0 ? (activeOrdersCount > 99 ? '99+' : activeOrdersCount) : null;
      case 'quotes':
        return openQuotesCount > 0 ? (openQuotesCount > 99 ? '99+' : openQuotesCount) : null;
      case 'lowStock':
        return lowStockCount > 0 ? `${lowStockCount} low` : null;
      case 'products':
        return companyProducts?.length > 0 ? companyProducts.length : null;
      default:
        return null;
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const displayName = company?.name || user?.company || user?.name || 'TradeExpress Merchant';
  const supplierCode = user?.supplierCode || company?.supplierCode || 'SUP-ACTIVE';
  const isVerified = Boolean(company?.isVerified || user?.isVerified);

  return (
    <>
      {/* Mobile Sticky Drawer Header Trigger */}
      <div className="lg:hidden mb-4 flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-800 to-navy-950 font-bold text-white shadow-2xs">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-bold text-navy-950">{displayName}</span>
              {isVerified && (
                <ShieldCheck className="size-3.5 text-emerald-600 shrink-0" />
              )}
            </div>
            <p className="text-[11px] font-medium text-slate-500">Supplier Enterprise Portal</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Slide-Out Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transform bg-white shadow-2xl transition-transform duration-300 ease-in-out lg:hidden flex flex-col ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Supplier Navigation Drawer"
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-emerald-800 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
              Supplier HQ
            </span>
            <span className="text-xs font-bold text-slate-700">{supplierCode}</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Company Summary */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-800 to-navy-950 font-display font-extrabold text-white shadow-sm">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-navy-950">{displayName}</p>
              <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
              {isVerified && (
                <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800">
                  <ShieldCheck className="size-3" /> Verified Enterprise
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 ts-no-scrollbar">
          {SUPPLIER_NAV_GROUPS.map((grp) => (
            <div key={grp.group} className="space-y-1">
              <p className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                {grp.group}
              </p>
              <div className="space-y-0.5">
                {grp.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActiveRoute(item.to);
                  const badge = getBadgeValue(item.badgeKey);

                  return (
                    <Link
                      key={item.id}
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                        active
                          ? 'bg-emerald-800 text-white shadow-2xs font-bold'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-navy-950'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`size-4 shrink-0 ${active ? 'text-amber-300' : 'text-slate-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {badge && (
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                            active
                              ? 'bg-amber-400 text-navy-950'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Logout */}
        <div className="border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="size-4 shrink-0 text-rose-600" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Desktop Sticky Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 transition-all duration-300 ease-in-out lg:sticky lg:top-28 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
        aria-label="Supplier Enterprise Sidebar"
      >
        <div className="flex flex-col rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
          {/* Header Brand Bar */}
          <div className="relative border-b border-slate-200/80 bg-gradient-to-b from-slate-50/90 to-white p-3.5">
            <div className="flex items-center justify-between">
              {!collapsed ? (
                <div className="min-w-0 flex items-center gap-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-800 to-navy-950 font-display font-extrabold text-white shadow-2xs text-sm">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-navy-950">{displayName}</p>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span>{supplierCode}</span>
                      {isVerified && <ShieldCheck className="size-3 text-emerald-600" title="Verified" />}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mx-auto flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-800 to-navy-950 font-bold text-white shadow-2xs text-sm">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Collapse / Expand Toggle Button */}
              <button
                type="button"
                onClick={toggleCollapsed}
                className="flex size-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition shadow-2xs"
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
              </button>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="p-2 space-y-3.5 overflow-y-auto max-h-[calc(100vh-14rem)] ts-no-scrollbar">
            {SUPPLIER_NAV_GROUPS.map((grp) => (
              <div key={grp.group} className="space-y-1">
                {!collapsed && (
                  <p className="px-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    {grp.group}
                  </p>
                )}
                <div className="space-y-0.5">
                  {grp.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActiveRoute(item.to);
                    const badge = getBadgeValue(item.badgeKey);

                    return (
                      <Link
                        key={item.id}
                        to={item.to}
                        aria-current={active ? 'page' : undefined}
                        title={collapsed ? item.label : undefined}
                        className={`group relative flex items-center rounded-xl transition-all ${
                          collapsed
                            ? 'justify-center p-2.5'
                            : 'justify-between px-3 py-2 text-xs font-semibold'
                        } ${
                          active
                            ? 'bg-emerald-800 text-white font-bold shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-navy-950'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={`size-4 shrink-0 transition-colors ${
                              active ? 'text-amber-300' : 'text-slate-400 group-hover:text-slate-700'
                            }`}
                          />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </div>

                        {!collapsed && badge && (
                          <span
                            className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                              active
                                ? 'bg-amber-400 text-navy-950 font-extrabold'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {badge}
                          </span>
                        )}

                        {collapsed && badge && (
                          <span className="absolute top-1.5 right-1.5 flex size-2 rounded-full bg-emerald-600 ring-2 ring-white" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer Action */}
          <div className="border-t border-slate-100 p-2 bg-slate-50/50">
            <button
              type="button"
              onClick={handleLogout}
              className={`flex w-full items-center rounded-xl text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors ${
                collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'
              }`}
              title="Sign Out"
            >
              <LogOut className="size-4 shrink-0 text-rose-600" />
              {!collapsed && <span>Sign Out</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

