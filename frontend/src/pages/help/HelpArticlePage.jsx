import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, LifeBuoy, SearchX } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import HelpSubpageLayout from '../../components/help/HelpSubpageLayout';
import HelpArticleView from '../../components/help/HelpArticleView';
import HelpFeedback from '../../components/help/HelpFeedback';
import { helpIcon } from '../../components/help/helpIcons';
import { HELP_ARTICLES, getHelpArticle, getHelpCategory, helpArticlePath, helpCategoryPath } from '../../data/help/helpContent';

/** One help article, with the other articles in its topic alongside. */
export default function HelpArticlePage() {
  const { slug } = useParams();
  const article = getHelpArticle(slug);
  const category = article ? getHelpCategory(article.category) : null;
  useDocumentTitle(article ? `${article.title} | TradeExpress Help Center` : 'Article not found | TradeExpress Help Center');

  if (!article) {
    return (
      <HelpSubpageLayout breadcrumbs={[{ label: 'Help Center', to: '/help' }, { label: 'Article not found' }]} title="Article not found">
        <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center">
          <SearchX className="mx-auto size-9 text-muted" aria-hidden="true" />
          <p className="mt-3 font-semibold text-navy-900">This help article doesn’t exist or has moved.</p>
          <p className="mt-1 text-sm text-muted">Search above, or go back to the Help Center.</p>
          <Link to="/help" className="mt-4 inline-flex min-h-10 items-center rounded-full bg-navy-900 px-5 text-sm font-semibold text-white hover:bg-navy-800">Help Center</Link>
        </div>
      </HelpSubpageLayout>
    );
  }

  const inTopic = HELP_ARTICLES.filter((item) => item.category === article.category && item.published !== false);

  return (
    <HelpSubpageLayout
      breadcrumbs={[{ label: 'Help Center', to: '/help' }, { label: category.title, to: helpCategoryPath(category.id) }, { label: article.title }]}
      eyebrow={category.title}
      title={article.title}
      icon={helpIcon(category.icon)}
      audience={article.audience}
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-6">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-8">
            <HelpArticleView article={article} />
          </div>
          <HelpFeedback key={article.slug} slug={article.slug} />
          <Link to={helpCategoryPath(category.id)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-success hover:underline">
            <ArrowLeft className="size-4" aria-hidden="true" /> All {category.title} articles
          </Link>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start" aria-label={`More in ${category.title}`}>
          <nav className="rounded-2xl border border-line bg-white p-4">
            <h2 className="px-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">In this topic</h2>
            <ul className="mt-2 space-y-0.5">
              {inTopic.map((item) => {
                const current = item.slug === article.slug;
                return (
                  <li key={item.slug}>
                    <Link
                      to={helpArticlePath(item.slug)}
                      aria-current={current ? 'page' : undefined}
                      className={`block rounded-lg px-2 py-2 text-sm transition-colors ${current ? 'bg-success-50 font-semibold text-success' : 'text-navy-800 hover:bg-surface hover:text-success'}`}
                    >
                      {item.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-navy-900">
              <LifeBuoy className="size-4 text-success" aria-hidden="true" /> Still need help?
            </p>
            <p className="mt-1 text-sm text-muted">Signed-in buyers and suppliers can raise a support ticket.</p>
            <Link to="/help#support" className="mt-3 inline-flex min-h-9 items-center rounded-full border border-line px-4 text-sm font-semibold text-navy-800 hover:border-success/40 hover:text-success">Contact support</Link>
          </div>
        </aside>
      </div>
    </HelpSubpageLayout>
  );
}
