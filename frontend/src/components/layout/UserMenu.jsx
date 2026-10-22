import { Link, useNavigate } from 'react-router-dom';
import { BadgePercent, ChevronDown, HelpCircle, LayoutDashboard, LogOut, MessageSquare, Package, Scale, ShieldCheck, UserRound } from 'lucide-react';
import Dropdown from '../common/Dropdown';
import Button from '../common/Button';
import useAuth from '../../hooks/useAuth';
import useNotifications from '../../hooks/useNotifications';
import { ordersPathFor, ROLE_HOME } from '../../utils/constants';

export default function UserMenu() {
  const { user, logout } = useAuth();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <Link
          to="/login"
          className="hidden xs:inline-flex items-center justify-center whitespace-nowrap rounded-full px-2 sm:px-2.5 py-1 text-xs xl:text-[13px] font-semibold text-navy-800 hover:text-navy-950 hover:bg-navy-900/5 transition-colors"
        >
          Sign In
        </Link>
        <Link
          to="/register"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-navy-900 text-white hover:bg-brand-600 px-2.5 sm:px-3.5 py-1.5 text-xs xl:text-[13px] font-bold shadow-xs hover:shadow-md transition-all duration-200 active:scale-95 shrink-0"
        >
          Get Started
        </Link>
      </div>
    );
  }

  const initial = (user.name || user.email || 'U').trim().charAt(0).toUpperCase();

  const signOut = (close) => {
    close();
    logout();
    showToast('You have been signed out.', 'info');
    navigate('/');
  };

  const item = 'flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-navy-50 transition-colors';
  return (
    <Dropdown
      panelClassName="w-64 overflow-hidden"
      trigger={({ props }) => (
        <button
          type="button"
          {...props}
          aria-label={`Account menu for ${user.name}`}
          title={`${user.name} (${user.role === 'super_admin' ? 'Super Admin' : user.role})`}
          className="inline-flex size-7.5 sm:size-8 xl:size-8.5 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          {user.role === 'super_admin' ? (
            <span className="relative inline-flex size-7.5 sm:size-8 xl:size-8.5 items-center justify-center rounded-full bg-[#0b2716] text-xs sm:text-sm font-black text-emerald-300 ring-2 ring-emerald-500 shadow-sm hover:ring-emerald-400 select-none">
              <span>👑</span>
            </span>
          ) : (
            <span className="inline-flex size-7.5 sm:size-8 xl:size-8.5 items-center justify-center rounded-full bg-navy-900 text-xs sm:text-sm font-bold text-brand-400 ring-2 ring-brand-500/40 shadow-sm hover:ring-brand-500 select-none">
              {initial}
            </span>
          )}
        </button>
      )}
    >
      {({ close }) => (
        <div>
          <div className="border-b bg-surface px-4 py-3">
            <div className="flex items-center justify-between gap-1.5">
              <p className="truncate text-sm font-bold text-navy-900">{user.name}</p>
              {user.role === 'super_admin' ? (
                <span className="rounded bg-brand-700 text-white text-[9px] font-extrabold px-1.5 py-0.5 tracking-wider uppercase">SUPER ADMIN</span>
              ) : null}
            </div>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          {user.role === 'super_admin' ? (
            <Link
              to="/super-admin"
              onClick={close}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 transition-colors border-b border-emerald-900/10"
            >
              <ShieldCheck className="size-4 text-emerald-600" aria-hidden="true" />
              <span>👑 Super Admin Console</span>
            </Link>
          ) : (
            <Link to={ROLE_HOME[user.role] || '/'} onClick={close} className={item}>
              <LayoutDashboard className="size-4 text-muted" aria-hidden="true" />
              Dashboard
            </Link>
          )}
          <Link to={ordersPathFor(user)} onClick={close} className={item}><Package className="size-4 text-muted" aria-hidden="true" />{user.role === 'admin' ? 'Reports' : 'Orders'}</Link>
          {user.role === 'buyer' ? <Link to="/buyer/quotes/compare" onClick={close} className={item}><Scale className="size-4 text-muted" aria-hidden="true" />Smart Quote Comparison</Link> : null}
          <Link to="/products?deal=1" onClick={close} className={item}><BadgePercent className="size-4 text-muted" aria-hidden="true" />Deals</Link>
          <Link to="/help" onClick={close} className={item}><HelpCircle className="size-4 text-muted" aria-hidden="true" />Help Center</Link>
          <Link to="/messages" onClick={close} className={item}><MessageSquare className="size-4 text-muted" aria-hidden="true" />Messages</Link>
          {user.role === 'buyer' ? <Link to="/buyer/profile" onClick={close} className={item}><UserRound className="size-4 text-muted" aria-hidden="true" />Profile & settings</Link> : null}
          <button type="button" onClick={() => signOut(close)} className={`${item} border-t text-danger`}><LogOut className="size-4" aria-hidden="true" />Sign out</button>
        </div>
      )}
    </Dropdown>
  );
}
