import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, LogOut, MessageSquare, Package, UserRound } from 'lucide-react';
import Dropdown from '../common/Dropdown';
import Button from '../common/Button';
import useAuth from '../../hooks/useAuth';
import useNotifications from '../../hooks/useNotifications';
import { ROLE_HOME } from '../../utils/constants';

export const ordersPathFor = (user) => (!user ? '/buyer/orders' : user.role === 'supplier' ? '/supplier/orders' : user.role === 'admin' ? '/admin/reports' : '/buyer/orders');

export default function UserMenu() {
  const { user, logout } = useAuth();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Button to="/login" variant="ghost" size="sm" className="hidden lg:inline-flex whitespace-nowrap">Sign In</Button>
        <Button to="/register" variant="navy" size="sm" className="whitespace-nowrap shadow-sm">Get Started</Button>
      </div>
    );
  }

  const signOut = (close) => {
    close();
    logout();
    showToast('You have been signed out.', 'info');
    navigate('/');
  };

  const item = 'flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-navy-50';
  return (
    <Dropdown
      panelClassName="w-64 overflow-hidden"
      trigger={({ props }) => (
        <button type="button" {...props} aria-label={`Account menu for ${user.name}`} className="inline-flex h-11 items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-navy-900/5">
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-brand-400 ring-2 ring-brand-500/40">{user.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
          <span className="hidden text-left leading-tight xl:block">
            <span className="block max-w-28 truncate text-[0.8125rem] font-semibold text-navy-900">{user.name}</span>
            <span className="block text-[0.6875rem] capitalize text-muted">{user.role}</span>
          </span>
          <ChevronDown className="hidden size-4 text-muted xl:block" aria-hidden="true" />
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
          <Link to="/messages" onClick={close} className={item}><MessageSquare className="size-4 text-muted" aria-hidden="true" />Messages</Link>
          {user.role === 'buyer' ? <Link to="/buyer/profile" onClick={close} className={item}><UserRound className="size-4 text-muted" aria-hidden="true" />Profile & settings</Link> : null}
          <button type="button" onClick={() => signOut(close)} className={`${item} border-t text-danger`}><LogOut className="size-4" aria-hidden="true" />Sign out</button>
        </div>
      )}
    </Dropdown>
  );
}
