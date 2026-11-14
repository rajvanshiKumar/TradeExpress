import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Bot, CheckCheck, Loader2, Lock, MessageSquare, Package, Search, SendHorizontal } from 'lucide-react';
import Button, { IconButton } from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Skeleton from '../components/common/Skeleton';
import useAuth from '../hooks/useAuth';
import useProducts from '../hooks/useProducts';
import useMessages from '../hooks/useMessages';
import useNotifications from '../hooks/useNotifications';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { joinConversationRoom, leaveConversationRoom, emitTyping } from '../services/socketService';
import { formatChatDay, formatChatListTime, formatChatTime, formatDateTime } from '../utils/formatDate';
import { consolidateConversations } from '../utils/messageUtils';

// Subtle chat wallpaper (WhatsApp-style doodle background, drawn with CSS only)
const CHAT_WALLPAPER = {
  backgroundColor: '#efeae2',
  backgroundImage:
    'radial-gradient(rgb(15 81 50 / 0.06) 1px, transparent 1px), radial-gradient(rgb(201 166 107 / 0.08) 1px, transparent 1px)',
  backgroundSize: '22px 22px, 22px 22px',
  backgroundPosition: '0 0, 11px 11px',
};

const getInitials = (name) =>
  (name || 'User')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

/** Round chat avatar: uses the supplier company colour/initials when available. */
function ChatAvatar({ name, company, size = 'md' }) {
  const sizes = { sm: 'size-10 text-xs', md: 'size-12 text-sm' };
  return (
    <span
      aria-hidden="true"
      style={company?.color ? { backgroundColor: company.color } : undefined}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-extrabold ${sizes[size]} ${
        company?.color ? 'text-white' : 'bg-emerald-100 text-emerald-900'
      }`}
    >
      {company?.initials || getInitials(name)}
    </span>
  );
}

const sameDay = (a, b) => {
  const da = new Date(a);
  const db = new Date(b);
  return !Number.isNaN(da.getTime()) && !Number.isNaN(db.getTime()) && da.toDateString() === db.toDateString();
};

export default function Messages() {
  const { user } = useAuth();
  const { getCompany, getProduct } = useProducts();
  const {
    conversations,
    loading,
    error,
    reload,
    side,
    sendMessage,
    startConversation,
    markRead,
    sending,
    typingUsers,
  } = useMessages();
  const { showToast } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [listFilter, setListFilter] = useState('all');
  const [draft, setDraft] = useState('');
  const [isSendingLocal, setIsSendingLocal] = useState(false);
  const [sendError, setSendError] = useState(null);
  const threadEnd = useRef(null);
  const composer = useRef(null);
  const typingTimer = useRef(null);

  useDocumentTitle('Messages');

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const activeId = searchParams.get('c') ?? '';
  const rfqParam = searchParams.get('rfq');
  const buyerParam = searchParams.get('buyer') || searchParams.get('buyerId');
  const productParam = searchParams.get('product') || searchParams.get('productId');
  const supplierParam = searchParams.get('supplier') || searchParams.get('supplierId');
  const companyParam = searchParams.get('company') || searchParams.get('companyId');
  const autoInitRef = useRef(false);

  // Deduplicate and consolidate conversations by counterparty so each supplier/buyer appears only once
  const uniqueConversations = useMemo(() => {
    return consolidateConversations(conversations, side, getCompany);
  }, [conversations, side, getCompany]);

  // If activeId corresponds to an empty duplicate thread, resolve to the consolidated conversation
  const active = useMemo(() => {
    if (!activeId) return null;
    const fromConsolidated = uniqueConversations.find(
      (item) => item.id === activeId || (Array.isArray(item.mergedIds) && item.mergedIds.includes(activeId))
    );
    if (fromConsolidated) return fromConsolidated;

    const direct = conversations.find((item) => item.id === activeId);
    if (!direct) return null;
    const company = getCompany(direct.companyId);
    const otherKey = side === 'supplier'
      ? direct.buyerId || direct.buyer?.id || direct.buyerName
      : direct.supplierId || direct.supplier?.id || company?.id || direct.companyId;

    if (!otherKey) return direct;

    const richer = conversations.find((item) => {
      if (item.id === direct.id) return false;
      const itemComp = getCompany(item.companyId);
      const itemKey = side === 'supplier'
        ? item.buyerId || item.buyer?.id || item.buyerName
        : item.supplierId || item.supplier?.id || itemComp?.id || item.companyId;
      return itemKey === otherKey && (item.messages?.length || 0) > (direct.messages?.length || 0);
    });

    return richer || direct;
  }, [uniqueConversations, conversations, activeId, getCompany, side]);

  // Real-time socket room management
  useEffect(() => {
    if (activeId) {
      joinConversationRoom(activeId);
    }
    return () => {
      if (activeId) {
        leaveConversationRoom(activeId);
      }
    };
  }, [activeId]);

  // Deep-linking: auto-open or start thread when rfq, buyer, product, supplier or company query params exist
  useEffect(() => {
    if (activeId || loading || autoInitRef.current) return;

    if (rfqParam || buyerParam || productParam || supplierParam || companyParam) {
      const found = conversations.find((c) => {
        if (supplierParam && (c.supplierId === supplierParam || c.supplier?.id === supplierParam)) return true;
        if (companyParam && (c.companyId === companyParam || c.company?.id === companyParam)) return true;
        if (rfqParam && (c.rfqId === rfqParam || c.rfq?.rfqNumber === rfqParam)) return true;
        if (buyerParam && c.buyerId === buyerParam) return true;
        if (productParam && (c.productId === productParam || c.product?.slug === productParam)) return true;
        return false;
      });

      if (found) {
        open(found.id);
      } else if (startConversation) {
        autoInitRef.current = true;
        startConversation({
          buyerId: buyerParam || null,
          supplierId: supplierParam || null,
          companyId: companyParam || null,
          rfqId: rfqParam || null,
          productId: productParam || null,
        })
          .then((newId) => {
            if (newId) open(newId);
          })
          .catch((err) => {
            console.warn('Auto-init conversation notice:', err.message);
          })
          .finally(() => {
            autoInitRef.current = false;
          });
      }
    }
  }, [activeId, rfqParam, buyerParam, productParam, supplierParam, companyParam, conversations, loading, startConversation]);

  // Describe the "other party" of a conversation based on role
  const describe = (conversation) => {
    const company = getCompany(conversation.companyId);
    if (side === 'supplier') {
      const buyerName = conversation.buyerName || conversation.buyer?.name || 'Buyer';
      const buyerCompany = conversation.buyer?.company || '';
      return {
        name: buyerName,
        personName: buyerName,
        companyName: buyerCompany,
        company: null,
        subtitle: buyerCompany ? `${buyerCompany} · Buyer` : 'Buyer',
      };
    }

    const supplierCompanyName = company?.name || conversation.supplier?.company || '';
    const supplierPersonName = conversation.supplier?.name || '';
    const supplierName = supplierCompanyName || supplierPersonName || 'Supplier';

    let subtitle = '';
    if (isAdmin) {
      subtitle = `with ${conversation.buyerName || conversation.buyer?.name || 'Buyer'}`;
    } else if (supplierPersonName && supplierCompanyName && supplierPersonName !== supplierCompanyName) {
      subtitle = `${supplierPersonName} · ${conversation.supplier?.city || company?.city || 'Verified Supplier'}`;
    } else if (company?.city || company?.country) {
      subtitle = `${company.city ? `${company.city}, ` : ''}${company.country}`;
    } else if (conversation.supplier?.city) {
      subtitle = `${conversation.supplier.city}, ${conversation.supplier.country || 'India'}`;
    } else {
      subtitle = 'Verified Supplier';
    }

    return {
      name: supplierName,
      personName: supplierPersonName,
      companyName: supplierCompanyName,
      company,
      subtitle,
    };
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base =
      listFilter === 'unread' && !isAdmin
        ? uniqueConversations.filter((item) => (item.unread?.[side] ?? 0) > 0)
        : uniqueConversations;
    if (!q) return base;
    return base.filter((item) => {
      const company = getCompany(item.companyId);
      const buyerName = item.buyerName || item.buyer?.name || '';
      const supplierName = company?.name || item.supplier?.company || item.supplier?.name || '';
      const subject = item.subject || '';
      const messagesText = (item.messages || []).map((m) => m.text || m.content || '').join(' ');
      return `${subject} ${buyerName} ${supplierName} ${messagesText}`.toLowerCase().includes(q);
    });
  }, [uniqueConversations, search, getCompany, listFilter, isAdmin, side]);

  const open = (id) => {
    const params = new URLSearchParams(searchParams);
    if (id) params.set('c', id);
    else params.delete('c');
    setSearchParams(params);
    setSendError(null);
  };

  const messageCount = active?.messages?.length ?? 0;
  useEffect(() => {
    if (!active) return;
    markRead(active.id);
    threadEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [active?.id, messageCount, markRead]);

  // Handle typing indicator
  const handleInputChange = (event) => {
    setDraft(event.target.value);
    setSendError(null);

    if (active?.id) {
      emitTyping(active.id, true);
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      typingTimer.current = window.setTimeout(() => {
        emitTyping(active.id, false);
      }, 2000);
    }
  };

  const submit = async (event) => {
    event?.preventDefault();
    if (!draft.trim() || !active || isSendingLocal || sending) return;

    const messageText = draft.trim();
    setIsSendingLocal(true);
    setSendError(null);

    if (active?.id) {
      emitTyping(active.id, false);
    }

    try {
      await sendMessage(active.id, messageText);
      setDraft('');
      composer.current?.focus();
    } catch (err) {
      const errMsg = err.message || 'Failed to send message. Please try again.';
      setSendError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsSendingLocal(false);
    }
  };

  const other = active ? describe(active) : null;
  const product = active?.productId
    ? active.product || getProduct(active.productId)
    : null;
  const isTypingActive = active?.id && typingUsers?.[active.id];

  const hasDeepLink = Boolean(rfqParam || buyerParam || productParam || supplierParam || companyParam);
  const totalUnread = isAdmin
    ? 0
    : uniqueConversations.reduce((sum, item) => sum + (item.unread?.[side] ?? 0), 0);
  const busy = isSendingLocal || sending;
  const threadMessages = active?.messages || [];

  return (
    <div className="ts-container py-4 sm:py-6">
      <h1 className="sr-only">Messages</h1>
      {error ? (
        <div className="ts-card">
          <ErrorState text={error} onRetry={reload} />
        </div>
      ) : (
        <div className="grid h-[calc(100dvh-10rem)] min-h-[32rem] grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card md:grid-cols-[23rem_minmax(0,1fr)]">
          {/* ───────────── Chat list (left pane) ───────────── */}
          <aside
            aria-label="Conversations"
            className={`min-h-0 min-w-0 flex-col border-slate-200 bg-white md:border-r ${
              active ? 'hidden md:flex' : 'flex'
            }`}
          >
            <div className="flex items-center justify-between bg-[#f0f2f5] px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <ChatAvatar name={user?.name} size="sm" />
                <h2 className="font-display text-lg font-extrabold text-slate-900">Chats</h2>
              </div>
              {totalUnread > 0 && (
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">
                  {totalUnread} unread
                </span>
              )}
            </div>

            <div className="space-y-2 border-b border-slate-100 px-3 py-2">
              <label htmlFor="message-search" className="sr-only">
                Search or start a new chat
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
                  aria-hidden="true"
                />
                <input
                  id="message-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search chats…"
                  className="w-full rounded-lg border-0 bg-[#f0f2f5] py-2 pl-10 pr-3 text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                />
              </div>
              {!isAdmin && (
                <div className="flex gap-2" role="group" aria-label="Filter chats">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'unread', label: 'Unread' },
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setListFilter(chip.id)}
                      aria-pressed={listFilter === chip.id}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                        listFilter === chip.id
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-[#f0f2f5] text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto ts-slim-scrollbar">
              {loading ? (
                <div className="space-y-4 p-4" role="status" aria-label="Loading conversations">
                  {Array.from({ length: 5 }, (_, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <Skeleton className="size-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  className="!py-12"
                  title={
                    search
                      ? 'No matching chats'
                      : listFilter === 'unread'
                      ? 'No unread chats'
                      : 'No conversations yet'
                  }
                  text={
                    search
                      ? 'Try a different search term or check spelling.'
                      : listFilter === 'unread'
                      ? 'You are all caught up.'
                      : side === 'supplier'
                      ? 'Inquiries and messages from buyers will appear here in real time.'
                      : 'Contact a supplier from any product details page to start a conversation.'
                  }
                  action={
                    !search && listFilter === 'all' && side === 'buyer' && !isAdmin ? (
                      <Button to="/products" variant="navy" size="sm">
                        Browse Products
                      </Button>
                    ) : null
                  }
                />
              ) : (
                <ul>
                  {filtered.map((conversation) => {
                    const info = describe(conversation);
                    const msgs = conversation.messages || [];
                    const last = msgs[msgs.length - 1];
                    const lastMine = last && !isAdmin && (last.from === side || last.senderId === user?.id);
                    const unread = isAdmin ? 0 : conversation.unread?.[side] ?? 0;
                    const typing = typingUsers?.[conversation.id];
                    const selected =
                      conversation.id === activeId ||
                      conversation.id === active?.id ||
                      Boolean(conversation.mergedIds?.includes(activeId));

                    return (
                      <li key={conversation.id}>
                        <button
                          type="button"
                          onClick={() => open(conversation.id)}
                          aria-current={selected ? 'true' : undefined}
                          className={`flex w-full items-center gap-3 pl-3 text-left transition-colors ${
                            selected ? 'bg-[#f0f2f5]' : 'hover:bg-[#f5f6f6]'
                          }`}
                        >
                          <ChatAvatar name={info.name} company={info.company} />
                          <span className="min-w-0 flex-1 border-b border-slate-100 py-3 pr-3">
                            <span className="flex items-baseline justify-between gap-2">
                              <span
                                className={`truncate text-[0.9375rem] ${
                                  unread ? 'font-bold text-slate-950' : 'font-semibold text-slate-900'
                                }`}
                              >
                                {info.name}
                              </span>
                              <span
                                className={`shrink-0 text-[0.6875rem] ${
                                  unread ? 'font-bold text-emerald-600' : 'text-slate-500'
                                }`}
                              >
                                {last?.at ? formatChatListTime(last.at) : ''}
                              </span>
                            </span>

                            <span className="mt-0.5 flex items-center justify-between gap-2">
                              <span
                                className={`flex min-w-0 items-center gap-1 text-[0.8125rem] ${
                                  typing ? 'text-emerald-600 font-medium' : unread ? 'text-slate-800' : 'text-slate-500'
                                }`}
                              >
                                {typing ? (
                                  'typing…'
                                ) : (
                                  <>
                                    {lastMine && (
                                      <CheckCheck
                                        className={`size-4 shrink-0 ${last.isRead ? 'text-sky-500' : 'text-slate-400'}`}
                                        aria-label={last.isRead ? 'Seen' : 'Delivered'}
                                      />
                                    )}
                                    <span className="truncate">
                                      {last ? last.text || last.content : conversation.subject || 'No messages yet'}
                                    </span>
                                  </>
                                )}
                              </span>
                              {unread > 0 && (
                                <span
                                  className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[0.6875rem] font-bold leading-5 text-white"
                                  aria-label={`${unread} unread messages`}
                                >
                                  {unread}
                                </span>
                              )}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* ───────────── Chat window (right pane) ───────────── */}
          <section
            aria-label="Conversation"
            className={`min-h-0 min-w-0 flex-col ${active ? 'flex' : 'hidden md:flex'}`}
            style={active ? CHAT_WALLPAPER : undefined}
          >
            {!active ? (
              hasDeepLink ? (
                <div className="my-auto flex flex-col items-center justify-center bg-[#f8f9fa] p-8 text-center">
                  <Loader2 className="mb-3 size-8 animate-spin text-emerald-600" aria-hidden="true" />
                  <h3 className="text-base font-bold text-slate-900">Opening conversation…</h3>
                  <p className="mt-1 text-xs text-slate-500">Connecting you with the supplier directly.</p>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center border-b-[6px] border-emerald-600 bg-[#f8f9fa] p-8 text-center">
                  <span className="mb-5 flex size-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <MessageSquare className="size-10" aria-hidden="true" />
                  </span>
                  <h3 className="font-display text-2xl font-light text-slate-800">TradeExpress Messages</h3>
                  <p className="mt-2 max-w-sm text-sm text-slate-500">
                    Select a chat to view the conversation, or contact a supplier from any product page to start a new
                    one.
                  </p>
                  <p className="mt-8 inline-flex items-center gap-1.5 text-xs text-slate-400">
                    <Lock className="size-3.5" aria-hidden="true" />
                    Your conversations are private to you and the other party
                  </p>
                </div>
              )
            ) : (
              <>
                {/* Chat header */}
                <header className="flex items-center gap-3 border-b border-slate-200 bg-[#f0f2f5] px-3 py-2.5 sm:px-4">
                  <IconButton
                    icon={ArrowLeft}
                    label="Back to chats"
                    size="sm"
                    onClick={() => open('')}
                    className="md:hidden"
                  />
                  <ChatAvatar name={other.name} company={other.company} size="sm" />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[0.9375rem] font-semibold text-slate-900">
                      {other.company ? (
                        <Link to={`/suppliers/${other.company.slug}`} className="hover:text-emerald-700">
                          {other.name}
                        </Link>
                      ) : (
                        other.name
                      )}
                    </h2>
                    <p className="truncate text-xs text-slate-500">
                      {isTypingActive ? (
                        <span className="font-medium text-emerald-600">typing…</span>
                      ) : (
                        <>
                          {other.subtitle}
                          {product ? (
                            <>
                              {' '}· Regarding{' '}
                              <Link
                                to={`/products/${product.slug}`}
                                className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-emerald-700"
                              >
                                <Package className="inline size-3" aria-hidden="true" />
                                {product.name}
                              </Link>
                            </>
                          ) : null}
                        </>
                      )}
                    </p>
                  </div>
                </header>

                {/* Message stream */}
                <div
                  className="min-h-0 flex-1 overflow-y-auto px-3 py-4 ts-slim-scrollbar sm:px-[6%]"
                  role="log"
                  aria-live="polite"
                  aria-label={`Messages with ${other.name}`}
                >
                  <p className="mx-auto mb-4 flex max-w-md items-start justify-center gap-1.5 rounded-lg bg-[#fff5c4] px-3 py-2 text-center text-[0.6875rem] text-slate-600 shadow-xs">
                    <Lock className="mt-px size-3 shrink-0" aria-hidden="true" />
                    Messages are private between you and {other.name}. Keep payments and orders on TradeExpress.
                  </p>

                  {threadMessages.length === 0 && (
                    <p className="mx-auto w-fit rounded-lg bg-white/90 px-3 py-1.5 text-xs text-slate-500 shadow-xs">
                      No messages yet. Say hello 👋
                    </p>
                  )}

                  {threadMessages.map((message, index) => {
                    const prev = threadMessages[index - 1];
                    const mine = !isAdmin && (message.from === side || message.senderId === user?.id);
                    const newDay = !prev || !sameDay(prev.at, message.at);
                    const prevSameSender =
                      prev && !newDay && (prev.from === message.from && prev.senderId === message.senderId);
                    const showTail = !prevSameSender;

                    return (
                      <div key={message.id}>
                        {newDay && message.at && (
                          <div className="my-3 flex justify-center">
                            <span className="rounded-lg bg-white/95 px-3 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-slate-500 shadow-xs">
                              {formatChatDay(message.at)}
                            </span>
                          </div>
                        )}

                        <div className={`flex ${mine ? 'justify-end' : 'justify-start'} ${showTail ? 'mt-2' : 'mt-0.5'}`}>
                          <div
                            className={`relative flow-root max-w-[85%] px-2.5 pb-1.5 pt-1.5 text-sm shadow-xs sm:max-w-[65%] ${
                              mine ? 'bg-[#d9fdd3] text-slate-900' : 'bg-white text-slate-900'
                            } ${
                              showTail
                                ? mine
                                  ? 'rounded-lg rounded-tr-none'
                                  : 'rounded-lg rounded-tl-none'
                                : 'rounded-lg'
                            }`}
                          >
                            {showTail && (
                              <span
                                aria-hidden="true"
                                className={`absolute top-0 size-0 border-t-[8px] ${
                                  mine
                                    ? '-right-2 border-r-[8px] border-t-[#d9fdd3] border-r-transparent'
                                    : '-left-2 border-l-[8px] border-t-white border-l-transparent'
                                }`}
                              />
                            )}

                            {showTail && !mine && (
                              <p className="mb-0.5 truncate text-xs font-semibold text-emerald-700">
                                {isAdmin
                                  ? message.from === 'buyer'
                                    ? active.buyerName
                                    : 'Supplier'
                                  : message.senderCompany ||
                                    (side === 'buyer' ? other.companyName || other.name : other.name)}
                                {!isAdmin && message.senderName && message.senderName !== message.senderCompany
                                  ? ` · ${message.senderName}`
                                  : ''}
                              </p>
                            )}

                            {message.automated && (
                              <p className="mb-0.5 inline-flex items-center gap-1 text-[0.6875rem] font-bold uppercase tracking-wide text-amber-700">
                                <Bot className="size-3.5" aria-hidden="true" />
                                Automated notice
                              </p>
                            )}

                            <p className="whitespace-pre-wrap break-words leading-relaxed">
                              {message.text || message.content}
                              <span
                                className={`float-right ml-3 mt-1.5 inline-flex translate-y-0.5 items-center gap-1 text-[0.6875rem] leading-none ${
                                  mine ? 'text-slate-500' : 'text-slate-400'
                                }`}
                              >
                                <time dateTime={message.at} title={formatDateTime(message.at)}>
                                  {formatChatTime(message.at)}
                                </time>
                                {mine && (
                                  <CheckCheck
                                    className={`size-4 ${message.isRead ? 'text-sky-500' : 'text-slate-400'}`}
                                    aria-label={message.isRead ? 'Seen' : 'Delivered'}
                                  />
                                )}
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {isTypingActive && (
                    <div className="mt-2 flex justify-start">
                      <div className="flex items-center gap-1 rounded-lg rounded-tl-none bg-white px-3 py-2.5 shadow-xs">
                        <span className="size-1.5 animate-pulse rounded-full bg-slate-400" />
                        <span className="size-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:200ms]" />
                        <span className="size-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:400ms]" />
                        <span className="sr-only">{other.name} is typing</span>
                      </div>
                    </div>
                  )}

                  <div ref={threadEnd} />
                </div>

                {/* Composer */}
                {isAdmin ? (
                  <div className="bg-[#f0f2f5] px-5 py-3 text-center text-[0.8125rem] text-slate-500">
                    Administrators have read-only access to buyer–supplier conversations.
                  </div>
                ) : (
                  <form onSubmit={submit} className="bg-[#f0f2f5] px-3 py-2.5 sm:px-4">
                    {sendError && (
                      <div className="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-600" role="alert">
                        {sendError}
                      </div>
                    )}
                    <label htmlFor="message-draft" className="sr-only">
                      Type a message
                    </label>
                    <div className="flex items-end gap-2">
                      <textarea
                        id="message-draft"
                        ref={composer}
                        rows={1}
                        value={draft}
                        maxLength={5000}
                        placeholder="Type a message"
                        onChange={handleInputChange}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            submit(event);
                          }
                        }}
                        className="max-h-36 min-h-11 flex-1 resize-none rounded-3xl border-0 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                        disabled={busy}
                      />
                      <button
                        type="submit"
                        disabled={!draft.trim() || busy}
                        aria-label={busy ? 'Sending' : 'Send message'}
                        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/40 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {busy ? (
                          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                        ) : (
                          <SendHorizontal className="size-5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
