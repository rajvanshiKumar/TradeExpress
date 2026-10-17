import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import useCollection from '../hooks/useCollection';
import messageService from '../services/messageService';
import { AuthContext } from './AuthContext';

// Simulated messaging. Messages are saved in this browser and are never delivered to anyone.
export const MessageContext = createContext(null);

/** Which side of a conversation the signed-in user is on. */
export const sideFor = (user) => (user?.role === 'supplier' ? 'supplier' : 'buyer');

export function MessageProvider({ children }) {
  const { user } = useContext(AuthContext);
  const { items: all, setItems, loading, error, reload } = useCollection(messageService.listConversations, messageService.saveConversations);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  // Buyers see their own threads, suppliers see their company's threads, the admin sees all.
  const conversations = useMemo(() => {
    if (!user) return [];
    const mine = all.filter((item) => (user.role === 'admin' ? true : user.role === 'supplier' ? item.companyId === user.companyId : item.buyerId === user.id));
    const lastAt = (item) => item.messages[item.messages.length - 1]?.at ?? '';
    return [...mine].sort((a, b) => lastAt(b).localeCompare(lastAt(a)));
  }, [all, user]);

  const side = sideFor(user);
  const unreadCount = useMemo(() => (user?.role === 'admin' ? 0 : conversations.reduce((sum, item) => sum + (item.unread?.[side] ?? 0), 0)), [conversations, side, user]);

  /** Opens the buyer's thread with a company (creating it if needed) and returns its ID. */
  const startConversation = useCallback(({ company, product = null, subject = '' }) => {
    if (!user) return null;
    const existing = all.find((item) => item.buyerId === user.id && item.companyId === company.id && (item.productId ?? null) === (product?.id ?? null));
    if (existing) return existing.id;
    const record = messageService.buildConversation({ buyer: user, company, product, subject });
    setItems((previous) => [record, ...previous]);
    return record.id;
  }, [all, user, setItems]);

  const sendMessage = useCallback((conversationId, text) => {
    if (!user || !text.trim()) return;
    const from = sideFor(user);
    const other = from === 'buyer' ? 'supplier' : 'buyer';
    const message = messageService.buildMessage(from, text);
    setItems((previous) => previous.map((item) => (item.id === conversationId
      ? { ...item, messages: [...item.messages, message], unread: { ...item.unread, [other]: (item.unread?.[other] ?? 0) + 1 } }
      : item)));

    // Buyers get a clearly labelled automated reply so the simulation feels alive.
    if (from === 'buyer') {
      timers.current.push(window.setTimeout(() => {
        const reply = messageService.buildAutoReply();
        setItems((previous) => previous.map((item) => (item.id === conversationId
          ? { ...item, messages: [...item.messages, reply], unread: { ...item.unread, buyer: (item.unread?.buyer ?? 0) + 1 } }
          : item)));
      }, 1600));
    }
  }, [user, setItems]);

  const markRead = useCallback((conversationId) => {
    if (!user || user.role === 'admin') return;
    const mySide = sideFor(user);
    setItems((previous) => (previous.some((item) => item.id === conversationId && (item.unread?.[mySide] ?? 0) > 0)
      ? previous.map((item) => (item.id === conversationId ? { ...item, unread: { ...item.unread, [mySide]: 0 } } : item))
      : previous));
  }, [user, setItems]);

  const value = useMemo(() => ({ conversations, loading, error, reload, unreadCount, side, startConversation, sendMessage, markRead }),
    [conversations, loading, error, reload, unreadCount, side, startConversation, sendMessage, markRead]);

  return <MessageContext.Provider value={value}>{children}</MessageContext.Provider>;
}
