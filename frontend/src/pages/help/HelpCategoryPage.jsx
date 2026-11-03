import { Link, useParams } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import HelpSubpageLayout from '../../components/help/HelpSubpageLayout';
import HelpArticleList from '../../components/help/HelpArticleList';
import { helpIcon } from '../../components/help/helpIcons';
import { HELP_ARTICLES, HELP_AUDIENCES, HELP_CATEGORIES, getHelpCategory, helpCategoryPath } from '../../data/help/helpContent';
import { searchHelpArticles } from '../../utils/helpSearch';

/** All articles in one learning-center topic, filterable by audience. */
export default function HelpCategoryPage() {
  const { categoryId } = useParams();
  const category = getHelpCategory(categoryId);
  useDocumentTitle(category ? `${category.title} | TradeExpress Help Center` : 'Topic not found | TradeExpress Help Center');

  if (!category) {
    return (
      <HelpSubpageLayout breadcrumbs={[{ label: 'Help Center', to: '/help' }, { label: 'Topic not found' }]} title="Topic not found">
        <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center">
          <SearchX className="mx-auto size-9 text-muted" aria-hidden="true" />
          <p className="mt-3 font-semibold text-navy-900">This help topic doesn’t exist.</p>
          <Link to="/help" className="mt-4 inline-flex min-h-10 items-center rounded-full bg-navy-900 px-5 text-sm font-semibold text-white hover:bg-navy-800">Help Center</Link>
        </div>
      </HelpSubpageLayout>
    );
  }

  const groups = HELP_AUDIENCES.map((audience) => ({
    ...audience,
    articles: searchHelpArticles(HELP_ARTICLES, '', { category: category.id })
      .map(({ article }) => article)
      .filter((article) => article.audience === audience.id),
  })).filter((group) => group.articles.length);

  return (
    <HelpSubpageLayout
      breadcrumbs={[{ label: 'Help Center', to: '/help' }, { label: category.title }]}
      eyebrow="Help topic"
      title={category.title}
      description={category.description}
      icon={helpIcon(category.icon)}
    >
      <div className="space-y-10">
        {groups.map((group) => (
          <section key={group.id} aria-labelledby={`group-${group.id}`}>
            <h2 id={`group-${group.id}`} className="mb-4 font-display text-lg font-bold text-navy-900">
              {group.id === 'all' ? 'For everyone' : `For ${group.label.toLowerCase()}`}
            </h2>
            <HelpArticleList articles={group.articles} />
          </section>
        ))}

        <nav aria-label="Other help topics" className="border-t border-line pt-8">
          <h2 className="mb-3 text-sm font-bold text-navy-900">Other topics</h2>
          <ul className="flex flex-wrap gap-2">
            {HELP_CATEGORIES.filter((item) => item.id !== category.id).map((item) => (
              <li key={item.id}>
                <Link to={helpCategoryPath(item.id)} className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3.5 text-sm font-medium text-navy-800 hover:border-success/40 hover:text-success">
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </HelpSubpageLayout>
  );
}
