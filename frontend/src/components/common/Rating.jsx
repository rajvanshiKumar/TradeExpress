import { Star } from 'lucide-react';

/** Genuine Buyer Star rating. Only renders when a valid, positive rating exists. */
export default function Rating({ value = 0, count, size = 'sm', showValue = true, className = '' }) {
  const numVal = Number(value);
  if (!numVal || numVal <= 0) return null;
  const dimension = size === 'lg' ? 'size-5' : 'size-3.5';
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="inline-flex" role="img" aria-label={`Rated ${numVal} out of 5`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star key={star} className={`${dimension} ${star <= Math.round(numVal) ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}`} aria-hidden="true" />
        ))}
      </span>
      {showValue ? <span className="text-xs font-semibold text-ink">{numVal.toFixed(1)}</span> : null}
      {count !== undefined && Number(count) > 0 ? <span className="text-xs text-muted">({Number(count)})</span> : null}
    </span>
  );
}
