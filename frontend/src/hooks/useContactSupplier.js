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
  const { startConversation, conversations } = useMessages();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    async (company, product = null, initialMessage = '') => {
      if (!user) {
        navigate('/login', { state: { from: `${location.pathname}${location.search}` } });
        return;
      }

      const targetCompanyId = company?.id || product?.companyId || null;
      const targetSupplierId = company?.supplierId || product?.supplierId || null;
      const targetProductId = product?.id || null;

      // 1. Instant match: check if a thread for this supplier/company already exists in memory
      const existing = (conversations || []).find((c) => {
        if (targetSupplierId && (c.supplierId === targetSupplierId || c.supplier?.id === targetSupplierId)) return true;
        if (targetCompanyId && (c.companyId === targetCompanyId || c.company?.id === targetCompanyId)) return true;
        if (company?.name && (c.supplier?.company === company.name || c.subject?.includes(company.name))) return true;
        if (targetProductId && (c.productId === targetProductId || c.product?.id === targetProductId || c.product?.slug === targetProductId)) return true;
        return false;
      });

      if (existing?.id) {
        navigate(`/messages?c=${existing.id}`);
        return;
      }

      // 2. Initiate or retrieve thread, then navigate directly to conversation id
      try {
        const id = await startConversation({
          company,
          product,
          companyId: targetCompanyId,
          supplierId: targetSupplierId,
          productId: targetProductId,
          initialMessage,
        });
        if (id) {
          navigate(`/messages?c=${id}`);
          return;
        }
      } catch (err) {
        console.warn('Start conversation error:', err);
      }

      // Fallback navigation with params only if conversation could not be resolved immediately
      const searchParams = new URLSearchParams();
      if (targetCompanyId) searchParams.set('company', targetCompanyId);
      if (targetSupplierId) searchParams.set('supplier', targetSupplierId);
      if (targetProductId) searchParams.set('product', targetProductId);

      navigate(`/messages?${searchParams.toString()}`);
    },
    [user, conversations, startConversation, navigate, location.pathname, location.search]
  );
}
