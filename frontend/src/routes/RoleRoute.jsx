import { useEffect, useRef } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import useNotifications from '../hooks/useNotifications';
import { ROLE_HOME } from '../utils/constants';

const NAMES = { buyer: 'Buyer', supplier: 'Supplier', admin: 'Admin', super_admin: 'Super Admin' };

/**
 * Limits a group of routes to certain roles (use inside <ProtectedRoute>). Users with a
 * different role are sent to their own dashboard.
 */
export default function RoleRoute({ roles }) {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const userRole = user?.role?.toLowerCase();
  const normalizedRoles = (roles || []).map((r) => r.toLowerCase());
  const allowed = Boolean(
    user &&
      (normalizedRoles.includes(userRole) ||
        (userRole === 'super_admin' && normalizedRoles.includes('admin')))
  );
  const warned = useRef(false);

  useEffect(() => {
    if (!allowed && user && !warned.current) {
      warned.current = true;
      showToast(`That page is for ${roles.map((role) => NAMES[role] || role).join(' or ')} accounts.`, 'info');
    }
  }, [allowed, user, roles, showToast]);

  if (allowed) return <Outlet />;
  return <Navigate to={user ? (ROLE_HOME[userRole] || '/') : '/login'} replace />;
}
