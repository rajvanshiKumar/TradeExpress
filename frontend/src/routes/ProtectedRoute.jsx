import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

/**
 * Sends visitors who are not signed in to the right sign-in page, then back afterwards.
 * This is a navigation guard for the prototype, not security: it runs in the browser.
 */
export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    const loginPath = location.pathname.startsWith('/admin') ? '/admin/login' : '/login';
    return <Navigate to={loginPath} replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <Outlet />;
}
