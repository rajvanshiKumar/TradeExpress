import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Search } from 'lucide-react';
import { SectionHeading } from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import { StatusBadge } from '../../components/common/Badge';
import CompanyLogo from '../../components/common/CompanyLogo';
import VerificationBadge from '../../components/common/VerificationBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import { TableSkeleton } from '../../components/common/Skeleton';
import useProducts from '../../hooks/useProducts';
import useNotifications from '../../hooks/useNotifications';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { BUSINESS_TYPES } from '../../utils/constants';

const SORTS = {
  name: { label: 'Name: A to Z', compare: (a, b) => a.name.localeCompare(b.name) },
  rating: { label: 'Rating: high to low', compare: (a, b) => b.rating - a.rating },
  products: { label: 'Most products', compare: (a, b) => b.productCount - a.productCount },
  established: { label: 'Oldest first', compare: (a, b) => a.established - b.established },
};

export default function AdminCompanies() {
  const { companies, products, loading, error, reload, updateCompany } = useProducts();
  const { showToast } = useNotifications();
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('name');
  const [confirming, setConfirming] = useState(null);
  useDocumentTitle('Admin: companies');

  const countries = useMemo(() => [...new Set(companies.map((company) => company.country))].filter(Boolean).sort(), [companies]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies
      .map((company) => ({ ...company, productCount: products.filter((product) => product.companyId === company.id).length }))
      .filter((company) => (!q || `${company.name} ${company.city} ${company.industry} ${company.id}`.toLowerCase().includes(q)) && (!country || company.country === country) && (!type || company.businessType === type) && (!status || company.status === status))
      .sort(SORTS[sort].compare);
  }, [companies, products, search, country, type, status, sort]);

  const hasFilters = Boolean(search || country || type || status);
  const clear = () => { setSearch(''); setCountry(''); setType(''); setStatus(''); };

  const setCompanyStatus = (company, next) => {
    updateCompany(company.id, { status: next });
    showToast(next === 'Suspended' ? `${company.name} suspended. Its profile and products are hidden.` : `${company.name} is active again.`, 'info');
    setConfirming(null);
  };

  return (
    <div>
      <SectionHeading title="Companies" description="Supplier companies. Suspending one hides its profile and products from the catalogue in this browser." />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <label htmlFor="ac-search" className="sr-only">Search companies</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input id="ac-search" type="search" className="ts-input pl-9" placeholder="Search by name, city or industry" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <select aria-label="Filter by country" className="ts-input" value={country} onChange={(event) => setCountry(event.target.value)}>
          <option value="">All countries</option>
          {countries.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select aria-label="Filter by business type" className="ts-input" value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">All business types</option>
          {BUSINESS_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select aria-label="Filter by status" className="ts-input" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Suspended">Suspended</option>
        </select>
        <select aria-label="Sort companies" className="ts-input" value={sort} onChange={(event) => setSort(event.target.value)}>
          {Object.entries(SORTS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
        </select>
      </div>

      <div className="ts-card overflow-hidden">
        {error ? <ErrorState text={error} onRetry={reload} /> : loading ? <TableSkeleton rows={8} /> : rows.length === 0 ? (
          <EmptyState icon={hasFilters ? Search : Building2} title="No matching companies" text="Try different filters." action={hasFilters ? <Button variant="outline" onClick={clear}>Clear filters</Button> : null} />
        ) : (
          <div className="overflow-x-auto">
            <table className="ts-table">
              <caption className="sr-only">Supplier companies</caption>
              <thead><tr><th scope="col">Company</th><th scope="col">Location</th><th scope="col">Type</th><th scope="col">Products</th><th scope="col">Rating</th><th scope="col">Verification</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {rows.map((company) => (
                  <tr key={company.id}>
                    <td>
                      <div className="flex min-w-60 items-center gap-3">
                        <CompanyLogo company={company} size="sm" />
                        <div className="min-w-0">
                          {company.status === 'Suspended' ? <span className="font-semibold text-ink">{company.name}</span> : <Link to={`/suppliers/${company.slug}`} className="font-semibold text-ink hover:text-brand-600">{company.name}</Link>}
                          <p className="text-xs text-muted">{company.id} · {company.industry}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap">{company.city ? `${company.city}, ` : ''}{company.country}</td>
                    <td className="whitespace-nowrap">{company.businessType}</td>
                    <td>{company.productCount}</td>
                    <td>{company.rating ? company.rating.toFixed(1) : '—'}</td>
                    <td className="whitespace-nowrap"><VerificationBadge company={company} /></td>
                    <td><StatusBadge status={company.status ?? 'Active'} /></td>
                    <td className="text-right">
                      {company.status === 'Suspended'
                        ? <Button variant="outline" size="sm" onClick={() => setCompanyStatus(company, 'Active')} aria-label={`Reactivate ${company.name}`}>Reactivate</Button>
                        : <Button variant="dangerOutline" size="sm" onClick={() => setConfirming(company)} aria-label={`Suspend ${company.name}`}>Suspend</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mt-4 text-sm text-muted" aria-live="polite">{rows.length} of {companies.length} companies</p>

      <ConfirmDialog
        open={Boolean(confirming)} onCancel={() => setConfirming(null)} onConfirm={() => setCompanyStatus(confirming, 'Suspended')} title="Suspend this company?" confirmLabel="Suspend company"
        text={confirming ? `${confirming.name} and its ${confirming.productCount} products will be hidden from the catalogue. You can reactivate it at any time.` : ''}
      />
    </div>
  );
}
