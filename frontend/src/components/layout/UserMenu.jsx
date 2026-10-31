import { Link, useNavigate } from 'react-router-dom';
import {
  BadgePercent,
  Building2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Package,
  Scale,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import Dropdown from '../common/Dropdown';
import useAuth from '../../hooks/useAuth';
import { useTranslation } from '../../i18n/LanguageContext';
import { ordersPathFor, ROLE_HOME } from '../../utils/constants';

const ROLE_BADGES = {
  super_admin: {
    label: 'Super Admin',
    bg: 'bg-emerald-950 text-emerald-300 border-emerald-700/60 ring-emerald-500/30',
    icon: '👑',
  },
  admin: {
    label: 'Admin',
    bg: 'bg-slate-900 text-brand-300 border-brand-500/40 ring-brand-500/20',
    icon: '🛡️',
  },
  supplier: {
    label: 'Supplier',
    bg: 'bg-emerald-100 text-emerald-800 border-emerald-300/80 ring-emerald-400/20',
    icon: '🏭',
  },
  buyer: {
    label: 'Buyer',
    bg: 'bg-sky-100 text-sky-800 border-sky-300/80 ring-sky-400/20',
    icon: '💼',
  },
};

export default function UserMenu() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Link
          to="/login"
          className="hidden xs:inline-flex items-center justify-center whitespace-nowrap rounded-full px-2.5 sm:px-3 py-1 text-xs xl:text-[13px] font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          {t('common.signIn', {}, 'Sign In')}
        </Link>
        <Link
          to="/register"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-slate-900 text-white hover:bg-emerald-700 px-3 sm:px-4 py-1.5 text-xs xl:text-[13px] font-bold shadow-xs hover:shadow-md transition-all duration-200 active:scale-95 shrink-0"
        >
          {t('common.register', {}, 'Get Started')}
        </Link>
      </div>
    );
  }

  const initial = (user.name || user.email || 'U').trim().charAt(0).toUpperCase();
  const roleBadge = ROLE_BADGES[user.role] || {
    label: user.role,
    bg: 'bg-slate-100 text-slate-700 border-slate-300',
    icon: '👤',
  };

  const signOut = (close) => {
    close();
    logout();
    navigate('/');
  };

  const menuItemClass =
    'group flex w-full items-center justify-between px-3.5 py-2 text-left text-xs font-semibold text-slate-700 rounded-xl hover:bg-emerald-50/70 hover:text-emerald-950 transition-all duration-150';

  return (
    <Dropdown
      panelClassName="w-72 overflow-hidden p-1.5"
      trigger={({ open, props }) => (
        <button
          type="button"
          {...props}
          aria-label={`Account menu for ${user.name}`}
          title={`${user.name} (${roleBadge.label})`}
          className="group relative inline-flex items-center gap-1.5 rounded-full p-0.5 sm:p-1 pr-1.5 hover:bg-slate-100 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          {/* Avatar Ring */}
          <div className="relative">
            {user.role === 'super_admin' ? (
              <span className="relative flex size-8 sm:size-8.5 items-center justify-center rounded-full bg-gradient-to-br from-[#0b2716] to-[#123f25] text-xs sm:text-sm font-black text-emerald-300 ring-2 ring-emerald-500/70 shadow-2xs group-hover:ring-emerald-400 select-none">
                <span>👑</span>
              </span>
            ) : (
              <span className="flex size-8 sm:size-8.5 items-center justify-center rounded-full bg-gradient-to-br from-slate-900 to-slate-800 text-xs sm:text-sm font-bold text-white ring-2 ring-emerald-600/40 shadow-2xs group-hover:ring-emerald-600 select-none">
                {initial}
              </span>
            )}
            {/* Active Green Presence Indicator */}
            <span
              className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
              aria-hidden="true"
            />
          </div>

          <ChevronDown
            className={`size-3 text-slate-400 transition-transform duration-200 group-hover:text-slate-700 ${
              open ? 'rotate-180 text-emerald-700' : ''
            }`}
            aria-hidden="true"
          />
        </button>
      )}
    >
      {({ close }) => (
        <div>
          {/* Profile Header Card */}
          <div className="rounded-xl bg-gradient-to-br from-slate-50 via-white to-emerald-50/50 p-3.5 border border-slate-100 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white shadow-2xs">
                {user.role === 'super_admin' ? '👑' : initial}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5">
                  <p className="truncate text-sm font-bold text-slate-900">{user.name}</p>
                </div>

                {user.company && (
                  <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500 truncate mt-0.5">
                    <Building2 className="size-3 shrink-0 text-slate-400" />
                    <span className="truncate">{user.company}</span>
                  </p>
                )}

                <p className="truncate text-[11px] text-slate-500 mt-0.5">{user.email}</p>
              </div>
            </div>

            {/* Role Badge Pill */}
            <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Active Role
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide shadow-2xs ${roleBadge.bg}`}
              >
                <span>{roleBadge.icon}</span>
                <span>{roleBadge.label}</span>
              </span>
            </div>
          </div>

          {/* Super Admin Direct Console Banner (if applicable) */}
          {user.role === 'super_admin' && (
            <div className="mt-1.5 px-1">
              <Link
                to="/super-admin"
                onClick={close}
                className="group flex items-center justify-between rounded-xl bg-gradient-to-r from-emerald-950 to-[#0d341d] px-3 py-2 text-xs font-bold text-emerald-200 hover:text-white shadow-2xs transition-all hover:scale-[1.01]"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="size-3.5 text-amber-300" aria-hidden="true" />
                  <span>Super Admin Enterprise Console</span>
                </span>
                <ChevronRight className="size-3.5 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          )}

          {/* Workspace Links */}
          <div className="mt-2 px-1 space-y-0.5">
            <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
              Workspace
            </div>

            {user.role !== 'super_admin' && (
              <Link to={ROLE_HOME[user.role] || '/'} onClick={close} className={menuItemClass}>
                <span className="flex items-center gap-2.5">
                  <span className="flex size-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <LayoutDashboard className="size-3.5" aria-hidden="true" />
                  </span>
                  <span>Dashboard</span>
                </span>
                <ChevronRight className="size-3 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </Link>
            )}

            <Link to={ordersPathFor(user)} onClick={close} className={menuItemClass}>
              <span className="flex items-center gap-2.5">
                <span className="flex size-6 items-center justify-center rounded-lg bg-blue-100 text-blue-800 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Package className="size-3.5" aria-hidden="true" />
                </span>
                <span>{user.role === 'admin' ? 'Reports' : 'Orders & Shipments'}</span>
              </span>
              <ChevronRight className="size-3 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </Link>
          </div>

          {/* Perks & Deals */}
          <div className="mt-2 border-t border-slate-100 pt-1.5 px-1 space-y-0.5">
            <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
              Perks & Deals
            </div>

            <Link to="/products?deal=1" onClick={close} className={menuItemClass}>
              <span className="flex items-center gap-2.5">
                <span className="flex size-6 items-center justify-center rounded-lg bg-orange-100 text-orange-800 shrink-0 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                  <BadgePercent className="size-3.5" aria-hidden="true" />
                </span>
                <span>Wholesale Deals</span>
              </span>
              <ChevronRight className="size-3 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </Link>
          </div>

          {/* Account & Settings */}
          <div className="mt-2 border-t border-slate-100 pt-1.5 px-1 space-y-0.5">
            <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
              Preferences
            </div>

            {user.role === 'buyer' && (
              <Link to="/buyer/profile" onClick={close} className={menuItemClass}>
                <span className="flex items-center gap-2.5">
                  <span className="flex size-6 items-center justify-center rounded-lg bg-slate-100 text-slate-700 shrink-0 group-hover:bg-slate-700 group-hover:text-white transition-colors">
                    <UserRound className="size-3.5" aria-hidden="true" />
                  </span>
                  <span>Profile & Settings</span>
                </span>
                <ChevronRight className="size-3 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </Link>
            )}

            {user.role === 'supplier' && (
              <Link to="/supplier/profile" onClick={close} className={menuItemClass}>
                <span className="flex items-center gap-2.5">
                  <span className="flex size-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <Building2 className="size-3.5" aria-hidden="true" />
                  </span>
                  <span>Company Profile & KYC</span>
                </span>
                <ChevronRight className="size-3 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </Link>
            )}

            <Link to="/help" onClick={close} className={menuItemClass}>
              <span className="flex items-center gap-2.5">
                <span className="flex size-6 items-center justify-center rounded-lg bg-slate-100 text-slate-700 shrink-0 group-hover:bg-slate-700 group-hover:text-white transition-colors">
                  <HelpCircle className="size-3.5" aria-hidden="true" />
                </span>
                <span>Help Center & Support</span>
              </span>
              <ChevronRight className="size-3 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </Link>
          </div>

          {/* Sign Out Button */}
          <div className="mt-2 border-t border-slate-100 pt-1.5 px-1 pb-1">
            <button
              type="button"
              onClick={() => signOut(close)}
              className="group flex w-full items-center justify-between rounded-xl px-3.5 py-2 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50/80 transition-colors duration-150"
            >
              <span className="flex items-center gap-2.5">
                <span className="flex size-6 items-center justify-center rounded-lg bg-rose-100 text-rose-700 shrink-0 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                  <LogOut className="size-3.5" aria-hidden="true" />
                </span>
                <span>Sign Out</span>
              </span>
              <ChevronRight className="size-3 text-rose-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        </div>
      )}
    </Dropdown>
  );
}
