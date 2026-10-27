import { useContext } from 'react';
import { InquiryContext } from '../contexts/InquiryContext';

export default function useInquiries() {
  const context = useContext(InquiryContext);
  if (!context) throw new Error('useInquiries must be used inside <InquiryProvider>.');
  return context;
}
