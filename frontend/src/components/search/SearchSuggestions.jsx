import { ArrowUpRight, FolderOpen, LoaderCircle, Package, Search, SearchX } from 'lucide-react';
import { matchSegments } from '../../utils/textHighlight';
import { resolveImage } from '../../utils/images';

/** Flat, keyboard-navigable list: products, then categories, then "search for <query>". */
export function buildSuggestionItems({ products = [], categories = [] }, query) {
  const text = String(query || '').trim();
  return [
    ...products.map((product) => ({ type: 'product', key: `p-${product.id}`, label: product.name, detail: product.categoryName, photo: resolveImage({ photo: product.photo, category: product.categorySlug }, 96, 96).src, to: `/products/${product.slug}` })),
    ...categories.map((category) => ({ type: 'category', key: `c-${category.slug}`, label: category.name, detail: 'Category', to: `/categories/${category.slug}` })),
    ...(text ? [{ type: 'search', key: 'search-all', label: text }] : []),
  ];
}

function Highlighted({ text, query }) {
  return matchSegments(text, query).map((segment, index) => (segment.match
    ? <mark key={index} className="bg-transparent font-bold text-emerald-700">{segment.text}</mark>
    : <span key={index}>{segment.text}</span>));
}

/** Suggestions panel shown under a search input (ARIA listbox; the input is the combobox). */
export default function SearchSuggestions({ id, status, items, query, activeIndex, onPick, onHover }) {
  const hasResults = items.some((item) => item.type !== 'search');
  const firstCategoryIndex = items.findIndex((item) => item.type === 'category');

  return (
    <div className="animate-reveal motion-reduce:animate-none absolute inset-x-0 top-full z-[60] mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-[0_22px_54px_-12px_rgba(11,39,22,0.22)]">
      {status === 'error' ? (
        <p className="px-4 py-3 text-xs text-slate-500" role="status">Suggestions are unavailable right now. Press Enter to search.</p>
      ) : null}
      {status === 'ready' && !hasResults ? (
        <p className="flex items-center gap-2 px-4 py-3 text-sm text-slate-600" role="status">
          <SearchX className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
          No results found for “{query.trim()}”.
        </p>
      ) : null}
      {status === 'loading' && !hasResults ? (
        <p className="flex items-center gap-2 px-4 py-3 text-xs text-slate-500" role="status">
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> Searching…
        </p>
      ) : null}

      <ul id={id} role="listbox" aria-label="Search suggestions" className="max-h-[min(24rem,60vh)] overflow-y-auto overscroll-contain py-1.5">
        {items.map((item, index) => {
          const active = index === activeIndex;
          const Icon = item.type === 'category' ? FolderOpen : item.type === 'search' ? Search : Package;
          return (
            <li key={item.key} role="presentation">
              {index === firstCategoryIndex ? (
                <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400" role="presentation">Categories</p>
              ) : null}
              <div
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={active}
                // mousedown (not click) so the choice registers before the input loses focus
                onMouseDown={(event) => { event.preventDefault(); onPick(item); }}
                onMouseEnter={() => onHover(index)}
                className={`flex cursor-pointer items-center gap-3 px-4 py-2 transition-colors ${active ? 'bg-emerald-50' : 'hover:bg-slate-50'} ${item.type === 'search' ? 'border-t border-slate-100' : ''}`}
              >
                {item.type === 'product' && item.photo ? (
                  <img src={item.photo} alt="" loading="lazy" className="size-9 shrink-0 rounded-lg border border-slate-100 bg-slate-50 object-cover" onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />
                ) : (
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  {item.type === 'search' ? (
                    <span className="block truncate text-sm text-slate-700">Search for “<span className="font-semibold text-slate-900">{item.label}</span>”</span>
                  ) : (
                    <>
                      <span className="block truncate text-sm text-slate-800"><Highlighted text={item.label} query={query} /></span>
                      {item.detail ? <span className="block truncate text-xs text-slate-500">{item.detail}</span> : null}
                    </>
                  )}
                </span>
                <ArrowUpRight className={`size-4 shrink-0 ${active ? 'text-emerald-700' : 'text-slate-300'}`} aria-hidden="true" />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
