import { Link } from 'react-router-dom';
import { ArrowRight, Store, UserRound } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import HelpSubpageLayout from '../../components/help/HelpSubpageLayout';
import HelpArticleList from '../../components/help/HelpArticleList';
import { HELP_ARTICLES, HELP_CATEGORIES, helpAudiencePath } from '../../data/help/helpContent';
import { searchHelpArticles } from '../../utils/helpSearch';

const AUDIENCE_PAGES = {
  buyer: {
    title: 'Help for buyers',
    description: 'Guides for sourcing on TradeExpress: signup, finding products, RFQs, orders, payments and disputes.',
    icon: UserRound,
    start: { to: '/buyer/register', label: 'Create a buyer account' },
  },
  supplier: {
    title: 'Help for suppliers',
    description: 'Guides for selling on TradeExpress: signup and verification, listings, quotations, orders and payouts.',
    icon: Store,
    start: { to: '/supplier/register', label: 'Register as a supplier' },
  },
};

/** Every guide for buyers or for suppliers (including shared ones), grouped by topic. */
export default function HelpAudiencePage({ audience }) {
  const page = AUDIENCE_PAGES[audience];
  useDocumentTitle(`${page.title} | TradeExpress Help Center`);
  const other = audience === 'buyer' ? 'supplier' : 'buyer';

  const topics = HELP_CATEGORIES.map((category) => ({
    ...category,
    articles: searchHelpArticles(HELP_ARTICLES, '', { audience, category: category.id }).map(({ article }) => article),
  })).filter((topic) => topic.articles.length);

  return (
    <HelpSubpageLayout
      breadcrumbs={[{ label: 'Help Center', to: '/help' }, { label: page.title }]}
      eyebrow="Help Center"
      title={page.title}
      description={page.description}
      icon={page.icon}
      audience={audience}
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Topics on this page" className="hidden lg:block lg:sticky lg:top-28 lg:self-start">
          <ul className="space-y-0.5 rounded-2xl border border-line bg-white p-3">
            {topics.map((topic) => (
              <li key={topic.id}>
                <a href={`#topic-${topic.id}`} className="block rounded-lg px-2 py-2 text-sm text-navy-800 hover:bg-surface hover:text-success">
                  {topic.title} <span className="text-muted">({topic.articles.length})</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-10">
          {topics.map((topic) => (
            <section key={topic.id} id={`topic-${topic.id}`} aria-labelledby={`topic-title-${topic.id}`} className="scroll-mt-28">
              <h2 id={`topic-title-${topic.id}`} className="mb-4 font-display text-lg font-bold text-navy-900">{topic.title}</h2>
              <HelpArticleList articles={topic.articles} />
            </section>
          ))}

          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <Link to={page.start.to} className="inline-flex items-center gap-1.5 text-sm font-semibold text-success hover:underline">
              {page.start.label} <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link to={helpAudiencePath(other)} className="text-sm font-medium text-navy-800 hover:text-success">
              Looking for {AUDIENCE_PAGES[other].title.toLowerCase()}?
            </Link>
          </div>
        </div>
      </div>
    </HelpSubpageLayout>
  );
}
