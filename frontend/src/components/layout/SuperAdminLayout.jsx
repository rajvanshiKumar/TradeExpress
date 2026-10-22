import { useState, Suspense } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
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
  AlertTriangle,
  LifeBuoy,
  UserCheck,
  Sliders,
  BarChart3,
  FileCheck2,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Database,
  Lock,
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import useNotifications from '../../hooks/useNotifications';

const NAV_ITEMS = [
  { to: '/super-admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/super-admin/users', label: 'User Directory', icon: Users },
  { to: '/super-admin/suppliers', label: 'KYC & Verification', icon: ShieldCheck },
  { to: '/super-admin/products', label: 'Product Moderation', icon: Package },
  { to: '/super-admin/categories', label: 'Category Taxonomy', icon: Layers },
  { to: '/super-admin/rfqs', label: 'RFQs & Quotes', icon: FileText },
  { to: '/super-admin/orders', label: 'Orders & Shipping', icon: ShoppingBag },
  { to: '/super-admin/payments', label: 'Payments & Escrow', icon: CreditCard },
  { to: '/super-admin/disputes', label: 'Dispute Console', icon: AlertTriangle },
  { to: '/super-admin/tickets', label: 'Support Desk', icon: LifeBuoy },
  { to: '/super-admin/admins', label: 'Admin Staff & Roles', icon: UserCheck },
  { to: '/super-admin/settings', label: 'Platform Settings', icon: Sliders },
  { to: '/super-admin/reports', label: 'Financial Reports', icon: BarChart3 },
  { to: '/super-admin/audit', label: 'Security & Audit Log', icon: FileCheck2 },
];

export default function SuperAdminLayout() {
  const { user, logout } = useAuth();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = () => {
    logout();
    showToast('Signed out of Super Admin enterprise console.', 'info');
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
              <span className="flex items-center justify-center size-9 rounded-lg bg-emerald-500 text-slate-950 font-black text-xl shadow-inner">
                T
              </span>
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
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#123f25] border border-emerald-500/20 text-xs text-emerald-300">
              <Database className="size-3.5 text-emerald-400 animate-pulse" />
              <span className="font-medium">MySQL Aiven Connected</span>
            </div>

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
              <div className="size-8 sm:size-8.5 rounded-full bg-emerald-600 border border-emerald-400 flex items-center justify-center font-bold text-xs text-white shadow-sm shrink-0">
                👑
              </div>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold leading-none text-white whitespace-nowrap">
                    {user?.name || 'Rajvanshi Kumar'}
                  </p>
                  <span className="rounded bg-emerald-500/25 text-emerald-300 text-[9px] font-black px-1.5 py-0.5 border border-emerald-500/40 uppercase whitespace-nowrap">
                    Super Admin
                  </span>
                </div>
                <p className="text-[10px] text-emerald-300/80 leading-tight truncate max-w-[140px] hidden sm:block mt-0.5">
                  {user?.email || 'krajvanshi244@gmail.com'}
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
          className={`fixed inset-y-0 left-0 pt-16 z-30 w-64 shrink-0 bg-[#081d11] border-r border-[#154629] flex flex-col transition-transform duration-200 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:pt-0 lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-4 border-b border-[#123f25]">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[#0f331f] text-emerald-300 text-xs font-medium">
              <Lock className="size-3.5 text-emerald-400" />
              <span>Full Tier 1 Privileges</span>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 custom-scrollbar">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                        : 'text-emerald-100/80 hover:text-white hover:bg-[#123f25]'
                    }`
                  }
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="p-4 border-t border-[#123f25] text-[11px] text-emerald-300/60">
            <p className="font-semibold text-emerald-200">TradeExpress B2B v3.4</p>
            <p>Database: Aiven Cloud MySQL</p>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
