import { Star } from 'lucide-react';

/** Star rating. Ratings shown are sample values. */
export default function Rating({ value = 0, count, size = 'sm', showValue = true, className = '' }) {
  const dimension = size === 'lg' ? 'size-5' : 'size-3.5';
  if (!value) return <span className={`text-xs text-muted ${className}`}>No rating yet</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="inline-flex" role="img" aria-label={`Rated ${value} out of 5`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star key={star} className={`${dimension} ${star <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}`} aria-hidden="true" />
        ))}
      </span>
      {showValue ? <span className="text-xs font-semibold text-ink">{Number(value).toFixed(1)}</span> : null}
      {count !== undefined ? <span className="text-xs text-muted">({count})</span> : null}
    </span>
  );
}
