import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote, Boxes, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Factory, Globe2, IndianRupee, PackageCheck, Search, SlidersHorizontal,
} from 'lucide-react';
import Button from '../common/Button';
import { BUSINESS_TYPES, COUNTRY_FLAGS } from '../../utils/constants';
import useCurrency, { currencySymbol } from '../../hooks/useCurrency';

const MOQ_OPTIONS = [
  { value: '', label: 'Any minimum order' },
  { value: '50', label: 'Up to 50 units' },
  { value: '200', label: 'Up to 200 units' },
  { value: '1000', label: 'Up to 1,000 units' },
];
const BUSINESS_PREVIEW = 8;
// Typed prices and quantities apply by themselves after this pause, so the list does not reload on every keystroke
const TYPING_PAUSE_MS = 500;
const COUNTRY_SEARCH_FROM = 7;
const SECTIONS = ['category', 'price', 'moq', 'country', 'business'];

const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

/** One accordion section. The body animates its height with a grid row, so nothing jumps while it opens. */
function Section({ id, title, icon: Icon, count = 0, open, onToggle, children }) {
  const bodyId = `${id}-body`;
  return (
    <section className="border-b border-line last:border-b-0">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex w-full items-center gap-2.5 px-4 py-3.5 text-left transition-colors hover:bg-navy-50/70"
        >
          <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${count ? 'bg-navy-900 text-white' : 'bg-navy-50 text-navy-800'}`}>
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <span className="flex-1 font-display text-sm font-bold text-navy-900">{title}</span>
          {count ? (
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[0.6875rem] font-bold text-navy-900">
              {count}
              <span className="sr-only"> selected</span>
            </span>
          ) : null}
          <ChevronDown className={`size-4 shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </h3>
      <div id={bodyId} className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden" inert={open ? undefined : ''}>
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** A selectable row: radio or checkbox, highlighted when chosen. */
function Option({ type, name, id, checked, onChange, label, description, trailing }) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${checked ? 'bg-brand-50 font-semibold text-navy-900' : 'text-ink hover:bg-navy-50/60'}`}
    >
      <input id={id} type={type} name={name} checked={checked} onChange={onChange} className={`ts-check mt-0.5 ${type === 'radio' ? 'ts-check-radio' : ''}`} />
      <span className="min-w-0 flex-1">
        <span className="block break-words">{label}</span>
        {description ? <span className="block text-[0.75rem] font-normal text-muted">{description}</span> : null}
      </span>
      {trailing !== undefined ? <span className="shrink-0 text-xs font-medium text-muted">{trailing}</span> : null}
    </label>
  );
}

/**
 * Catalogue filters, used as the desktop sidebar and inside the mobile drawer.
 * `filters` comes from the URL; `onChange(patch)` writes it back, so the product list updates as options are chosen.
 * Typed values (prices, a custom MOQ) are committed with their own buttons or with Apply.
 */
export default function ProductFilters({
  filters, onChange, categories, countries, idPrefix = 'filter', hideCategory = false,
  categoryCounts = {}, priceBounds = null, onReset, onApply, showHeader = true,
}) {
  // Prices are typed and shown in the buyer's display currency; the URL and the search keep the real INR amounts.
  // The INR amount searched is rounded down at the lower end and up at the upper end, so no product at the edge is left out.
  const { convert } = useCurrency();
  const conversion = convert(1, 'INR');
  const priceCode = conversion.code;
  const rate = conversion.converted ? conversion.value : 1;
  const priceSymbol = currencySymbol(priceCode);
  const toShown = (inr) => (inr === '' ? '' : String(Math.round(Number(inr) * rate)));
  const toInr = (shown, round = Math.round) => (shown === '' ? '' : String(round(Number(shown) / rate)));
  const grouped = (value) => (value === '' ? '' : Number(value).toLocaleString(priceCode === 'INR' ? 'en-IN' : 'en'));
  const shownMin = toShown(filters.minPrice);
  const shownMax = toShown(filters.maxPrice);

  const [minPrice, setMinPrice] = useState(shownMin);
  const [maxPrice, setMaxPrice] = useState(shownMax);
  const [priceError, setPriceError] = useState('');
  const presetMoq = MOQ_OPTIONS.some((option) => option.value === filters.maxMoq);
  const [customMoq, setCustomMoq] = useState(presetMoq ? '' : filters.maxMoq);
  const [moqMode, setMoqMode] = useState(presetMoq ? 'preset' : 'custom');
  const [countryQuery, setCountryQuery] = useState('');
  const [allBusinessTypes, setAllBusinessTypes] = useState(false);

  useEffect(() => {
    setMinPrice(shownMin);
    setMaxPrice(shownMax);
  }, [shownMin, shownMax]);
  useEffect(() => {
    const preset = MOQ_OPTIONS.some((option) => option.value === filters.maxMoq);
    setMoqMode(preset ? 'preset' : 'custom');
    if (!preset) setCustomMoq(filters.maxMoq);
  }, [filters.maxMoq]);

  const activeCategory = categories.find((category) => category.slug === filters.category);
  const counts = {
    category: (filters.category && !hideCategory ? 1 : 0) + (filters.subcategory ? 1 : 0),
    price: filters.minPrice !== '' || filters.maxPrice !== '' ? 1 : 0,
    moq: filters.maxMoq ? 1 : 0,
    country: filters.countries.length,
    business: filters.businessTypes.length,
  };
  const activeCount = Object.values(counts).reduce((sum, value) => sum + value, 0);

  // Every section starts closed; the header chevron opens them all, or a section's own row opens just that one.
  // A section with a selection still shows its count while closed.
  const [open, setOpen] = useState(() => Object.fromEntries(SECTIONS.map((key) => [key, false])));
  const allOpen = SECTIONS.every((key) => open[key]);
  const allClosed = SECTIONS.every((key) => !open[key]);
  const toggle = (key) => setOpen((previous) => ({ ...previous, [key]: !previous[key] }));
  const setAll = (value) => setOpen(Object.fromEntries(SECTIONS.map((key) => [key, value])));

  /** Commits typed prices. Returns false when they are not valid. */
  const commitPrice = () => {
    if (minPrice !== '' && maxPrice !== '' && Number(minPrice) > Number(maxPrice)) {
      setPriceError('Minimum price cannot be higher than maximum price.');
      return false;
    }
    if (Number(minPrice) < 0 || Number(maxPrice) < 0) {
      setPriceError('Prices cannot be negative.');
      return false;
    }
    setPriceError('');
    if (minPrice !== shownMin || maxPrice !== shownMax) onChange({ minPrice: toInr(minPrice, Math.floor), maxPrice: toInr(maxPrice, Math.ceil) });
    return true;
  };
  const commitCustomMoq = () => {
    if (moqMode !== 'custom') return;
    const value = String(customMoq || '').replace(/\D/g, '');
    if (value && value !== filters.maxMoq) onChange({ maxMoq: value });
  };
  const applyAll = () => {
    if (!commitPrice()) return;
    commitCustomMoq();
    onApply?.();
  };

  // Apply as you type: after a short pause, typed prices and a custom quantity apply without pressing anything
  const latest = useRef({ commitPrice, commitCustomMoq });
  latest.current = { commitPrice, commitCustomMoq };
  useEffect(() => {
    if (minPrice === shownMin && maxPrice === shownMax) return undefined;
    const timer = window.setTimeout(() => latest.current.commitPrice(), TYPING_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [minPrice, maxPrice, shownMin, shownMax]);
  useEffect(() => {
    if (moqMode !== 'custom') return undefined;
    const timer = window.setTimeout(() => latest.current.commitCustomMoq(), TYPING_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [customMoq, moqMode]);

  const toggleIn = (key, value) => {
    const current = filters[key];
    onChange({ [key]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value] });
  };

  // Slider position: a typed value outside the catalogue's range is kept as typed, and only clamped for the slider
  const bounds = priceBounds && priceBounds.max > priceBounds.min
    ? { min: Math.floor(priceBounds.min * rate), max: Math.ceil(priceBounds.max * rate) }
    : null;
  const sliderStep = bounds ? Math.max(1, Math.round((bounds.max - bounds.min) / 200)) : 1;
  const clampToBounds = (value, fallback) => (value === '' || !bounds ? fallback : Math.min(Math.max(Number(value), bounds.min), bounds.max));
  const lowValue = bounds ? clampToBounds(minPrice, bounds.min) : 0;
  const highValue = bounds ? clampToBounds(maxPrice, bounds.max) : 0;
  const percent = (value) => (bounds ? ((value - bounds.min) / (bounds.max - bounds.min)) * 100 : 0);

  const shownCountries = useMemo(() => {
    const term = countryQuery.trim().toLowerCase();
    return term ? countries.filter((country) => country.toLowerCase().includes(term)) : countries;
  }, [countries, countryQuery]);
  // Selected business types stay visible even when the list is shortened
  const shownBusinessTypes = allBusinessTypes
    ? BUSINESS_TYPES
    : [...new Set([...BUSINESS_TYPES.slice(0, BUSINESS_PREVIEW), ...filters.businessTypes.filter((type) => BUSINESS_TYPES.includes(type))])];

  const subcategoryOptions = activeCategory?.subcategories?.length ? (
    <div className={hideCategory ? '' : 'mt-2 border-t border-line pt-2'}>
      {!hideCategory ? <p className="px-2.5 pb-1 text-[0.6875rem] font-bold uppercase tracking-wider text-muted">{activeCategory.name}</p> : null}
      <div role="radiogroup" aria-label="Subcategory">
        <Option type="radio" name={`${idPrefix}-sub`} id={`${idPrefix}-sub-all`} checked={!filters.subcategory} onChange={() => onChange({ subcategory: '' })} label={`All ${activeCategory.name}`} />
        {activeCategory.subcategories.map((sub) => (
          <Option key={sub} type="radio" name={`${idPrefix}-sub`} id={`${idPrefix}-sub-${sub.replace(/\W+/g, '-')}`} checked={filters.subcategory === sub} onChange={() => onChange({ subcategory: sub })} label={sub} />
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {showHeader ? (
        <div className="flex items-center gap-2.5 bg-navy-900 px-4 py-3.5 text-white">
          <SlidersHorizontal className="size-4.5 shrink-0" aria-hidden="true" />
          <h2 className="flex-1 font-display text-base font-bold !text-white">Filters</h2>
          {activeCount ? (
            <span className="rounded-full bg-brand-500 px-2 py-0.5 text-xs font-bold text-navy-950" aria-label={`${activeCount} active filters`}>{activeCount}</span>
          ) : null}
          <button
            type="button"
            onClick={() => setAll(allClosed)}
            className="flex size-7.5 shrink-0 items-center justify-center rounded-xl border-2 border-emerald-800 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            aria-label={allClosed ? 'Expand all filter sections' : 'Collapse all filter sections'}
            title={allClosed ? 'Expand all filter sections' : 'Collapse all filter sections'}
          >
            {allClosed ? (
              <ChevronRight className="size-4 text-slate-500" aria-hidden="true" />
            ) : (
              <ChevronLeft className="size-4 text-slate-500" aria-hidden="true" />
            )}
          </button>
        </div>
      ) : null}

      <div className="ts-slim-scrollbar min-h-0 flex-1 overflow-y-auto">
        {!hideCategory ? (
          <Section id={`${idPrefix}-category`} title="Categories" icon={Boxes} count={counts.category} open={open.category} onToggle={() => toggle('category')}>
            <div role="radiogroup" aria-label="Category" className="ts-slim-scrollbar max-h-72 overflow-y-auto pr-1">
              <Option type="radio" name={`${idPrefix}-category`} id={`${idPrefix}-category-all`} checked={!filters.category} onChange={() => onChange({ category: '', subcategory: '' })} label="All categories" />
              {categories.map((category) => (
                <Option
                  key={category.slug}
                  type="radio"
                  name={`${idPrefix}-category`}
                  id={`${idPrefix}-category-${category.slug.replace(/\W+/g, '-')}`}
                  checked={filters.category === category.slug}
                  onChange={() => onChange({ category: category.slug, subcategory: '' })}
                  label={category.name}
                  trailing={categoryCounts[category.slug]}
                />
              ))}
            </div>
            {subcategoryOptions}
          </Section>
        ) : subcategoryOptions ? (
          <Section id={`${idPrefix}-category`} title="Subcategory" icon={Boxes} count={counts.category} open={open.category} onToggle={() => toggle('category')}>
            {subcategoryOptions}
          </Section>
        ) : null}

        <Section id={`${idPrefix}-price`} title={`Price range (${priceSymbol === priceCode ? priceCode : `${priceSymbol} ${priceCode}`})`} icon={priceCode === 'INR' ? IndianRupee : Banknote} count={counts.price} open={open.price} onToggle={() => toggle('price')}>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              commitPrice();
            }}
          >
            {bounds ? (
              <div className="ts-range relative mx-1 mt-1 h-6">
                <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-navy-100" aria-hidden="true" />
                <div
                  className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-navy-800"
                  style={{ left: `${percent(lowValue)}%`, right: `${100 - percent(highValue)}%` }}
                  aria-hidden="true"
                />
                <input
                  type="range" min={bounds.min} max={bounds.max} step={sliderStep} value={lowValue}
                  onChange={(event) => setMinPrice(String(Math.min(Number(event.target.value), highValue)))}
                  onPointerUp={commitPrice} onKeyUp={commitPrice}
                  aria-label="Minimum price"
                />
                <input
                  type="range" min={bounds.min} max={bounds.max} step={sliderStep} value={highValue}
                  onChange={(event) => setMaxPrice(String(Math.max(Number(event.target.value), lowValue)))}
                  onPointerUp={commitPrice} onKeyUp={commitPrice}
                  aria-label="Maximum price"
                />
              </div>
            ) : null}
            <p className="mt-3 text-xs font-semibold text-muted">Type / Drag</p>
            <div className="mt-1.5 flex items-center gap-2">
              {[['min', minPrice, setMinPrice, `Minimum price in ${priceCode}`, bounds ? bounds.min : 'Min'], ['max', maxPrice, setMaxPrice, `Maximum price in ${priceCode}`, bounds ? bounds.max : 'Max']].map(([key, value, setValue, labelText, placeholder], index) => (
                <div key={key} className="contents">
                  {index === 1 ? <span className="shrink-0 text-muted" aria-hidden="true">—</span> : null}
                  <div className="relative min-w-0 flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-ink" aria-hidden="true">{priceSymbol}</span>
                    <label htmlFor={`${idPrefix}-${key}`} className="sr-only">{labelText}</label>
                    <input
                      id={`${idPrefix}-${key}`}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder={typeof placeholder === 'number' ? grouped(placeholder) : placeholder}
                      value={grouped(value)}
                      onChange={(event) => setValue(digitsOnly(event.target.value))}
                      onBlur={commitPrice}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitPrice();
                        }
                      }}
                      style={{ paddingLeft: `${1.25 + priceSymbol.length * 0.5}rem` }}
                      className="ts-input tabular-nums focus:!border-navy-800 focus:!ring-2 focus:!ring-brand-500/40"
                      aria-invalid={priceError ? 'true' : undefined}
                    />
                  </div>
                </div>
              ))}
            </div>
            {conversion.converted ? <p className="mt-1.5 text-[0.75rem] text-muted">Approximate, converted from INR at today’s rate.</p> : null}
            {priceError ? <p role="alert" className="mt-1.5 text-[0.8125rem] font-medium text-danger">{priceError}</p> : null}
          </form>
        </Section>

        <Section id={`${idPrefix}-moq`} title="Minimum order quantity" icon={PackageCheck} count={counts.moq} open={open.moq} onToggle={() => toggle('moq')}>
          <div role="radiogroup" aria-label="Minimum order quantity">
            {MOQ_OPTIONS.map((option) => (
              <Option
                key={option.value || 'any'}
                type="radio"
                name={`${idPrefix}-moq`}
                id={`${idPrefix}-moq-${option.value || 'any'}`}
                checked={moqMode === 'preset' && filters.maxMoq === option.value}
                onChange={() => {
                  setMoqMode('preset');
                  onChange({ maxMoq: option.value });
                }}
                label={option.label}
              />
            ))}
            <Option type="radio" name={`${idPrefix}-moq`} id={`${idPrefix}-moq-custom`} checked={moqMode === 'custom'} onChange={() => setMoqMode('custom')} label="Custom quantity" />
          </div>
          {moqMode === 'custom' ? (
            <form
              noValidate
              className="mt-2 flex items-center gap-2 pl-2.5"
              onSubmit={(event) => {
                event.preventDefault();
                commitCustomMoq();
              }}
            >
              <label htmlFor={`${idPrefix}-moq-value`} className="sr-only">Maximum minimum order, in units</label>
              <input id={`${idPrefix}-moq-value`} type="number" min="1" step="1" inputMode="numeric" placeholder="Up to … units" value={customMoq} onChange={(event) => setCustomMoq(event.target.value)} className="ts-input" />
              <Button type="submit" variant="subtle" size="sm">Set</Button>
            </form>
          ) : null}
        </Section>

        <Section id={`${idPrefix}-country`} title="Supplier country" icon={Globe2} count={counts.country} open={open.country} onToggle={() => toggle('country')}>
          {countries.length >= COUNTRY_SEARCH_FROM ? (
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" aria-hidden="true" />
              <label htmlFor={`${idPrefix}-country-search`} className="sr-only">Search countries</label>
              <input id={`${idPrefix}-country-search`} type="search" placeholder="Search country" value={countryQuery} onChange={(event) => setCountryQuery(event.target.value)} className="ts-input !pl-8" />
            </div>
          ) : null}
          <div className="ts-slim-scrollbar max-h-56 overflow-y-auto pr-1">
            {shownCountries.map((country) => (
              <Option
                key={country}
                type="checkbox"
                id={`${idPrefix}-country-${country.replace(/\W+/g, '-')}`}
                checked={filters.countries.includes(country)}
                onChange={() => toggleIn('countries', country)}
                label={<>{COUNTRY_FLAGS[country] ? <span className="mr-1.5" aria-hidden="true">{COUNTRY_FLAGS[country]}</span> : null}{country}</>}
              />
            ))}
            {!shownCountries.length ? <p className="px-2.5 py-2 text-sm text-muted">No country matches “{countryQuery}”.</p> : null}
          </div>
        </Section>

        <Section id={`${idPrefix}-business`} title="Business type" icon={Factory} count={counts.business} open={open.business} onToggle={() => toggle('business')}>
          {shownBusinessTypes.map((type) => (
            <Option key={type} type="checkbox" id={`${idPrefix}-type-${type.replace(/\W+/g, '-')}`} checked={filters.businessTypes.includes(type)} onChange={() => toggleIn('businessTypes', type)} label={type} />
          ))}
          {BUSINESS_TYPES.length > BUSINESS_PREVIEW ? (
            <button type="button" onClick={() => setAllBusinessTypes((value) => !value)} className="mt-1 px-2.5 text-[0.8125rem] font-semibold text-brand-600 hover:text-brand-700" aria-expanded={allBusinessTypes}>
              {allBusinessTypes ? 'Show fewer' : `Show all ${BUSINESS_TYPES.length} types`}
            </button>
          ) : null}
        </Section>

      </div>

      <div className="flex gap-2.5 border-t border-line bg-white p-3.5">
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onReset} disabled={!activeCount}>Reset all</Button>
        <Button type="button" variant="navy" size="sm" className="flex-1" onClick={applyAll}>Apply</Button>
      </div>
    </div>
  );
}
