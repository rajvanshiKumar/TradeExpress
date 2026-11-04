import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { slotForPath } from '../utils/authSession';

// Each dashboard sends a signed-out visitor to its own sign-in page
const LOGIN_PATHS = { admin: '/super-admin/login', supplier: '/supplier/login', buyer: '/buyer/login' };

/**
 * Sends visitors who are not signed in to the right sign-in page, then back afterwards.
 * This is a navigation guard for the prototype, not security: it runs in the browser.
 */
export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    const loginPath = LOGIN_PATHS[slotForPath(location.pathname)] || '/login';
    return <Navigate to={loginPath} replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <Outlet />;
}
