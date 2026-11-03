import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  ChevronRight,
  ClipboardList,
  FileWarning,
  FileText,
  Flag,
  Inbox,
  LifeBuoy,
  PackageSearch,
  Scale,
  SearchX,
  ShieldAlert,
  X,
} from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import Breadcrumbs from '../components/common/Breadcrumbs';
import SupportTicketsSection from '../components/support/SupportTicketsSection';
import HelpSearchBox from '../components/help/HelpSearchBox';
import HelpFaqTabs from '../components/help/HelpFaqTabs';
import Highlight from '../components/help/Highlight';
import { helpIcon } from '../components/help/helpIcons';
import {
  HELP_ARTICLES,
  HELP_AUDIENCES,
  HELP_CATEGORIES,
  HELP_POPULAR_TOPICS,
  getHelpArticle,
  getHelpCategory,
  helpArticlePath,
  helpAudiencePath,
  helpCategoryPath,
} from '../data/help/helpContent';
import { searchHelpArticles } from '../utils/helpSearch';

const QUICK_ACTIONS = [
  { title: 'Track My Order', description: 'Follow your order and shipment with your order number.', to: '/track', icon: PackageSearch },
  { title: 'Post an RFQ', description: 'Describe what you need and receive supplier quotations.', to: '/rfq', icon: ClipboardList },
  { title: 'Raise a Support Ticket', description: 'Ask our team about an order, billing or your account.', to: '#support', icon: LifeBuoy },
  { title: 'File a Trade Dispute', description: 'Report a problem with an order and submit evidence.', to: '/buyer/disputes', icon: Scale },
];

const POLICY_LINKS = [
  { label: 'Terms & Conditions', to: '/terms' },
  { label: 'Privacy', to: '/info/privacy' },
  { label: 'Buyer protection guide', to: '/info/buyer-protection' },
  { label: 'About TradeExpress', to: '/info/about' },
];

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

/** Thin decorative pattern for the hero; purely visual. */
function HeroPattern() {
  return (
    <svg className="pointer-events-none absolute inset-0 size-full text-success/[0.07]" aria-hidden="true">
      <defs>
        <pattern id="help-hero-dots" width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.4" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#help-hero-dots)" />
      <circle cx="8%" cy="110%" r="180" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="94%" cy="-12%" r="220" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SectionHeading({ id, eyebrow, title, description }) {
  return (
    <div className="mb-6 max-w-2xl">
      {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.14em] text-success">{eyebrow}</p> : null}
      <h2 id={id} className="mt-1 font-display text-2xl font-bold tracking-tight text-navy-900 sm:text-[1.75rem]">{title}</h2>
      {description ? <p className="mt-2 text-[0.9375rem] text-muted">{description}</p> : null}
    </div>
  );
}

const cardClass = 'group rounded-2xl border border-line bg-white shadow-card transition-[border-color,box-shadow,transform] duration-200 hover:border-success/40 hover:shadow-lift motion-safe:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success';

export default function Help() {
  useDocumentTitle('Help Center | TradeExpress');
  const [params, setParams] = useSearchParams();
  const committedQuery = params.get('q') || '';
  const category = getHelpCategory(params.get('category')) ? params.get('category') : '';
  const audience = HELP_AUDIENCES.some((item) => item.id === params.get('for')) ? params.get('for') : 'all';
  const navigate = useNavigate();
  // Articles have their own pages now; old ?article= links still work
  const legacyArticle = params.get('article');
  useEffect(() => {
    if (legacyArticle) navigate(helpArticlePath(legacyArticle), { replace: true });
  }, [legacyArticle, navigate]);

  const [query, setQuery] = useState(committedQuery);
  const pendingScroll = useRef(false);

  // Keep the box in step with the URL (browser back/forward)
  useEffect(() => setQuery(committedQuery), [committedQuery]);

  // Links such as /help#support (from the header support menu) open at that section
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return undefined;
    const timer = setTimeout(() => scrollToId(hash.slice(1)), 50);
    return () => clearTimeout(timer);
  }, [hash]);

  const updateParams = (changes) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
      return next;
    }, { replace: true });
  };

  const showResults = Boolean(committedQuery.trim() || category);
  const results = useMemo(
    () => (showResults ? searchHelpArticles(HELP_ARTICLES, committedQuery, { audience, category, categories: HELP_CATEGORIES }) : []),
    [showResults, committedQuery, audience, category],
  );

  useEffect(() => {
    if (showResults && pendingScroll.current) {
      pendingScroll.current = false;
      scrollToId('help-results');
    }
  }, [showResults, committedQuery, category]);

  const runSearch = (value) => {
    pendingScroll.current = true;
    updateParams({ q: value.trim(), category: '' });
  };
  const clearResults = () => {
    setQuery('');
    updateParams({ q: '', category: '' });
  };
  const openArticle = (slug) => navigate(helpArticlePath(slug));

  const popularTopics = HELP_POPULAR_TOPICS.map(getHelpArticle).filter(Boolean);
  const visibleCategory = getHelpCategory(category);

  return (
    <div className="bg-surface pb-16">
      <div className="border-b border-line bg-white">
        <div className="ts-container py-2.5 text-xs">
          <Breadcrumbs items={[{ label: 'Help Center' }]} />
        </div>
      </div>

      {/* Hero */}
      <section aria-labelledby="help-hero-title" className="relative border-b border-line bg-gradient-to-b from-white to-surface">
        <HeroPattern />
        <div className="ts-container relative py-12 text-center sm:py-16 lg:py-20">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-success">TradeExpress Help Center</p>
          <h1 id="help-hero-title" className="mx-auto mt-3 max-w-3xl font-display text-[2rem] font-extrabold leading-tight tracking-tight text-navy-900 sm:text-5xl">
            How Can We Help You Today?
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[0.9375rem] text-muted sm:text-base">
            Find answers, explore helpful guides, and get support for your wholesale trading journey.
          </p>

          <div className="mx-auto mt-7 inline-flex rounded-full border border-line bg-white p-1 shadow-card" role="group" aria-label="Show help for">
            {HELP_AUDIENCES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={audience === item.id}
                onClick={() => updateParams({ for: item.id === 'all' ? '' : item.id })}
                className={`min-h-9 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold transition-colors sm:px-4 ${
                  audience === item.id ? 'bg-success text-white' : 'text-navy-800 hover:text-success'
                }`}
              >
                {item.id === 'all' ? 'Everyone' : <><span className="hidden sm:inline">For </span>{item.label}</>}
              </button>
            ))}
          </div>

          <div className="mt-5">
            <HelpSearchBox value={query} onChange={setQuery} onSearch={runSearch} onOpenArticle={openArticle} audience={audience} />
          </div>

          {/* One scrollable row on phones, wrapped and centred on larger screens */}
          <div className="ts-no-scrollbar -mx-4 mt-5 flex items-center gap-2 overflow-x-auto px-4 text-sm sm:mx-auto sm:max-w-3xl sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">
            <span className="shrink-0 font-medium text-muted">Popular:</span>
            {popularTopics.map((item) => (
              <button
                key={item.slug}
                type="button"
                onClick={() => openArticle(item.slug)}
                className="min-h-9 shrink-0 whitespace-nowrap rounded-full border border-line bg-white px-3.5 text-[0.8125rem] font-medium text-navy-800 transition-colors hover:border-success/40 hover:text-success"
              >
                {item.title}
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            <Link to={helpAudiencePath('buyer')} className="inline-flex items-center gap-1 font-semibold text-navy-800 hover:text-success">
              Guides for buyers <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link to={helpAudiencePath('supplier')} className="inline-flex items-center gap-1 font-semibold text-navy-800 hover:text-success">
              Guides for suppliers <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>

          <p className="mt-4 text-sm text-muted">
            Can’t find what you need?{' '}
            <a href="#support" onClick={(event) => { event.preventDefault(); scrollToId('support'); }} className="font-semibold text-success hover:underline">
              Contact support
            </a>
          </p>
        </div>
      </section>

      <div className="ts-container space-y-16 pt-12 sm:pt-14">
        {/* Search / category results */}
        {showResults ? (
          <section id="help-results" aria-labelledby="help-results-title" className="scroll-mt-28">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="help-results-title" className="font-display text-xl font-bold text-navy-900 sm:text-2xl">
                  {committedQuery ? <>Results for “{committedQuery}”</> : visibleCategory?.title}
                </h2>
                <p className="mt-1 text-sm text-muted" role="status">
                  {results.length} article{results.length === 1 ? '' : 's'}
                  {audience !== 'all' ? ` for ${audience}s` : ''}
                  {committedQuery && visibleCategory ? ` in ${visibleCategory.title}` : ''}
                </p>
              </div>
              <button type="button" onClick={clearResults} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-white px-4 text-sm font-semibold text-navy-800 hover:border-success/40 hover:text-success">
                <X className="size-4" aria-hidden="true" /> Clear
              </button>
            </div>

            {committedQuery ? (
              <div className="ts-no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter results by category">
                {[{ id: '', title: 'All topics' }, ...HELP_CATEGORIES].map((item) => (
                  <button
                    key={item.id || 'all'}
                    type="button"
                    aria-pressed={category === item.id}
                    onClick={() => updateParams({ category: item.id })}
                    className={`min-h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[0.8125rem] font-semibold transition-colors ${
                      category === item.id ? 'bg-navy-900 text-white' : 'border border-line bg-white text-navy-800 hover:text-success'
                    }`}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            ) : null}

            {results.length ? (
              <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                {results.map(({ article: item }) => (
                  <li key={item.slug}>
                    <button type="button" onClick={() => openArticle(item.slug)} className={`${cardClass} flex h-full w-full items-start justify-between gap-3 p-4 text-left sm:p-5`}>
                      <span className="min-w-0">
                        <span className="text-xs font-semibold text-success">{getHelpCategory(item.category)?.title}</span>
                        <span className="mt-1 block font-semibold text-navy-900"><Highlight text={item.title} query={committedQuery} /></span>
                        <span className="mt-1 block text-sm text-muted"><Highlight text={item.summary} query={committedQuery} /></span>
                      </span>
                      <ChevronRight className="mt-5 size-4 shrink-0 text-muted group-hover:text-success" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center">
                <SearchX className="mx-auto size-9 text-muted" aria-hidden="true" />
                <p className="mt-3 font-semibold text-navy-900">No articles match your search</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                  Try a shorter or different keyword{audience !== 'all' ? ', or show help for everyone' : ''}. You can also browse the topics below or contact support.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {audience !== 'all' ? (
                    <button type="button" onClick={() => updateParams({ for: '' })} className="min-h-10 rounded-full border border-line px-4 text-sm font-semibold text-navy-800 hover:text-success">Show help for everyone</button>
                  ) : null}
                  <button type="button" onClick={() => scrollToId('support')} className="min-h-10 rounded-full bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-800">Contact support</button>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {/* Quick support actions */}
        <section aria-labelledby="help-quick-title">
          <SectionHeading id="help-quick-title" eyebrow="Quick actions" title="Get things done faster" />
          {/* Two compact tiles per row on phones; full cards from tablet up */}
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {QUICK_ACTIONS.map(({ title, description, to, icon: Icon }) => {
              const content = (
                <>
                  <span className="inline-flex size-11 items-center justify-center rounded-xl bg-success-50 text-success transition-colors group-hover:bg-success group-hover:text-white">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="mt-3 block font-display text-[0.9375rem] font-bold leading-snug text-navy-900 sm:mt-4 sm:text-base">{title}</span>
                  <span className="mt-1 hidden text-sm text-muted sm:block">{description}</span>
                  <span className="mt-4 hidden items-center gap-1 text-sm font-semibold text-success sm:inline-flex">
                    Continue <ArrowRight className="size-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </>
              );
              return (
                <li key={title}>
                  {to.startsWith('#') ? (
                    <a href={to} onClick={(event) => { event.preventDefault(); scrollToId(to.slice(1)); }} className={`${cardClass} block h-full p-4 sm:p-5`}>{content}</a>
                  ) : (
                    <Link to={to} className={`${cardClass} block h-full p-4 sm:p-5`}>{content}</Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Learning center */}
        <section aria-labelledby="help-learn-title">
          <SectionHeading
            id="help-learn-title"
            eyebrow="Learning center"
            title="Browse help by topic"
            description="Step-by-step guides for buyers and suppliers, from your first signup to your hundredth order."
          />
          {/* Phones: compact two-column tiles (icon, title, link); tablet and up: full cards with top articles */}
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {HELP_CATEGORIES.map((item) => {
              const Icon = helpIcon(item.icon);
              const articles = searchHelpArticles(HELP_ARTICLES, '', { audience, category: item.id });
              return (
                <li key={item.id} className={`${cardClass} flex flex-col p-4 sm:p-5`}>
                  <span className="inline-flex size-11 items-center justify-center rounded-xl bg-success-50 text-success">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-3 font-display text-[0.9375rem] font-bold leading-snug text-navy-900 sm:mt-4 sm:text-base">{item.title}</h3>
                  <p className="mt-1 hidden text-sm text-muted sm:block">{item.description}</p>
                  <ul className="mt-3 hidden space-y-0.5 border-t border-line pt-3 sm:block">
                    {articles.slice(0, 3).map(({ article: entry }) => (
                      <li key={entry.slug}>
                        <button type="button" onClick={() => openArticle(entry.slug)} className="w-full rounded-md py-1.5 text-left text-sm text-navy-800 hover:text-success">
                          {entry.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={helpCategoryPath(item.id)}
                    className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-semibold text-success hover:underline"
                    aria-label={`View all ${articles.length} articles in ${item.title}`}
                  >
                    View all {articles.length} <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* FAQ tabs */}
        <section aria-labelledby="help-faq-title">
          <SectionHeading id="help-faq-title" eyebrow="FAQ" title="Frequently asked questions" />
          <HelpFaqTabs onOpenArticle={openArticle} />
        </section>

        {/* Support & contact */}
        <section id="support" aria-labelledby="help-support-title" className="scroll-mt-28">
          <SectionHeading
            id="help-support-title"
            eyebrow="Support"
            title="Still need help?"
            description="Signed-in buyers and suppliers can raise a ticket and follow the conversation with our team."
          />
          <ul className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <li>
              <a href="#support-tickets" onClick={(event) => { event.preventDefault(); scrollToId('support-tickets'); }} className={`${cardClass} flex h-full items-start gap-3 p-5`}>
                <LifeBuoy className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
                <span><span className="block font-semibold text-navy-900">Submit a support ticket</span><span className="mt-0.5 block text-sm text-muted">Orders, billing & GST, technical or account questions.</span></span>
              </a>
            </li>
            <li>
              <a href="#support-tickets" onClick={(event) => { event.preventDefault(); scrollToId('support-tickets'); }} className={`${cardClass} flex h-full items-start gap-3 p-5`}>
                <Inbox className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
                <span><span className="block font-semibold text-navy-900">View my tickets</span><span className="mt-0.5 block text-sm text-muted">See replies and the status of your tickets.</span></span>
              </a>
            </li>
            {[
              { title: 'Report IP infringement', text: 'Trademark, copyright or counterfeit concerns.', icon: FileWarning },
              { title: 'Report a violation', text: 'Fake suppliers, misleading listings or suspicious activity.', icon: Flag },
            ].map(({ title, text, icon: Icon }) => (
              <li key={title} className="flex h-full items-start gap-3 rounded-2xl border border-dashed border-line bg-white/70 p-5">
                <Icon className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden="true" />
                <span>
                  <span className="flex flex-wrap items-center gap-2 font-semibold text-navy-900">
                    {title}
                    <span className="rounded-full bg-surface px-2 py-0.5 text-[0.6875rem] font-semibold text-muted">Coming soon</span>
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{text} Until this form is available, please raise a support ticket.</span>
                </span>
              </li>
            ))}
          </ul>
          <div id="support-tickets" className="scroll-mt-28">
            <SupportTicketsSection />
          </div>
        </section>

        {/* Help Center & policy links */}
        <nav aria-label="Help Center and policies" className="flex flex-col gap-4 rounded-2xl border border-line bg-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-navy-900">
            <ShieldAlert className="size-4 text-success" aria-hidden="true" /> Policies & guides
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {POLICY_LINKS.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="inline-flex items-center gap-1.5 text-navy-800 hover:text-success">
                  <FileText className="size-3.5 text-muted" aria-hidden="true" /> {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

    </div>
  );
}
