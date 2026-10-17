import { createContext, useCallback, useContext, useMemo } from 'react';
import useCollection from '../hooks/useCollection';
import inquiryService from '../services/inquiryService';
import { NotificationContext } from './NotificationContext';

// Quote requests (RFQs). Saved in this browser only: nothing is sent to a real company.
export const InquiryContext = createContext(null);

export function InquiryProvider({ children }) {
  const { items: inquiries, setItems, loading, error, reload } = useCollection(inquiryService.listInquiries, inquiryService.saveInquiries);
  const { addNotification } = useContext(NotificationContext);

  const submitInquiry = useCallback(async (values, related) => {
    const record = await inquiryService.createInquiry(values, related);
    setItems((previous) => [record, ...previous]);
    if (record.companyId) {
      addNotification({ audience: `company:${record.companyId}`, type: 'quotes', title: 'New quote request', body: `${record.buyerName} requested ${record.quantity} × ${record.productName}.`, link: '/supplier/inquiries' });
    }
    addNotification({ audience: 'role:admin', type: 'quotes', title: 'Quote request submitted', body: `${record.id} for ${record.productName}.`, link: '/admin/reports' });
    return record;
  }, [setItems, addNotification]);

  const setInquiryStatus = useCallback((id, status) => {
    setItems((previous) => previous.map((item) => (item.id === id ? { ...item, status } : item)));
  }, [setItems]);

  /** Supplier reply: stores a quote on the request and marks it as Quoted. */
  const respondToInquiry = useCallback((id, quote) => {
    const inquiry = inquiries.find((item) => item.id === id);
    setItems((previous) => previous.map((item) => (item.id === id ? { ...item, status: 'Quoted', quote: { ...quote, at: new Date().toISOString() } } : item)));
    if (inquiry && inquiry.buyerId !== 'guest') {
      addNotification({ audience: inquiry.buyerId, type: 'quotes', title: 'Quote received', body: `A quote was added to ${inquiry.id} (${inquiry.productName}).`, link: '/buyer/quotes' });
    }
  }, [inquiries, setItems, addNotification]);

  const value = useMemo(() => ({ inquiries, loading, error, reload, submitInquiry, setInquiryStatus, respondToInquiry }),
    [inquiries, loading, error, reload, submitInquiry, setInquiryStatus, respondToInquiry]);

  return <InquiryContext.Provider value={value}>{children}</InquiryContext.Provider>;
}
