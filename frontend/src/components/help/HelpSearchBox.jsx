import { useId, useMemo, useState } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import Highlight from './Highlight';
import { HELP_ARTICLES, HELP_CATEGORIES, getHelpCategory } from '../../data/help/helpContent';
import { searchHelpArticles } from '../../utils/helpSearch';

const MAX_SUGGESTIONS = 6;

/**
 * Help Center search box with instant suggestions (ARIA combobox pattern).
 * Enter on a highlighted suggestion opens that article; otherwise Enter runs a full search.
 */
export default function HelpSearchBox({ value, onChange, onSearch, onOpenArticle, audience = 'all' }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const suggestions = useMemo(
    () => (value.trim().length >= 2
      ? searchHelpArticles(HELP_ARTICLES, value, { audience, categories: HELP_CATEGORIES, limit: MAX_SUGGESTIONS })
      : []),
    [value, audience],
  );
  const showList = open && suggestions.length > 0;

  const choose = (slug) => {
    setOpen(false);
    setActiveIndex(-1);
    onOpenArticle(slug);
  };

  const submit = (event) => {
    event.preventDefault();
    if (showList && activeIndex >= 0) {
      choose(suggestions[activeIndex].article.slug);
      return;
    }
    setOpen(false);
    onSearch(value);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' && suggestions.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp' && suggestions.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === 'Escape') {
      if (showList) {
        setOpen(false);
        setActiveIndex(-1);
      } else if (value) {
        onChange('');
      }
    }
  };

  return (
    <form role="search" onSubmit={submit} className="relative mx-auto w-full max-w-2xl">
      <label htmlFor={`${listId}-input`} className="sr-only">Search the Help Center</label>
      <div className="flex items-center gap-1 rounded-2xl border border-line bg-white p-1.5 shadow-lift transition-colors focus-within:border-success focus-within:ring-2 focus-within:ring-success/20">
        <Search className="ml-3 size-5 shrink-0 text-muted" aria-hidden="true" />
        <input
          id={`${listId}-input`}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
          autoComplete="off"
          enterKeyHint="search"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          placeholder="Search help articles…"
          className="h-11 w-full min-w-0 bg-transparent px-2 text-[0.9375rem] text-ink placeholder:text-muted/80 focus:outline-none"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="submit"
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-800 sm:px-6"
        >
          Search
        </button>
      </div>

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Suggested help articles"
          className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-line bg-white py-1.5 text-left shadow-pop"
        >
          {suggestions.map(({ article }, index) => (
            <li
              key={article.slug}
              id={`${listId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              // mousedown (not click) so the choice registers before the input loses focus
              onMouseDown={(event) => {
                event.preventDefault();
                choose(article.slug);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`flex cursor-pointer items-start gap-3 px-4 py-2.5 ${index === activeIndex ? 'bg-success-50' : ''}`}
            >
              <Search className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink"><Highlight text={article.title} query={value} /></span>
                <span className="block truncate text-xs text-muted">{getHelpCategory(article.category)?.title}</span>
              </span>
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            </li>
          ))}
        </ul>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {open && value.trim().length >= 2 ? `${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'} available.` : ''}
      </p>
    </form>
  );
}
