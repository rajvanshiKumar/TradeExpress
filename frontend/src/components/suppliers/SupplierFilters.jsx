import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Boxes,
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  Factory,
  Globe,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { BUSINESS_TYPES, COUNTRY_FLAGS } from '../../utils/constants';
import { SUPPLIER_SORT_OPTIONS } from '../../services/supplierService';

/**
 * Custom Filter Dropdown Pill with Symbol, live search, checkmarks and animated panel
 */
function FilterDropdown({
  label,
  icon: Icon,
  symbol,
  value,
  placeholder,
  options = [],
  onChange,
  searchable = true,
  align = 'left',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open && searchable && options.length > 5) {
      setTimeout(() => inputRef.current?.focus(), 40);
    } else {
      setQuery('');
    }
  }, [open, searchable, options.length]);

  const normalizedOptions = options.map((opt) =>
    typeof opt === 'object' && opt !== null
      ? { value: opt.value, label: opt.label }
      : { value: opt, label: String(opt) }
  );

  const filtered = normalizedOptions.filter((opt) =>
    opt.label.toLowerCase().includes(query.toLowerCase())
  );

  const selectedOpt = normalizedOptions.find((opt) => opt.value === value);
  const isSelected = Boolean(value);

  return (
    <div className="relative shrink-0" ref={rootRef}>
      {/* Trigger Pill Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`group inline-flex items-center gap-2 rounded-xl border px-3 sm:px-3.5 py-2 text-xs font-bold transition-all shadow-2xs ${
          isSelected
            ? 'border-emerald-600 bg-emerald-50/90 text-emerald-950 ring-2 ring-emerald-500/20'
            : open
              ? 'border-slate-300 bg-slate-100 text-slate-900 ring-2 ring-slate-200'
              : 'border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        <span className="flex items-center gap-1.5 shrink-0">
          {symbol ? (
            <span className="text-sm select-none" aria-hidden="true">
              {symbol}
            </span>
          ) : Icon ? (
            <Icon
              className={`size-3.5 ${
                isSelected ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'
              }`}
            />
          ) : null}
          <span className="text-slate-400 font-semibold">{label}:</span>
        </span>

        <span className="truncate max-w-[130px] sm:max-w-[160px] text-slate-900 font-extrabold">
          {selectedOpt ? selectedOpt.label : placeholder}
        </span>

        <ChevronDown
          className={`size-3 text-slate-400 transition-transform duration-200 ml-0.5 shrink-0 group-hover:text-slate-700 ${
            open ? 'rotate-180 text-emerald-700' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Floating Custom Dropdown Panel */}
      {open && (
        <div
          role="listbox"
          className={`ts-dropdown-anim absolute top-[calc(100%+0.5rem)] z-50 w-64 sm:w-72 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/98 backdrop-blur-2xl shadow-[0_22px_54px_-12px_rgba(11,39,22,0.2),0_0_0_1px_rgba(0,0,0,0.05)] ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {/* Top Emerald Accent Glow */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-600/60 to-transparent"
            aria-hidden="true"
          />

          {/* Quick Search Header if long list */}
          {searchable && options.length > 5 && (
            <div className="border-b border-slate-100 bg-slate-50/70 p-2.5">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 size-3.5 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Filter ${label.toLowerCase()}...`}
                  className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5 ts-no-scrollbar">
            {/* All / Reset Option */}
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition-all ${
                !value
                  ? 'bg-emerald-50 text-emerald-950 border border-emerald-300/80 shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
              }`}
            >
              <span>{placeholder}</span>
              {!value && (
                <span className="flex size-4.5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xs shrink-0">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              )}
            </button>

            {/* Individual Options */}
            {filtered.map((opt) => {
              const optSelected = opt.value === value;
              const flag = COUNTRY_FLAGS[opt.value];
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={optSelected}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition-all ${
                    optSelected
                      ? 'bg-emerald-50 text-emerald-950 border border-emerald-300/80 shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    {flag && <span className="text-sm select-none shrink-0">{flag}</span>}
                    <span className="truncate">{opt.label}</span>
                  </span>

                  {optSelected && (
                    <span className="flex size-4.5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xs shrink-0">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Professional, modern Search, Filters and Sorting toolbar for the Supplier Directory.
 */
export default function SupplierFilters({
  filters,
  onChange,
  onClear,
  countries = [],
  industries = [],
  query,
  onQueryChange,
  hasActive,
}) {
  const activeCountryFlag = COUNTRY_FLAGS[filters.country];
  const activeSortLabel =
    SUPPLIER_SORT_OPTIONS.find((s) => s.value === filters.sort)?.label || 'Highest Rated';

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs space-y-4">
      {/* Top Search Input Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <label htmlFor="supplier-search" className="sr-only">
            Search suppliers
          </label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            id="supplier-search"
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={
              filters.scope === 'company'
                ? 'Search company names or locations (e.g. Apex Exports, Mumbai)...'
                : 'Search suppliers by product, industry or company (e.g. Cotton Fabrics, CNC)...'
            }
            className="w-full rounded-xl border border-slate-200/90 bg-slate-50/50 py-2.5 pl-10 pr-9 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-2xs"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Scope Pill Toggle */}
        <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold text-slate-600 shrink-0">
          <button
            type="button"
            onClick={() => onChange({ scope: '' })}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              !filters.scope
                ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                : 'hover:text-slate-900'
            }`}
          >
            All Details
          </button>
          <button
            type="button"
            onClick={() => onChange({ scope: 'company' })}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filters.scope === 'company'
                ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                : 'hover:text-slate-900'
            }`}
          >
            Company Names
          </button>
        </div>
      </div>

      {/* Filter Dropdowns Bar */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t border-slate-100">
        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
          <SlidersHorizontal className="size-3.5" />
          <span>Filters:</span>
        </span>

        {/* Country Filter Dropdown with Flags */}
        <FilterDropdown
          label="Country"
          icon={Globe}
          symbol={activeCountryFlag}
          value={filters.country}
          placeholder="All Countries"
          options={countries}
          onChange={(val) => onChange({ country: val })}
        />

        {/* Industry Filter Dropdown */}
        <FilterDropdown
          label="Industry"
          icon={Factory}
          value={filters.industry}
          placeholder="All Industries"
          options={industries}
          onChange={(val) => onChange({ industry: val })}
        />

        {/* Business Type Filter Dropdown */}
        <FilterDropdown
          label="Type"
          icon={Briefcase}
          value={filters.businessType}
          placeholder="All Types"
          options={BUSINESS_TYPES}
          onChange={(val) => onChange({ businessType: val })}
        />

        {/* Sort By Dropdown (Pushed to the right on wide screens) */}
        <div className="sm:ml-auto">
          <FilterDropdown
            label="Sort"
            icon={ArrowUpDown}
            value={filters.sort}
            placeholder="Sort by"
            options={SUPPLIER_SORT_OPTIONS}
            onChange={(val) => onChange({ sort: val })}
            align="right"
            searchable={false}
          />
        </div>
      </div>

      {/* Active Filter Chips Row */}
      {hasActive && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-semibold text-[11px]">Applied:</span>

          {filters.country && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/80 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-950 shadow-2xs">
              {activeCountryFlag && <span>{activeCountryFlag}</span>}
              <span>{filters.country}</span>
              <button
                type="button"
                onClick={() => onChange({ country: '' })}
                className="hover:text-rose-600 transition-colors ml-0.5"
                title="Remove country filter"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          {filters.industry && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/80 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-950 shadow-2xs">
              <Factory className="size-3 text-emerald-700" />
              <span>{filters.industry}</span>
              <button
                type="button"
                onClick={() => onChange({ industry: '' })}
                className="hover:text-rose-600 transition-colors ml-0.5"
                title="Remove industry filter"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          {filters.businessType && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/80 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-950 shadow-2xs">
              <Briefcase className="size-3 text-emerald-700" />
              <span>{filters.businessType}</span>
              <button
                type="button"
                onClick={() => onChange({ businessType: '' })}
                className="hover:text-rose-600 transition-colors ml-0.5"
                title="Remove business type filter"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          {query && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-800 shadow-2xs">
              <Search className="size-3 text-slate-500" />
              <span className="truncate max-w-[120px]">"{query}"</span>
              <button
                type="button"
                onClick={() => onQueryChange('')}
                className="hover:text-rose-600 transition-colors ml-0.5"
                title="Clear query"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline transition-colors ml-auto"
          >
            <RotateCcw className="size-3" />
            <span>Reset filters</span>
          </button>
        </div>
      )}
    </div>
  );
}
