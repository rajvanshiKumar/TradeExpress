import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import messageService from '../services/messageService';
import { connectSocket, disconnectSocket, getSocket } from '../services/socketService';
import { AuthContext } from './AuthContext';

export const MessageContext = createContext(null);

/** Which side of a conversation the signed-in user is on. */
export const sideFor = (user) => (user?.role === 'supplier' ? 'supplier' : 'buyer');

export function MessageProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const activeConversationIdRef = useRef(null);

  const side = sideFor(user);

  // Fetch conversations from the backend
  const reload = useCallback(async () => {
    if (!user) {
      setConversations([]);
      return;
    }
    try {
      setError(null);
      const data = await messageService.listConversations();
      setConversations(data || []);
    } catch (err) {
      console.warn('Failed to fetch conversations:', err);
      setError(err.message || 'Unable to load conversations.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial load when user signs in
  useEffect(() => {
    if (user) {
      setLoading(true);
      reload();
    } else {
      setConversations([]);
      disconnectSocket();
    }
  }, [user, reload]);

  // Socket.IO real-time connection and event listeners
  useEffect(() => {
    if (!user) return;

    const socket = connectSocket();
    if (!socket) return;

    const handleNewMessage = (newMessage) => {
      setConversations((prev) => {
        const convIndex = prev.findIndex((c) => c.id === newMessage.conversationId);
        if (convIndex === -1) {
          // If conversation not in current list, fetch full list
          reload();
          return prev;
        }

        const conv = prev[convIndex];
        const alreadyHas = conv.messages?.some((m) => m.id === newMessage.id);
        const updatedMessages = alreadyHas ? conv.messages : [...(conv.messages || []), newMessage];

        const isMine = newMessage.senderId === user.id;
        const isActive = activeConversationIdRef.current === conv.id;

        const updatedConv = {
          ...conv,
          messages: updatedMessages,
          lastMessageAt: newMessage.createdAt || new Date().toISOString(),
          unread: {
            ...conv.unread,
            [side]: isMine || isActive ? 0 : (conv.unread?.[side] ?? 0) + 1,
          },
        };

        // Move active conversation to top of list
        const remaining = prev.filter((_, idx) => idx !== convIndex);
        return [updatedConv, ...remaining];
      });
    };

    const handleConversationUpdated = (updatedConv) => {
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === updatedConv.id);
        if (exists) {
          return prev.map((c) => (c.id === updatedConv.id ? { ...exists, ...updatedConv } : c));
        }
        return [updatedConv, ...prev];
      });
    };

    const handleMessagesRead = ({ conversationId }) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          return {
            ...c,
            unread: {
              ...c.unread,
              [side]: 0,
            },
            messages: (c.messages || []).map((m) => ({ ...m, isRead: true })),
          };
        })
      );
    };

    const handleUserTyping = ({ conversationId, userId, userName, isTyping }) => {
      setTypingUsers((prev) => ({
        ...prev,
        [conversationId]: isTyping ? { userId, userName } : null,
      }));
    };

    socket.on('new_message', handleNewMessage);
    socket.on('conversation_updated', handleConversationUpdated);
    socket.on('messages_read', handleMessagesRead);
    socket.on('user_typing', handleUserTyping);

    // Reliable fallback polling: sync every 6 seconds as backup
    const pollInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        messageService.listConversations().then((data) => {
          if (Array.isArray(data)) {
            setConversations((prev) => {
              // Only update if there are newer messages or count changes
              const prevTotal = prev.reduce((sum, c) => sum + (c.messages?.length || 0), 0);
              const newTotal = data.reduce((sum, c) => sum + (c.messages?.length || 0), 0);
              return prevTotal !== newTotal ? data : prev;
            });
          }
        }).catch(() => {});
      }
    }, 6000);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('conversation_updated', handleConversationUpdated);
      socket.off('messages_read', handleMessagesRead);
      socket.off('user_typing', handleUserTyping);
      window.clearInterval(pollInterval);
    };
  }, [user, side, reload]);

  // Total unread messages count across all conversations
  const unreadCount = useMemo(() => {
    if (!user || user.role === 'admin' || user.role === 'super_admin') return 0;
    return conversations.reduce((sum, item) => sum + (item.unread?.[side] ?? 0), 0);
  }, [conversations, side, user]);

  /** Opens or creates a thread with a supplier / product and returns its ID. */
  const startConversation = useCallback(
    async ({ company, product = null, subject = '', initialMessage = '' }) => {
      if (!user) return null;

      try {
        const conv = await messageService.createOrGetConversation({
          companyId: company?.id || null,
          supplierId: product?.supplierId || company?.supplierId || null,
          productId: product?.id || null,
          subject: subject || (product ? product.name : `Inquiry for ${company?.name || 'Supplier'}`),
          initialMessage,
        });

        if (conv?.id) {
          setConversations((previous) => {
            const exists = previous.find((item) => item.id === conv.id);
            if (exists) {
              return previous.map((item) => (item.id === conv.id ? { ...exists, ...conv } : item));
            }
            return [conv, ...previous];
          });
          return conv.id;
        }
        return null;
      } catch (err) {
        console.error('Failed to start conversation:', err);
        throw err;
      }
    },
    [user]
  );

  /** Sends a message to a conversation. */
  const sendMessage = useCallback(
    async (conversationId, text) => {
      if (!user || !text.trim()) return null;

      setSending(true);
      try {
        const message = await messageService.sendMessage(conversationId, text.trim());
        setConversations((previous) =>
          previous.map((item) => {
            if (item.id !== conversationId) return item;
            const alreadyHas = item.messages?.some((m) => m.id === message.id);
            const messages = alreadyHas ? item.messages : [...(item.messages || []), message];
            return {
              ...item,
              messages,
              lastMessageAt: message.createdAt || new Date().toISOString(),
            };
          })
        );
        return message;
      } catch (err) {
        console.error('Failed to send message:', err);
        throw err;
      } finally {
        setSending(false);
      }
    },
    [user]
  );

  /** Marks a conversation as read. */
  const markRead = useCallback(
    async (conversationId) => {
      if (!user) return;
      activeConversationIdRef.current = conversationId;

      // Optimistic state update
      setConversations((previous) =>
        previous.map((item) => {
          if (item.id !== conversationId) return item;
          if ((item.unread?.[side] ?? 0) === 0) return item;
          return {
            ...item,
            unread: { ...item.unread, [side]: 0 },
            messages: (item.messages || []).map((m) =>
              m.from !== side ? { ...m, isRead: true } : m
            ),
          };
        })
      );

      try {
        await messageService.markRead(conversationId);
      } catch (err) {
        console.warn('Failed to mark read on backend:', err);
      }
    },
    [user, side]
  );

  const value = useMemo(
    () => ({
      conversations,
      loading,
      error,
      reload,
      unreadCount,
      side,
      sending,
      typingUsers,
      startConversation,
      sendMessage,
      markRead,
    }),
    [
      conversations,
      loading,
      error,
      reload,
      unreadCount,
      side,
      sending,
      typingUsers,
      startConversation,
      sendMessage,
      markRead,
    ]
  );

  return <MessageContext.Provider value={value}>{children}</MessageContext.Provider>;
}
