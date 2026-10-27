import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuth from './useAuth';
import useMessages from './useMessages';
import useNotifications from './useNotifications';

/**
 * Returns contact(company, product?, initialMessage?) which opens or creates a real
 * conversation with a supplier on MySQL database, prompting sign-in if needed.
 */
export default function useContactSupplier() {
  const { user } = useAuth();
  const { startConversation } = useMessages();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    async (company, product = null, initialMessage = '') => {
      if (!user) {
        showToast('Please sign in to message a supplier.', 'info');
        navigate('/login', { state: { from: `${location.pathname}${location.search}` } });
        return;
      }
      if (user.role !== 'buyer' && user.role !== 'admin' && user.role !== 'super_admin') {
        showToast('Switch to a buyer account to start a conversation with a supplier.', 'info');
        return;
      }

      try {
        const id = await startConversation({ company, product, initialMessage });
        if (id) {
          navigate(`/messages?c=${id}`);
        } else {
          navigate('/messages');
        }
      } catch (err) {
        showToast(err.message || 'Unable to open conversation with supplier.', 'error');
      }
    },
    [user, startConversation, showToast, navigate, location.pathname, location.search]
  );
}
