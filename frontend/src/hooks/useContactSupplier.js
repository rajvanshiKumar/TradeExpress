import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuth from './useAuth';
import useMessages from './useMessages';
import useNotifications from './useNotifications';

/**
 * Returns contact(company, product?) which opens the simulated conversation with a
 * supplier, asking the visitor to sign in first when needed.
 */
export default function useContactSupplier() {
  const { user } = useAuth();
  const { startConversation } = useMessages();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback((company, product = null) => {
    if (!user) {
      showToast('Sign in to message a supplier.', 'info');
      navigate('/login', { state: { from: `${location.pathname}${location.search}` } });
      return;
    }
    if (user.role !== 'buyer') {
      showToast('Switch to a buyer account to start a conversation with a supplier.', 'info');
      return;
    }
    const id = startConversation({ company, product });
    navigate(`/messages?c=${id}`);
  }, [user, startConversation, showToast, navigate, location.pathname, location.search]);
}
