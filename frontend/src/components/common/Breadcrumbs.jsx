import { Link } from 'react-router-dom';
import { ChevronRight, House } from 'lucide-react';

/** items: [{ label, to }] — the last item is the current page and is not a link. */
export default function Breadcrumbs({ items = [], className = '' }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-[0.8125rem] text-muted">
        <li>
          <Link to="/" className="inline-flex items-center gap-1 rounded hover:text-navy-900">
            <House className="size-3.5" aria-hidden="true" />
            <span>Home</span>
          </Link>
        </li>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
              <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
              {isLast || !item.to ? (
                <span aria-current={isLast ? 'page' : undefined} className="truncate font-semibold text-ink">{item.label}</span>
              ) : (
                <Link to={item.to} className="truncate rounded hover:text-navy-900">{item.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
