import { useState, Suspense } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import PageOutlet from './PageOutlet';
import { PageSkeleton } from '../common/Skeleton';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Package,
  Layers,
  FileText,
  ShoppingBag,
  CreditCard,
  Sliders,
  UserCog,
  BarChart3,
  FileCheck2,
  FileBadge2,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Lock,
  Truck,
  Warehouse,
  UserX,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';

const NAV_GROUPS = [
  { label: 'Overview', items: [
    { to: '/super-admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/super-admin/reports', label: 'Financial Reports', icon: BarChart3 },
  ] },
  { label: 'Marketplace', items: [
    { to: '/super-admin/users', label: 'User Directory', icon: Users },
    { to: '/super-admin/suppliers', label: 'KYC & Verification', icon: ShieldCheck },
    { to: '/super-admin/supplier-documents', label: 'Supplier Documents', icon: FileBadge2 },
    { to: '/super-admin/deletion-requests', label: 'Account Deletion Requests', icon: UserX },
    { to: '/super-admin/products', label: 'Product Moderation', icon: Package },
    { to: '/super-admin/categories', label: 'Category Taxonomy', icon: Layers },
    { to: '/super-admin/rfqs', label: 'RFQs & Quotes', icon: FileText },
  ] },
  { label: 'Commerce & Operations', items: [
    { to: '/super-admin/orders', label: 'Orders & Shipping', icon: ShoppingBag },
    { to: '/super-admin/inventory', label: 'Inventory Oversight', icon: Warehouse },
    { to: '/super-admin/transport', label: 'Transport & Delivery', icon: Truck },
    { to: '/super-admin/payments', label: 'Payments & Escrow', icon: CreditCard },
  ] },
  { label: 'Governance', items: [
    { to: '/super-admin/audit', label: 'Security & Audit Log', icon: FileCheck2 },
    { to: '/super-admin/settings', label: 'Platform Settings', icon: Sliders },
    { to: '/super-admin/account-settings', label: 'Account Settings', icon: UserCog },
  ] },
];

export default function SuperAdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('te-sa-sidebar-collapsed') === '1'; } catch { return false; } });
  const toggleCollapsed = () => setCollapsed((c) => { try { localStorage.setItem('te-sa-sidebar-collapsed', c ? '0' : '1'); } catch { /* storage unavailable */ } return !c; });

  const handleSignOut = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#f4f7f5] text-slate-900 flex flex-col font-sans w-full overflow-x-hidden">
      {/* Top Enterprise Banner */}
      <header className="sticky top-0 z-40 bg-[#0b2716] border-b border-[#185331] text-white shadow-md">
        <div className="flex items-center justify-between px-4 lg:px-6 h-16">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg text-emerald-200 hover:text-white hover:bg-[#123f25] focus:outline-none"
              aria-label="Toggle Navigation"
            >
              {sidebarOpen ? <X className="size-6" /> : <Menu className="size-6" />}
            </button>
            <Link to="/super-admin" className="flex items-center gap-2.5">
              <img
                src="/logos/tradeexpress-mark.png"
                alt="TradeExpress"
                className="size-8 sm:size-8.5 object-contain shrink-0"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold tracking-tight text-lg text-white">TradeExpress</span>
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase">
                    SUPER ADMIN
                  </span>
                </div>
                <p className="text-[11px] text-emerald-200/70 hidden sm:block">Enterprise Marketplace Governance</p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              to="/"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-200 hover:text-white hover:bg-[#123f25] border border-emerald-500/20 transition-colors"
            >
              <span>Storefront</span>
              <ExternalLink className="size-3.5" />
            </Link>

            <div className="h-6 w-px bg-emerald-800/60 hidden sm:block" />

            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="size-8 sm:size-8.5 rounded-full bg-emerald-600 border border-emerald-400 flex items-center justify-center font-bold text-xs text-white shadow-sm shrink-0" aria-hidden="true">
                {(user?.name || 'SA').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold leading-none text-white whitespace-nowrap">
                    {user?.name || 'Super Admin'}
                  </p>
                  <span className="rounded bg-emerald-500/25 text-emerald-300 text-[9px] font-black px-1.5 py-0.5 border border-emerald-500/40 uppercase whitespace-nowrap">
                    Super Admin
                  </span>
                </div>
                <p className="text-[10px] text-emerald-300/80 leading-tight truncate max-w-[140px] hidden sm:block mt-0.5">
                  {user?.email || ''}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="p-2 rounded-lg text-emerald-300 hover:text-rose-300 hover:bg-rose-950/30 transition-colors"
              title="Sign Out"
            >
              <LogOut className="size-4.5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-w-0 w-full relative">
        {/* Mobile Backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-950/60 z-30 lg:hidden backdrop-blur-xs"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          aria-label="Super Admin navigation"
          className={`fixed inset-y-0 left-0 pt-16 z-30 w-[17rem] shrink-0 bg-[#081d11] border-r border-[#154629] flex flex-col transition-[transform,width] duration-200 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:pt-0 lg:translate-x-0 ${collapsed ? 'lg:w-[4.5rem]' : 'lg:w-[17rem]'} ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className={`flex items-center gap-2 border-b border-[#123f25] p-3 ${collapsed ? 'lg:justify-center' : 'justify-between'}`}>
            <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md bg-[#0f331f] text-emerald-300 text-xs font-medium ${collapsed ? 'lg:hidden' : ''}`}>
              <Lock className="size-3.5 text-emerald-400" />
              <span>Full Tier 1 Privileges</span>
            </div>
            <button type="button" onClick={toggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden size-8 items-center justify-center rounded-lg text-emerald-200 hover:bg-[#123f25] hover:text-white lg:inline-flex">
              {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar">
            {NAV_GROUPS.map((group, gi) => (
              <div key={group.label} className={gi ? 'mt-4' : ''}>
                <p className={`px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300/50 ${collapsed ? 'lg:sr-only' : ''}`}>{group.label}</p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        title={collapsed ? item.label : undefined}
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                          `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-colors duration-150 ${collapsed ? 'lg:justify-center lg:px-0' : ''} ${
                            isActive
                              ? 'bg-emerald-600 text-white shadow-[0_6px_14px_-8px_rgba(16,185,129,0.8)]'
                              : 'text-emerald-100/75 hover:bg-[#123f25] hover:text-white'
                          }`
                        }
                      >
                        <Icon className="size-[1.05rem] shrink-0" aria-hidden="true" />
                        <span className={`truncate ${collapsed ? 'lg:sr-only' : ''}`}>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className={`p-4 border-t border-[#123f25] text-[11px] text-emerald-300/60 ${collapsed ? 'lg:hidden' : ''}`}>
            <p className="font-semibold text-emerald-200">TradeExpress B2B</p>
            <p>Super Admin console</p>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            <Suspense fallback={<PageSkeleton />}>
              <PageOutlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
