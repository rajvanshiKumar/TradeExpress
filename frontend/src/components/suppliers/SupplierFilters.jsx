import { Search, X } from 'lucide-react';
import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import { BUSINESS_TYPES } from '../../utils/constants';
import { SUPPLIER_SORT_OPTIONS } from '../../services/supplierService';

/** Search, filters and sorting for the supplier directory. */
export default function SupplierFilters({ filters, onChange, onClear, countries, industries, query, onQueryChange, hasActive }) {
  return (
    <div className="ts-card p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1.2fr]">
        <Input id="supplier-q" label={filters.scope === 'company' ? 'Search company names' : 'Search suppliers'} type="search" icon={Search} placeholder={filters.scope === 'company' ? 'Company name or city' : 'Name, product or industry'} value={query} onChange={(event) => onQueryChange(event.target.value)} wrapperClassName="sm:col-span-2 lg:col-span-1" />
        <Select id="supplier-country" label="Country" placeholder="All countries" options={countries} value={filters.country} onChange={(event) => onChange({ country: event.target.value })} />
        <Select id="supplier-industry" label="Industry" placeholder="All industries" options={industries} value={filters.industry} onChange={(event) => onChange({ industry: event.target.value })} />
        <Select id="supplier-type" label="Business type" placeholder="All types" options={BUSINESS_TYPES} value={filters.businessType} onChange={(event) => onChange({ businessType: event.target.value })} />
        <Select id="supplier-sort" label="Sort by" options={SUPPLIER_SORT_OPTIONS} value={filters.sort} onChange={(event) => onChange({ sort: event.target.value })} />
      </div>
      {hasActive ? <Button variant="ghost" size="sm" icon={X} onClick={onClear} className="mt-3">Clear all filters</Button> : null}
    </div>
  );
}
