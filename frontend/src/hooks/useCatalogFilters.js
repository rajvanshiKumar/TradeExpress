import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

// Maps filter names to short URL parameter names.
const PARAMS = {
  q: 'q', category: 'category', subcategory: 'sub', minPrice: 'min', maxPrice: 'max', maxMoq: 'moq', countries: 'country',
  businessTypes: 'type', condition: 'condition', ready: 'ready', inStock: 'stock', sample: 'sample', deal: 'deal', isNew: 'new', sort: 'sort', page: 'page',
};
const LISTS = ['countries', 'businessTypes'];
const FLAGS = ['ready', 'inStock', 'sample', 'deal', 'isNew'];

/**
 * Catalogue filters stored in the URL, so results can be shared, bookmarked and
 * survive a refresh. Returns { filters, update(patch), clear(), page, setPage }.
 */
export default function useCatalogFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const result = {};
    Object.entries(PARAMS).forEach(([name, param]) => {
      const raw = searchParams.get(param) ?? '';
      if (LISTS.includes(name)) result[name] = raw ? raw.split(',').filter(Boolean) : [];
      else if (FLAGS.includes(name)) result[name] = raw === '1';
      else result[name] = raw;
    });
    result.sort = result.sort || 'relevance';
    result.page = Math.max(parseInt(result.page, 10) || 1, 1);
    return result;
  }, [searchParams]);

  const write = useCallback((next) => {
    const params = new URLSearchParams();
    Object.entries(PARAMS).forEach(([name, param]) => {
      const value = next[name];
      if (LISTS.includes(name)) {
        if (value?.length) params.set(param, value.join(','));
      } else if (FLAGS.includes(name)) {
        if (value) params.set(param, '1');
      } else if (name === 'sort') {
        if (value && value !== 'relevance') params.set(param, value);
      } else if (name === 'page') {
        if (Number(value) > 1) params.set(param, String(value));
      } else if (value !== '' && value !== null && value !== undefined) {
        params.set(param, String(value));
      }
    });
    setSearchParams(params);
  }, [setSearchParams]);

  /** Changing any filter returns to page 1. */
  const update = useCallback((patch) => write({ ...filters, ...patch, page: patch.page ?? 1 }), [filters, write]);
  const setPage = useCallback((page) => write({ ...filters, page }), [filters, write]);
  /** Clears every filter but keeps the sort order. */
  const clear = useCallback(() => write({ sort: filters.sort }), [filters.sort, write]);

  return { filters, update, clear, setPage };
}
