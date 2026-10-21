import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, LogOut, MessageSquare, Package, Scale, UserRound } from 'lucide-react';
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
        <Button
          to="/login"
          variant="ghost"
          size="sm"
          className="hidden md:inline-flex whitespace-nowrap shrink-0 !min-h-8 sm:!min-h-8.5 xl:!min-h-9 !h-8 sm:!h-8.5 xl:!h-9 !px-2 xl:!px-2.5 2xl:!px-3 text-xs xl:text-[13px] font-semibold text-navy-800 hover:text-navy-950 hover:bg-navy-900/5 transition-colors"
        >
          Sign In
        </Button>
        <Button
          to="/register"
          variant="navy"
          size="sm"
          className="whitespace-nowrap shadow-sm shrink-0 !min-h-8 sm:!min-h-8.5 xl:!min-h-9 !h-8 sm:!h-8.5 xl:!h-9 !px-2.5 sm:!px-3.5 xl:!px-4 text-xs xl:text-[13px] font-semibold tracking-tight !bg-navy-900 !text-white hover:!bg-navy-800 active:!bg-navy-950 transition-all hover:shadow hover:-translate-y-px"
        >
          Get Started
        </Button>
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
          title={`${user.name} (${user.role})`}
          className="inline-flex size-8 sm:size-8.5 xl:size-9 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <span className="inline-flex size-8 sm:size-8.5 xl:size-9 items-center justify-center rounded-full bg-navy-900 text-xs sm:text-sm font-bold text-brand-400 ring-2 ring-brand-500/40 shadow-sm hover:ring-brand-500 select-none">
            {initial}
          </span>
        </button>
      )}
    >
      {({ close }) => (
        <div>
          <div className="border-b bg-surface px-4 py-3">
            <p className="truncate text-sm font-bold text-navy-900">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <Link to={ROLE_HOME[user.role]} onClick={close} className={item}><LayoutDashboard className="size-4 text-muted" aria-hidden="true" />Dashboard</Link>
          <Link to={ordersPathFor(user)} onClick={close} className={item}><Package className="size-4 text-muted" aria-hidden="true" />{user.role === 'admin' ? 'Reports' : 'Orders'}</Link>
          {user.role === 'buyer' ? <Link to="/buyer/quotes/compare" onClick={close} className={item}><Scale className="size-4 text-muted" aria-hidden="true" />Smart Quote Comparison</Link> : null}
          <Link to="/messages" onClick={close} className={item}><MessageSquare className="size-4 text-muted" aria-hidden="true" />Messages</Link>
          {user.role === 'buyer' ? <Link to="/buyer/profile" onClick={close} className={item}><UserRound className="size-4 text-muted" aria-hidden="true" />Profile & settings</Link> : null}
          <button type="button" onClick={() => signOut(close)} className={`${item} border-t text-danger`}><LogOut className="size-4" aria-hidden="true" />Sign out</button>
        </div>
      )}
    </Dropdown>
  );
}
