import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Bot, MessageSquare, Search, Send } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import Button, { IconButton } from '../components/common/Button';
import Badge from '../components/common/Badge';
import CompanyLogo from '../components/common/CompanyLogo';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Skeleton from '../components/common/Skeleton';
import useAuth from '../hooks/useAuth';
import useProducts from '../hooks/useProducts';
import useMessages from '../hooks/useMessages';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { formatDateTime, formatMessageTime } from '../utils/formatDate';

function Avatar({ name }) {
  return <span aria-hidden="true" className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-navy-100 font-display text-sm font-extrabold text-navy-900">{name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>;
}

export default function Messages() {
  const { user } = useAuth();
  const { getCompany, getProduct } = useProducts();
  const { conversations, loading, error, reload, side, sendMessage, markRead } = useMessages();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const threadEnd = useRef(null);
  const composer = useRef(null);
  useDocumentTitle('Messages');

  const isAdmin = user.role === 'admin';
  const activeId = searchParams.get('c') ?? '';
  const active = conversations.find((item) => item.id === activeId) ?? null;

  // What the signed-in user sees as the "other party" of a conversation.
  const describe = (conversation) => {
    const company = getCompany(conversation.companyId);
    if (side === 'supplier') return { name: conversation.buyerName, company: null, subtitle: 'Buyer' };
    return { name: company?.name ?? 'Supplier', company, subtitle: isAdmin ? `with ${conversation.buyerName}` : company ? `${company.city ? `${company.city}, ` : ''}${company.country}` : '' };
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((item) => {
      const company = getCompany(item.companyId);
      return `${item.subject} ${item.buyerName} ${company?.name ?? ''} ${item.messages.map((message) => message.text).join(' ')}`.toLowerCase().includes(q);
    });
  }, [conversations, search, getCompany]);

  const open = (id) => {
    const params = new URLSearchParams(searchParams);
    if (id) params.set('c', id); else params.delete('c');
    setSearchParams(params);
  };

  const messageCount = active?.messages.length ?? 0;
  useEffect(() => {
    if (!active) return;
    markRead(active.id);
    threadEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [active?.id, messageCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (event) => {
    event.preventDefault();
    if (!draft.trim() || !active) return;
    sendMessage(active.id, draft);
    setDraft('');
    composer.current?.focus();
  };

  const other = active ? describe(active) : null;
  const product = active?.productId ? getProduct(active.productId) : null;

  return (
    <>
      <PageHeader breadcrumbs={[{ label: 'Messages' }]} title="Messages" description="Conversations between buyers and suppliers. In this version of TradeSphere, messages are stored in your browser." />
      <div className="ts-container py-6">
        {error ? <div className="ts-card"><ErrorState text={error} onRetry={reload} /></div> : (
          <div className="ts-card grid grid-cols-1 h-[calc(100dvh-13rem)] min-h-[32rem] overflow-hidden md:grid-cols-[20rem_minmax(0,1fr)]">
            {/* Conversation list */}
            <aside aria-label="Conversations" className={`min-h-0 min-w-0 flex-col md:border-r ${active ? 'hidden md:flex' : 'flex'}`}>
              <div className="border-b p-3">
                <label htmlFor="message-search" className="sr-only">Search conversations</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                  <input id="message-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" className="ts-input pl-9" />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {loading ? (
                  <div className="space-y-4 p-4" role="status" aria-label="Loading conversations">
                    {Array.from({ length: 4 }, (_, index) => <div key={index} className="flex gap-3"><Skeleton className="size-12 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-full" /></div></div>)}
                  </div>
                ) : filtered.length === 0 ? (
                  <EmptyState
                    icon={MessageSquare} className="!py-10" title={search ? 'No matches' : 'No conversations yet'}
                    text={search ? 'Try a different search term.' : side === 'supplier' ? 'Conversations started by buyers will appear here.' : 'Use “Contact Supplier” on a product or company page to start one.'}
                    action={!search && side === 'buyer' && !isAdmin ? <Button to="/suppliers" variant="navy" size="sm">Find suppliers</Button> : null}
                  />
                ) : (
                  <ul>
                    {filtered.map((conversation) => {
                      const info = describe(conversation);
                      const last = conversation.messages[conversation.messages.length - 1];
                      const unread = isAdmin ? 0 : conversation.unread?.[side] ?? 0;
                      const selected = conversation.id === activeId;
                      return (
                        <li key={conversation.id} className="border-b">
                          <button type="button" onClick={() => open(conversation.id)} aria-current={selected ? 'true' : undefined} className={`flex w-full gap-3 px-4 py-3.5 text-left transition-colors ${selected ? 'bg-navy-50' : 'hover:bg-surface'}`}>
                            {info.company ? <CompanyLogo company={info.company} /> : <Avatar name={info.name} />}
                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline justify-between gap-2">
                                <span className={`truncate text-sm ${unread ? 'font-bold text-navy-900' : 'font-semibold text-ink'}`}>{info.name}</span>
                                <span className="shrink-0 text-[0.6875rem] text-muted">{last ? formatMessageTime(last.at) : ''}</span>
                              </span>
                              <span className="block truncate text-xs font-medium text-navy-800">{conversation.subject}</span>
                              <span className="mt-0.5 flex items-center justify-between gap-2">
                                <span className="truncate text-[0.8125rem] text-muted">{last ? last.text : 'No messages yet'}</span>
                                {unread ? <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[0.6875rem] font-bold leading-5 text-navy-900" aria-label={`${unread} unread`}>{unread}</span> : null}
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

            {/* Thread */}
            <section aria-label="Conversation" className={`min-h-0 min-w-0 flex-col ${active ? 'flex' : 'hidden md:flex'}`}>
              {!active ? (
                <EmptyState icon={MessageSquare} className="my-auto" title="Select a conversation" text="Choose a conversation from the list to read and reply." />
              ) : (
                <>
                  <header className="flex items-center gap-3 border-b px-3 py-3 sm:px-5">
                    <IconButton icon={ArrowLeft} label="Back to conversations" size="sm" onClick={() => open('')} className="md:hidden" />
                    {other.company ? <CompanyLogo company={other.company} size="sm" /> : null}
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-base font-bold">
                        {other.company ? <Link to={`/suppliers/${other.company.slug}`} className="hover:text-brand-600">{other.name}</Link> : other.name}
                      </h2>
                      <p className="truncate text-xs text-muted">{other.subtitle}{product ? <> · About <Link to={`/products/${product.slug}`} className="font-medium text-navy-800 hover:text-brand-600">{product.name}</Link></> : null}</p>
                    </div>
                  </header>

                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-surface/60 p-4 sm:p-5" role="log" aria-live="polite" aria-label={`Messages with ${other.name}`}>
                    {active.messages.length === 0 ? <p className="py-10 text-center text-sm text-muted">No messages yet. Write the first one below.</p> : null}
                    {active.messages.map((message) => {
                      const mine = !isAdmin && message.from === side;
                      return (
                        <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm sm:max-w-[70%] ${mine ? 'rounded-br-md bg-navy-900 text-white' : 'rounded-bl-md bg-white text-ink ring-1 ring-line'}`}>
                            {isAdmin ? <p className="mb-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-muted">{message.from === 'buyer' ? active.buyerName : 'Supplier'}</p> : null}
                            {message.automated ? <p className="mb-1 inline-flex items-center gap-1 text-[0.6875rem] font-bold uppercase tracking-wide text-brand-600"><Bot className="size-3.5" aria-hidden="true" />Automated reply</p> : null}
                            <p className="whitespace-pre-wrap break-words">{message.text}</p>
                            <p className={`mt-1 text-right text-[0.6875rem] ${mine ? 'text-navy-200' : 'text-muted'}`}><time dateTime={message.at} title={formatDateTime(message.at)}>{formatMessageTime(message.at)}</time></p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={threadEnd} />
                  </div>

                  {isAdmin ? (
                    <p className="border-t px-5 py-3 text-center text-[0.8125rem] text-muted">The admin can read conversations but not reply.</p>
                  ) : (
                    <form onSubmit={submit} className="border-t p-3 sm:p-4">
                      <label htmlFor="message-draft" className="sr-only">Write a message</label>
                      <div className="flex items-end gap-2">
                        <textarea
                          id="message-draft" ref={composer} rows={1} value={draft} maxLength={1000} placeholder="Write a message…" onChange={(event) => setDraft(event.target.value)}
                          onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) submit(event); }} className="ts-input max-h-32 min-h-11 flex-1 resize-none"
                        />
                        <Button type="submit" icon={Send} disabled={!draft.trim()}><span className="hidden sm:inline">Send</span><span className="sr-only sm:hidden">Send</span></Button>
                      </div>
                      <p className="mt-1.5 text-[0.6875rem] text-muted">Messages are stored in this browser. Press Enter to send, Shift+Enter for a new line.</p>
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
