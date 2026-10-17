import { useEffect, useRef } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import useNotifications from '../hooks/useNotifications';
import { ROLE_HOME } from '../utils/constants';

const NAMES = { buyer: 'Buyer', supplier: 'Supplier', admin: 'Admin' };

/**
 * Limits a group of routes to certain roles (use inside <ProtectedRoute>). Users with a
 * different role are sent to their own dashboard. This prevents accidental navigation only:
 * a role stored in the browser can be edited, so it is not real authorisation.
 */
export default function RoleRoute({ roles }) {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const allowed = Boolean(user && roles.includes(user.role));
  const warned = useRef(false);

  useEffect(() => {
    if (!allowed && user && !warned.current) {
      warned.current = true;
      showToast(`That page is for ${roles.map((role) => NAMES[role]).join(' or ')} accounts.`, 'info');
    }
  }, [allowed, user, roles, showToast]);

  if (allowed) return <Outlet />;
  return <Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace />;
}
