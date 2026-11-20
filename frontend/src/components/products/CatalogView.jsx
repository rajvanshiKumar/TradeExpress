import { useEffect, useMemo, useRef } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import ProductFilters from './ProductFilters';
import ProductSort from './ProductSort';
import ProductGrid from './ProductGrid';
import ProductCategoryDropdown from './ProductCategoryDropdown';
import Pagination from '../common/Pagination';
import Drawer from '../common/Drawer';
import Button from '../common/Button';
import ErrorState from '../common/ErrorState';
import useProducts from '../../hooks/useProducts';
import useCatalogFilters from '../../hooks/useCatalogFilters';
import useLocalStorage from '../../hooks/useLocalStorage';
import useDisclosure from '../../hooks/useDisclosure';
import { filterProducts } from '../../services/productService';
import { PAGE_SIZE } from '../../utils/constants';
import { normalizeCountryName } from '../../utils/countryData';
import useCurrency from '../../hooks/useCurrency';

/** Builds the removable chips shown above the results. */
function buildChips(filters, categories, lockedCategory, price) {
  const chips = [];
  const add = (label, patch) => chips.push({ label, patch });
  if (filters.q) add(`Search: “${filters.q}”`, { q: '' });
  if (filters.category && !lockedCategory) add(categories.find((item) => item.slug === filters.category)?.name ?? filters.category, { category: '', subcategory: '' });
  if (filters.subcategory) add(filters.subcategory, { subcategory: '' });
  if (filters.minPrice !== '' || filters.maxPrice !== '') add(`Price: ${filters.minPrice !== '' ? price(filters.minPrice) : 'any'} – ${filters.maxPrice !== '' ? price(filters.maxPrice) : 'any'}`, { minPrice: '', maxPrice: '' });
  if (filters.maxMoq) add(`MOQ up to ${filters.maxMoq}`, { maxMoq: '' });
  filters.countries.forEach((country) => add(country, { countries: filters.countries.filter((item) => item !== country) }));
  filters.businessTypes.forEach((type) => add(type, { businessTypes: filters.businessTypes.filter((item) => item !== type) }));
  if (filters.condition) add(`Condition: ${filters.condition}`, { condition: '' });
  if (filters.ready) add('Ready to ship', { ready: false });
  if (filters.inStock) add('In stock', { inStock: false });
  if (filters.sample) add('Sample available', { sample: false });
  if (filters.deal) add('Wholesale deals', { deal: false });
  if (filters.isNew) add('New arrivals', { isNew: false });
  if (filters.verifiedOnly) add('Verified suppliers only', { verifiedOnly: false });
  return chips;
}

/**
 * The full catalogue experience: filter sidebar (a drawer on small screens), sorting,
 * grid/list toggle, active-filter chips, results and pagination.
 * `lockedCategory` pins the view to one category (used by the category page).
 */
export default function CatalogView({ lockedCategory = '' }) {
  const { products, companies, categories, loading, error, reload } = useProducts();
  const { filters: urlFilters, update, clear, setPage } = useCatalogFilters();
  const [view, setView] = useLocalStorage('catalog-view', 'grid');
  const drawer = useDisclosure();
  const topRef = useRef(null);

  const filters = useMemo(() => (lockedCategory ? { ...urlFilters, category: lockedCategory } : urlFilters), [urlFilters, lockedCategory]);
  const results = useMemo(() => filterProducts(products, companies, filters), [products, companies, filters]);
  const countries = useMemo(() => [...new Set(companies.filter((company) => company.status !== 'Suspended').map((company) => normalizeCountryName(company.country)).filter(Boolean))].sort(), [companies]);
  const { displayMoney } = useCurrency();
  const chips = buildChips(filters, categories, lockedCategory, displayMoney);

  // Real figures for the sidebar: live products per category, and the lowest and highest unit price
  const liveProducts = useMemo(() => products.filter((product) => product.status === 'Active'), [products]);
  const categoryCounts = useMemo(() => liveProducts.reduce((counts, product) => {
    counts[product.category] = (counts[product.category] || 0) + 1;
    return counts;
  }, {}), [liveProducts]);
  const priceBounds = useMemo(() => {
    const prices = liveProducts.map((product) => Number(product.price)).filter((price) => Number.isFinite(price) && price >= 0);
    return prices.length ? { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) } : null;
  }, [liveProducts]);

  const pageCount = Math.max(Math.ceil(results.length / PAGE_SIZE), 1);
  const page = Math.min(filters.page, pageCount);
  const visible = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // If filters shrink the result set below the current page, fall back to the last page.
  useEffect(() => {
    if (!loading && filters.page > pageCount) setPage(pageCount);
  }, [loading, filters.page, pageCount, setPage]);

  // A new category, subcategory, filter or page: the results fade in, and if the reader has scrolled past their top,
  // the page glides back up to them
  const resultsKey = JSON.stringify(filters);
  const firstResults = useRef(true);
  useEffect(() => {
    if (firstResults.current) {
      firstResults.current = false;
      return;
    }
    const top = topRef.current;
    if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [resultsKey]);

  const changePage = (next) => setPage(next);

  const filterPanel = (idPrefix, extra = {}) => (
    <ProductFilters
      filters={filters} onChange={update} categories={categories} countries={countries} idPrefix={idPrefix} hideCategory={Boolean(lockedCategory)}
      categoryCounts={categoryCounts} priceBounds={priceBounds} onReset={clear} {...extra}
    />
  );

  if (error) return <div className="ts-card"><ErrorState text={error} onRetry={reload} /></div>;

  return (
    <div ref={topRef} className="scroll-mt-40 lg:grid lg:grid-cols-[18.75rem_minmax(0,1fr)] lg:gap-7">
      <aside aria-label="Filters" className="hidden lg:block">
        {/* Stays still while the page scrolls: its height follows its content (up to a fixed limit that fits the
            screen) and never changes with the scroll position. Longer option lists scroll inside the panel, so the
            header and the Reset / Apply bar are always in view. */}
        <div className="sticky top-24 flex max-h-[min(58rem,calc(100dvh-7.5rem))] flex-col overflow-hidden rounded-xl border border-line bg-white shadow-[0_8px_24px_-16px_rgb(16_40_24/0.25)]">
          {filterPanel('filter')}
        </div>
      </aside>

      <div className="min-w-0">
        {!lockedCategory && categories.length ? (
          <ProductCategoryDropdown
            categories={categories}
            products={products}
            selectedCategory={filters.category || ''}
            selectedSubcategory={filters.subcategory || ''}
            onSelectCategory={(category) => update({ category, subcategory: '' })}
            onSelectSubcategory={(subcategory) => update({ subcategory })}
          />
        ) : null}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted" role="status" aria-live="polite">
            {loading ? 'Loading products…' : (
              <><span className="font-bold text-ink">{results.length}</span> {results.length === 1 ? 'product' : 'products'} found{results.length > PAGE_SIZE ? ` · page ${page} of ${pageCount}` : ''}</>
            )}
          </p>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" icon={SlidersHorizontal} onClick={drawer.onOpen} className="!min-h-10 lg:hidden">
              Filters{chips.length ? ` (${chips.length})` : ''}
            </Button>
            <ProductSort sort={filters.sort} onSortChange={(sort) => update({ sort })} view={view} onViewChange={setView} />
          </div>
        </div>

        {chips.length ? (
          <ul className="mb-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
            {chips.map((chip) => (
              <li key={chip.label}>
                <button type="button" onClick={() => update(chip.patch)} aria-label={`Remove filter: ${chip.label}`} className="inline-flex items-center gap-1.5 rounded-full border border-navy-200 bg-white py-1 pl-3 pr-2 text-[0.8125rem] font-medium text-navy-900 hover:border-brand-500 hover:text-brand-600">
                  {chip.label}<X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
            <li><button type="button" onClick={clear} className="px-1 text-[0.8125rem] font-semibold text-brand-600 hover:text-brand-700">Clear all</button></li>
          </ul>
        ) : null}

        <div key={resultsKey} className="ts-results-enter">
          <ProductGrid
            products={visible} layout={view} loading={loading} skeletonCount={9} columns="grid grid-cols-1 gap-4 xs:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3"
            emptyAction={chips.length ? <Button variant="navy" onClick={clear}>Clear all filters</Button> : <Button to="/products" variant="navy">Browse all products</Button>}
          />
        </div>
        <Pagination page={page} pageCount={pageCount} onChange={changePage} className="mt-8" />
        {!loading && results.length ? <p className="mt-6 text-center text-xs text-muted">Prices are per unit in INR, excluding shipping and taxes. Request a quote for custom quantities.</p> : null}
      </div>

      <Drawer open={drawer.open} onClose={drawer.onClose} title={`Filters · ${results.length} ${results.length === 1 ? 'result' : 'results'}`} side="right">
        {filterPanel('mfilter', { showHeader: false, onApply: drawer.onClose })}
      </Drawer>
    </div>
  );
}
