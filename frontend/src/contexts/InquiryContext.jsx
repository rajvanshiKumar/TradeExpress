import { createContext, useCallback, useContext, useMemo } from 'react';
import useCollection from '../hooks/useCollection';
import inquiryService from '../services/inquiryService';
import { NotificationContext } from './NotificationContext';
import { apiPost } from '../services/apiClient';

export const InquiryContext = createContext(null);

export function InquiryProvider({ children }) {
  const { items: inquiries, setItems, loading, error, reload } = useCollection(inquiryService.listInquiries, inquiryService.saveInquiries);
  const { addNotification } = useContext(NotificationContext);

  const submitInquiry = useCallback(async (values, related) => {
    const record = await inquiryService.createInquiry(values, related);
    setItems((previous) => [record, ...previous]);

    // Dual persistence to backend if available
    try {
      apiPost('rfq', {
        title: values.productName || record.productName,
        quantity: record.quantity,
        unit: record.unit,
        targetPrice: record.targetPrice,
        specifications: record.specifications,
        destinationCountry: record.destinationCountry,
        deliveryPincode: values.pincode || null,
        buyerName: record.buyerName,
        buyerEmail: record.buyerEmail,
      }).catch(() => {});
    } catch {}

    if (record.companyId) {
      addNotification({ audience: `company:${record.companyId}`, type: 'quotes', title: 'New quote request', body: `${record.buyerName} requested ${record.quantity} × ${record.productName}.`, link: '/supplier/inquiries' });
    }
    addNotification({ audience: 'role:admin', type: 'quotes', title: 'Quote request submitted', body: `${record.id} for ${record.productName}.`, link: '/admin/reports' });
    return record;
  }, [setItems, addNotification]);

  const setInquiryStatus = useCallback((id, status) => {
    setItems((previous) => previous.map((item) => (item.id === id ? { ...item, status } : item)));
  }, [setItems]);

  /** Supplier reply: stores a quote on the request with initial version history. */
  const respondToInquiry = useCallback((id, quoteData) => {
    const inquiry = inquiries.find((item) => item.id === id);
    const now = new Date().toISOString();

    const existingVersions = inquiry?.quote?.versions || [];
    const newVersionNumber = existingVersions.length + 1;

    const newVersion = {
      version: newVersionNumber,
      unitPrice: Number(quoteData.unitPrice),
      leadTimeDays: Number(quoteData.leadTimeDays),
      note: quoteData.note || '',
      freightCharge: Number(quoteData.freightCharge || 0),
      proposedBy: 'SUPPLIER',
      at: now,
    };

    const quote = {
      ...quoteData,
      round: newVersionNumber,
      lastProposedBy: 'SUPPLIER',
      at: now,
      versions: [...existingVersions, newVersion],
    };

    setItems((previous) => previous.map((item) => (
      item.id === id
        ? { ...item, status: 'Quoted', quote }
        : item
    )));

    if (inquiry && inquiry.buyerId !== 'guest') {
      addNotification({ audience: inquiry.buyerId, type: 'quotes', title: 'Quote received', body: `A quote was added to ${inquiry.id} (${inquiry.productName}).`, link: '/buyer/quotes' });
    }
  }, [inquiries, setItems, addNotification]);

  /** Counter-offer flow (Buyer or Supplier): records counter-offer up to 3 rounds. */
  const counterInquiry = useCallback((id, counterData) => {
    const inquiry = inquiries.find((item) => item.id === id);
    if (!inquiry || !inquiry.quote) return;

    const existingVersions = inquiry.quote.versions || [];
    if (existingVersions.length >= 3) {
      throw new Error('Maximum 3 rounds of negotiation limit reached. Please accept or decline the final offer.');
    }

    const now = new Date().toISOString();
    const newVersionNumber = existingVersions.length + 1;
    const proposedBy = counterData.proposedBy || 'BUYER';

    const newVersion = {
      version: newVersionNumber,
      unitPrice: Number(counterData.unitPrice),
      leadTimeDays: Number(counterData.leadTimeDays || inquiry.quote.leadTimeDays),
      note: counterData.note || '',
      freightCharge: Number(counterData.freightCharge || inquiry.quote.freightCharge || 0),
      proposedBy,
      at: now,
    };

    const updatedQuote = {
      ...inquiry.quote,
      unitPrice: Number(counterData.unitPrice),
      leadTimeDays: Number(counterData.leadTimeDays || inquiry.quote.leadTimeDays),
      note: counterData.note || inquiry.quote.note,
      freightCharge: Number(counterData.freightCharge || inquiry.quote.freightCharge || 0),
      round: newVersionNumber,
      lastProposedBy: proposedBy,
      at: now,
      versions: [...existingVersions, newVersion],
    };

    setItems((previous) => previous.map((item) => (
      item.id === id
        ? { ...item, status: 'Negotiating', quote: updatedQuote }
        : item
    )));

    const audience = proposedBy === 'BUYER' ? `company:${inquiry.companyId}` : inquiry.buyerId;
    addNotification({
      audience,
      type: 'quotes',
      title: `Counter-offer (Round ${newVersionNumber} of 3)`,
      body: `Counter-offer of ₹${counterData.unitPrice} on ${inquiry.id}.`,
      link: proposedBy === 'BUYER' ? '/supplier/inquiries' : '/buyer/quotes',
    });
  }, [inquiries, setItems, addNotification]);

  /** Buyer accepts agreed quote */
  const acceptInquiryQuote = useCallback((id) => {
    setItems((previous) => previous.map((item) => (
      item.id === id
        ? { ...item, status: 'Accepted' }
        : item
    )));
    const inquiry = inquiries.find((item) => item.id === id);
    if (inquiry && inquiry.companyId) {
      addNotification({
        audience: `company:${inquiry.companyId}`,
        type: 'quotes',
        title: 'Quote Accepted!',
        body: `${inquiry.buyerName} accepted the quote for ${inquiry.productName}.`,
        link: '/supplier/inquiries',
      });
    }
  }, [inquiries, setItems, addNotification]);

  /** Buyer or Supplier declines quote */
  const rejectInquiryQuote = useCallback((id, reason = '') => {
    setItems((previous) => previous.map((item) => (
      item.id === id
        ? { ...item, status: 'Declined', rejectionReason: reason }
        : item
    )));
  }, [setItems]);

  const value = useMemo(() => ({
    inquiries,
    loading,
    error,
    reload,
    submitInquiry,
    setInquiryStatus,
    respondToInquiry,
    counterInquiry,
    acceptInquiryQuote,
    rejectInquiryQuote,
  }), [inquiries, loading, error, reload, submitInquiry, setInquiryStatus, respondToInquiry, counterInquiry, acceptInquiryQuote, rejectInquiryQuote]);

  return <InquiryContext.Provider value={value}>{children}</InquiryContext.Provider>;
}
