import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { ROLE_HOME } from '../utils/constants';

/**
 * Limits a group of routes to certain roles (use inside <ProtectedRoute>). Users with a
 * different role are sent quietly to their own dashboard.
 */
export default function RoleRoute({ roles }) {
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase();
  const normalizedRoles = (roles || []).map((r) => r.toLowerCase());
  const allowed = Boolean(
    user &&
      (normalizedRoles.includes(userRole) ||
        (userRole === 'super_admin' && normalizedRoles.includes('admin')))
  );

  if (allowed) return <Outlet />;
  return <Navigate to={user ? (ROLE_HOME[userRole] || '/') : (roles?.includes('super_admin') ? '/super-admin/login' : '/login')} replace />;
}
