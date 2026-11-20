import { lazy } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

const Messages = lazy(() => import('../pages/Messages'));

/**
 * /messages: buyers read their messages inside the buyer portal (/buyer/messages), like My Orders.
 * Every old link keeps working: the conversation / RFQ / supplier in the address is carried over.
 * Suppliers and admins keep the Messages page as before.
 */
export default function MessagesEntry() {
  const { user } = useAuth();
  const location = useLocation();
  if (user?.role === 'buyer') return <Navigate to={`/buyer/messages${location.search}`} replace />;
  return <Messages />;
}
