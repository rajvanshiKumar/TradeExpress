import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import Button from '../components/common/Button';
import ErrorState from '../components/common/ErrorState';
import Pagination from '../components/common/Pagination';
import SupplierFilters from '../components/suppliers/SupplierFilters';
import SupplierGrid from '../components/suppliers/SupplierGrid';
import useProducts from '../hooks/useProducts';
import useDebounce from '../hooks/useDebounce';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { filterCompanies } from '../services/supplierService';

const PER_PAGE = 9;

export default function Suppliers() {
  const { companies, loading, error, reload } = useProducts();
  const [searchParams, setSearchParams] = useSearchParams();
  useDocumentTitle('Suppliers');

  const filters = useMemo(() => ({
    q: searchParams.get('q') ?? '', scope: searchParams.get('scope') ?? '', country: searchParams.get('country') ?? '', industry: searchParams.get('industry') ?? '',
    businessType: searchParams.get('type') ?? '', sort: searchParams.get('sort') ?? 'rating', page: Math.max(parseInt(searchParams.get('page'), 10) || 1, 1),
  }), [searchParams]);

  const write = (next) => {
    const params = new URLSearchParams();
    if (next.q) params.set('q', next.q);
    if (next.scope) params.set('scope', next.scope);
    if (next.country) params.set('country', next.country);
    if (next.industry) params.set('industry', next.industry);
    if (next.businessType) params.set('type', next.businessType);
    if (next.sort && next.sort !== 'rating') params.set('sort', next.sort);
    if (next.page > 1) params.set('page', String(next.page));
    setSearchParams(params);
  };
  const update = (patch) => write({ ...filters, ...patch, page: patch.page ?? 1 });

  // The search box updates the URL shortly after typing stops.
  const [query, setQuery] = useState(filters.q);
  const debounced = useDebounce(query, 300);
  useEffect(() => setQuery(filters.q), [filters.q]);
  useEffect(() => {
    if (debounced.trim() !== filters.q) update({ q: debounced.trim() });
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => filterCompanies(companies, filters), [companies, filters]);
  const active = companies.filter((company) => company.status !== 'Suspended');
  const countries = useMemo(() => [...new Set(active.map((company) => company.country))].filter(Boolean).sort(), [companies]); // eslint-disable-line react-hooks/exhaustive-deps
  const industries = useMemo(() => [...new Set(active.map((company) => company.industry))].filter(Boolean).sort(), [companies]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasActive = Boolean(filters.q || filters.country || filters.industry || filters.businessType || filters.scope);
  const clear = () => { setQuery(''); write({ sort: filters.sort, page: 1 }); };

  const pageCount = Math.max(Math.ceil(results.length / PER_PAGE), 1);
  const page = Math.min(filters.page, pageCount);
  const visible = results.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <>
      <PageHeader breadcrumbs={[{ label: 'Suppliers' }]} title="Supplier Directory" description="Manufacturers, exporters and trading companies. Profiles are self-described and not independently verified." />
      <div className="ts-container space-y-5 py-6 sm:py-8">
        <SupplierFilters filters={filters} onChange={update} onClear={clear} countries={countries} industries={industries} query={query} onQueryChange={setQuery} hasActive={hasActive} />
        {error ? <div className="ts-card"><ErrorState text={error} onRetry={reload} /></div> : (
          <>
            <p className="text-sm text-muted" role="status" aria-live="polite">
              {loading ? 'Loading suppliers…' : <><span className="font-bold text-ink">{results.length}</span> {results.length === 1 ? 'supplier' : 'suppliers'} found</>}
            </p>
            <SupplierGrid companies={visible} loading={loading} emptyAction={hasActive ? <Button variant="navy" onClick={clear}>Clear all filters</Button> : null} />
            <Pagination page={page} pageCount={pageCount} onChange={(next) => { update({ page: next }); window.scrollTo({ top: 0 }); }} />
          </>
        )}
      </div>
    </>
  );
}
