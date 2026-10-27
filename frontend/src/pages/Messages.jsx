import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Bot, Check, CheckCheck, Loader2, MessageSquare, Package, Search, Send } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import Button, { IconButton } from '../components/common/Button';
import CompanyLogo from '../components/common/CompanyLogo';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Skeleton from '../components/common/Skeleton';
import useAuth from '../hooks/useAuth';
import useProducts from '../hooks/useProducts';
import useMessages from '../hooks/useMessages';
import useNotifications from '../hooks/useNotifications';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { joinConversationRoom, leaveConversationRoom, emitTyping } from '../services/socketService';
import { formatDateTime, formatMessageTime } from '../utils/formatDate';

function Avatar({ name }) {
  const initials = (name || 'User')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <span
      aria-hidden="true"
      className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-navy-100 font-display text-sm font-extrabold text-navy-900"
    >
      {initials || 'U'}
    </span>
  );
}

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
    markRead,
    sending,
    typingUsers,
  } = useMessages();
  const { showToast } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [isSendingLocal, setIsSendingLocal] = useState(false);
  const [sendError, setSendError] = useState(null);
  const threadEnd = useRef(null);
  const composer = useRef(null);
  const typingTimer = useRef(null);

  useDocumentTitle('Messages');

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const activeId = searchParams.get('c') ?? '';
  const active = conversations.find((item) => item.id === activeId) ?? null;

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

  // Describe the "other party" of a conversation based on role
  const describe = (conversation) => {
    const company = getCompany(conversation.companyId);
    if (side === 'supplier') {
      const buyerName = conversation.buyerName || conversation.buyer?.name || 'Buyer';
      const buyerCompany = conversation.buyer?.company || '';
      return {
        name: buyerName,
        company: null,
        subtitle: buyerCompany ? `${buyerCompany} · Buyer` : 'Buyer',
      };
    }

    const supplierName =
      company?.name ||
      conversation.supplier?.company ||
      conversation.supplier?.name ||
      'Supplier';

    let subtitle = '';
    if (isAdmin) {
      subtitle = `with ${conversation.buyerName || conversation.buyer?.name || 'Buyer'}`;
    } else if (company?.city || company?.country) {
      subtitle = `${company.city ? `${company.city}, ` : ''}${company.country}`;
    } else if (conversation.supplier?.city) {
      subtitle = `${conversation.supplier.city}, ${conversation.supplier.country || 'India'}`;
    } else {
      subtitle = 'Verified Supplier';
    }

    return {
      name: supplierName,
      company,
      subtitle,
    };
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((item) => {
      const company = getCompany(item.companyId);
      const buyerName = item.buyerName || item.buyer?.name || '';
      const supplierName = company?.name || item.supplier?.company || item.supplier?.name || '';
      const subject = item.subject || '';
      const messagesText = (item.messages || []).map((m) => m.text || m.content || '').join(' ');
      return `${subject} ${buyerName} ${supplierName} ${messagesText}`.toLowerCase().includes(q);
    });
  }, [conversations, search, getCompany]);

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

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Messages' }]}
        title="Messages"
        description="Direct, authenticated conversations between buyers and suppliers on TradeExpress."
      />
      <div className="ts-container py-6">
        {error ? (
          <div className="ts-card">
            <ErrorState text={error} onRetry={reload} />
          </div>
        ) : (
          <div className="ts-card grid grid-cols-1 h-[calc(100dvh-13rem)] min-h-[34rem] overflow-hidden md:grid-cols-[22rem_minmax(0,1fr)] shadow-sm border border-navy-100">
            {/* Conversation list panel */}
            <aside
              aria-label="Conversations"
              className={`min-h-0 min-w-0 flex-col md:border-r border-navy-100 bg-white ${
                active ? 'hidden md:flex' : 'flex'
              }`}
            >
              <div className="border-b border-navy-100 p-3 bg-surface/30">
                <label htmlFor="message-search" className="sr-only">
                  Search conversations
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                    aria-hidden="true"
                  />
                  <input
                    id="message-search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search conversations…"
                    className="ts-input pl-9 text-sm"
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-navy-50">
                {loading ? (
                  <div className="space-y-4 p-4" role="status" aria-label="Loading conversations">
                    {Array.from({ length: 4 }, (_, index) => (
                      <div key={index} className="flex gap-3">
                        <Skeleton className="size-12 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <EmptyState
                    icon={MessageSquare}
                    className="!py-12"
                    title={search ? 'No matching conversations' : 'No conversations yet'}
                    text={
                      search
                        ? 'Try a different search term or check spelling.'
                        : side === 'supplier'
                        ? 'Inquiries and messages from buyers will appear here in real time.'
                        : 'Contact a supplier from any product details page to start a conversation.'
                    }
                    action={
                      !search && side === 'buyer' && !isAdmin ? (
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
                      const unread = isAdmin ? 0 : conversation.unread?.[side] ?? 0;
                      const selected = conversation.id === activeId;

                      return (
                        <li key={conversation.id}>
                          <button
                            type="button"
                            onClick={() => open(conversation.id)}
                            aria-current={selected ? 'true' : undefined}
                            className={`flex w-full gap-3 px-4 py-3.5 text-left transition-colors border-l-4 ${
                              selected
                                ? 'bg-navy-50/80 border-navy-900'
                                : unread
                                ? 'bg-brand-50/20 border-brand-500 hover:bg-surface'
                                : 'border-transparent hover:bg-surface'
                            }`}
                          >
                            {info.company ? (
                              <CompanyLogo company={info.company} />
                            ) : (
                              <Avatar name={info.name} />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline justify-between gap-2">
                                <span
                                  className={`truncate text-sm ${
                                    unread
                                      ? 'font-bold text-navy-950'
                                      : selected
                                      ? 'font-semibold text-navy-900'
                                      : 'font-semibold text-ink'
                                  }`}
                                >
                                  {info.name}
                                </span>
                                <span className="shrink-0 text-[0.6875rem] font-medium text-muted">
                                  {last?.at ? formatMessageTime(last.at) : ''}
                                </span>
                              </span>

                              <span className="mt-0.5 block truncate text-xs font-medium text-navy-800">
                                {conversation.subject}
                              </span>

                              <span className="mt-1 flex items-center justify-between gap-2">
                                <span
                                  className={`truncate text-[0.8125rem] ${
                                    unread ? 'font-medium text-navy-900' : 'text-muted'
                                  }`}
                                >
                                  {last ? last.text || last.content : 'No messages yet'}
                                </span>
                                {unread > 0 && (
                                  <span
                                    className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[0.6875rem] font-bold leading-5 text-navy-950 shadow-xs"
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

            {/* Conversation thread panel */}
            <section
              aria-label="Conversation"
              className={`min-h-0 min-w-0 flex-col bg-slate-50/40 ${
                active ? 'flex' : 'hidden md:flex'
              }`}
            >
              {!active ? (
                <EmptyState
                  icon={MessageSquare}
                  className="my-auto"
                  title="Select a conversation"
                  text="Choose a conversation from the list to view its message history and reply."
                />
              ) : (
                <>
                  {/* Conversation Header */}
                  <header className="flex items-center gap-3 border-b border-navy-100 bg-white px-4 py-3 sm:px-6 shadow-xs">
                    <IconButton
                      icon={ArrowLeft}
                      label="Back to conversations"
                      size="sm"
                      onClick={() => open('')}
                      className="md:hidden"
                    />

                    {other.company ? <CompanyLogo company={other.company} size="sm" /> : <Avatar name={other.name} />}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-base font-bold text-navy-950">
                          {other.company ? (
                            <Link to={`/suppliers/${other.company.slug}`} className="hover:text-brand-600">
                              {other.name}
                            </Link>
                          ) : (
                            other.name
                          )}
                        </h2>
                      </div>
                      <p className="truncate text-xs text-muted">
                        {other.subtitle}
                        {product ? (
                          <>
                            {' '}· Regarding{' '}
                            <Link
                              to={`/products/${product.slug}`}
                              className="font-semibold text-navy-900 hover:text-brand-600 inline-flex items-center gap-1"
                            >
                              <Package className="size-3 inline" />
                              {product.name}
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </header>

                  {/* Messages Stream */}
                  <div
                    className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-6"
                    role="log"
                    aria-live="polite"
                    aria-label={`Messages with ${other.name}`}
                  >
                    {active.messages.length === 0 ? (
                      <p className="py-12 text-center text-sm text-muted">
                        No messages in this conversation yet. Send the first message below.
                      </p>
                    ) : null}

                    {active.messages.map((message) => {
                      const mine = !isAdmin && (message.from === side || message.senderId === user?.id);

                      return (
                        <div
                          key={message.id}
                          className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-xs sm:max-w-[70%] transition-all ${
                              mine
                                ? 'rounded-br-sm bg-navy-900 text-white'
                                : 'rounded-bl-sm bg-white text-navy-950 ring-1 ring-navy-100'
                            }`}
                          >
                            {isAdmin ? (
                              <p className="mb-1 text-[0.6875rem] font-bold uppercase tracking-wider text-muted">
                                {message.from === 'buyer' ? active.buyerName : 'Supplier'}
                              </p>
                            ) : null}

                            {message.automated ? (
                              <p className="mb-1 inline-flex items-center gap-1 text-[0.6875rem] font-bold uppercase tracking-wide text-brand-600">
                                <Bot className="size-3.5" aria-hidden="true" />
                                Automated notice
                              </p>
                            ) : null}

                            <p className="whitespace-pre-wrap break-words leading-relaxed">
                              {message.text || message.content}
                            </p>

                            <div
                              className={`mt-1.5 flex items-center justify-end gap-1 text-[0.6875rem] ${
                                mine ? 'text-navy-200' : 'text-muted'
                              }`}
                            >
                              <time dateTime={message.at} title={formatDateTime(message.at)}>
                                {formatMessageTime(message.at)}
                              </time>
                              {mine && (
                                <span title={message.isRead ? 'Read' : 'Sent'}>
                                  {message.isRead ? (
                                    <CheckCheck className="size-3.5 text-brand-400" aria-label="Read" />
                                  ) : (
                                    <Check className="size-3.5 text-navy-300" aria-label="Delivered" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {isTypingActive && (
                      <div className="flex justify-start">
                        <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-2 text-xs text-muted ring-1 ring-navy-100 flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full bg-navy-400 animate-pulse" />
                          <span className="size-1.5 rounded-full bg-navy-400 animate-pulse [animation-delay:200ms]" />
                          <span className="size-1.5 rounded-full bg-navy-400 animate-pulse [animation-delay:400ms]" />
                          <span>{other.name} is typing…</span>
                        </div>
                      </div>
                    )}

                    <div ref={threadEnd} />
                  </div>

                  {/* Message Composer */}
                  {isAdmin ? (
                    <div className="border-t border-navy-100 bg-white px-5 py-3 text-center text-[0.8125rem] text-muted">
                      Administrators have read-only access to buyer–supplier conversations.
                    </div>
                  ) : (
                    <form onSubmit={submit} className="border-t border-navy-100 bg-white p-3 sm:p-4">
                      {sendError && (
                        <div className="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">
                          {sendError}
                        </div>
                      )}
                      <label htmlFor="message-draft" className="sr-only">
                        Write a message
                      </label>
                      <div className="flex items-end gap-2">
                        <textarea
                          id="message-draft"
                          ref={composer}
                          rows={1}
                          value={draft}
                          maxLength={5000}
                          placeholder={`Message ${other.name}…`}
                          onChange={handleInputChange}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              submit(event);
                            }
                          }}
                          className="ts-input max-h-36 min-h-11 flex-1 resize-none py-2.5 text-sm"
                          disabled={isSendingLocal || sending}
                        />
                        <Button
                          type="submit"
                          icon={isSendingLocal || sending ? Loader2 : Send}
                          disabled={!draft.trim() || isSendingLocal || sending}
                          className="shrink-0 font-semibold"
                        >
                          <span className="hidden sm:inline">
                            {isSendingLocal || sending ? 'Sending…' : 'Send'}
                          </span>
                          <span className="sr-only sm:hidden">Send</span>
                        </Button>
                      </div>
                      <p className="mt-1.5 text-[0.6875rem] text-muted">
                        Press Enter to send, Shift+Enter for a new line. Messages are saved securely in MySQL.
                      </p>
                    </form>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}
