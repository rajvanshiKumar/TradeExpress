import { ChevronLeft, ChevronRight } from 'lucide-react';

function pageList(page, pageCount) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
  const result = [];
  sorted.forEach((value, index) => {
    if (index && value - sorted[index - 1] > 1) result.push('gap-' + value);
    result.push(value);
  });
  return result;
}

export default function Pagination({ page, pageCount, onChange, className = '' }) {
  if (pageCount <= 1) return null;
  const button = 'inline-flex size-10 items-center justify-center rounded-lg border text-sm font-semibold transition-colors disabled:opacity-40';
  return (
    <nav aria-label="Pagination" className={`flex flex-wrap items-center justify-center gap-1.5 ${className}`}>
      <button type="button" className={`${button} bg-white hover:bg-navy-50`} onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
        <ChevronLeft className="size-4" aria-hidden="true" />
      </button>
      {pageList(page, pageCount).map((item) => (typeof item === 'string' ? (
        <span key={item} className="px-1 text-muted" aria-hidden="true">…</span>
      ) : (
        <button
          key={item} type="button" onClick={() => onChange(item)} aria-label={`Page ${item}`} aria-current={item === page ? 'page' : undefined}
          className={`${button} ${item === page ? 'border-navy-900 bg-navy-900 text-white' : 'bg-white hover:bg-navy-50'}`}
        >
          {item}
        </button>
      )))}
      <button type="button" className={`${button} bg-white hover:bg-navy-50`} onClick={() => onChange(page + 1)} disabled={page >= pageCount} aria-label="Next page">
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
