import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { helpArticlePath } from '../../data/help/helpContent';

/** Grid of article links (title + summary). */
export default function HelpArticleList({ articles }) {
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {articles.map((article) => (
        <li key={article.slug}>
          <Link
            to={helpArticlePath(article.slug)}
            className="group flex h-full items-start justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-card transition-[border-color,box-shadow] hover:border-success/40 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success sm:p-5"
          >
            <span className="min-w-0">
              <span className="block font-semibold text-navy-900 group-hover:text-success">{article.title}</span>
              <span className="mt-1 block text-sm text-muted">{article.summary}</span>
            </span>
            <ChevronRight className="mt-1 size-4 shrink-0 text-muted group-hover:text-success" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
