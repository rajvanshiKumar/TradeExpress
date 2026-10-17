import { useContext } from 'react';
import { MessageContext } from '../contexts/MessageContext';

export default function useMessages() {
  const context = useContext(MessageContext);
  if (!context) throw new Error('useMessages must be used inside <MessageProvider>.');
  return context;
}
