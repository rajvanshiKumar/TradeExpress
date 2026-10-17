import { useEffect, useState } from 'react';
import Button from '../common/Button';
import { Checkbox } from '../common/Input';
import { BUSINESS_TYPES } from '../../utils/constants';

function Group({ title, children }) {
  return (
    <fieldset className="border-b py-4 last:border-b-0">
      <legend className="mb-2.5 font-display text-sm font-bold text-navy-900">{title}</legend>
      {children}
    </fieldset>
  );
}

const MOQ_OPTIONS = [
  { value: '', label: 'Any minimum order' },
  { value: '50', label: 'Up to 50 units' },
  { value: '200', label: 'Up to 200 units' },
  { value: '1000', label: 'Up to 1,000 units' },
];

/**
 * Catalogue filters. Used in the desktop sidebar and inside the mobile drawer.
 * `filters` comes from the URL; `onChange(patch)` writes it back.
 */
export default function ProductFilters({ filters, onChange, categories, countries, idPrefix = 'filter', hideCategory = false }) {
  const [minPrice, setMinPrice] = useState(filters.minPrice);
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice);
  const [priceError, setPriceError] = useState('');

  useEffect(() => {
    setMinPrice(filters.minPrice);
    setMaxPrice(filters.maxPrice);
  }, [filters.minPrice, filters.maxPrice]);

  const applyPrice = (event) => {
    event.preventDefault();
    if (minPrice !== '' && maxPrice !== '' && Number(minPrice) > Number(maxPrice)) {
      setPriceError('Minimum price cannot be higher than maximum price.');
      return;
    }
    if (Number(minPrice) < 0 || Number(maxPrice) < 0) {
      setPriceError('Prices cannot be negative.');
      return;
    }
    setPriceError('');
    onChange({ minPrice, maxPrice });
  };

  const toggleIn = (key, value) => {
    const current = filters[key];
    onChange({ [key]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value] });
  };

  const activeCategory = categories.find((category) => category.slug === filters.category);
  const radio = 'flex cursor-pointer items-center gap-2.5 py-1 text-sm';

  return (
    <div>
      {!hideCategory ? (
        <Group title="Category">
          <label htmlFor={`${idPrefix}-category`} className="sr-only">Category</label>
          <select id={`${idPrefix}-category`} className="ts-input" value={filters.category} onChange={(event) => onChange({ category: event.target.value, subcategory: '' })}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
          </select>
          {activeCategory?.subcategories.length ? (
            <>
              <label htmlFor={`${idPrefix}-sub`} className="sr-only">Subcategory</label>
              <select id={`${idPrefix}-sub`} className="ts-input mt-2" value={filters.subcategory} onChange={(event) => onChange({ subcategory: event.target.value })}>
                <option value="">All {activeCategory.name}</option>
                {activeCategory.subcategories.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
              </select>
            </>
          ) : null}
        </Group>
      ) : activeCategory?.subcategories.length ? (
        <Group title="Subcategory">
          <label htmlFor={`${idPrefix}-sub`} className="sr-only">Subcategory</label>
          <select id={`${idPrefix}-sub`} className="ts-input" value={filters.subcategory} onChange={(event) => onChange({ subcategory: event.target.value })}>
            <option value="">All {activeCategory.name}</option>
            {activeCategory.subcategories.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
          </select>
        </Group>
      ) : null}

      <Group title="Unit price (₹ INR)">
        <form onSubmit={applyPrice} noValidate>
          <div className="flex items-center gap-2">
            <label htmlFor={`${idPrefix}-min`} className="sr-only">Minimum price in rupees</label>
            <input id={`${idPrefix}-min`} type="number" min="0" step="0.01" inputMode="decimal" placeholder="Min" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} className="ts-input" aria-invalid={priceError ? 'true' : undefined} />
            <span className="text-muted" aria-hidden="true">–</span>
            <label htmlFor={`${idPrefix}-max`} className="sr-only">Maximum price in rupees</label>
            <input id={`${idPrefix}-max`} type="number" min="0" step="0.01" inputMode="decimal" placeholder="Max" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} className="ts-input" aria-invalid={priceError ? 'true' : undefined} />
          </div>
          {priceError ? <p role="alert" className="mt-1.5 text-[0.8125rem] font-medium text-danger">{priceError}</p> : null}
          <Button type="submit" variant="subtle" size="sm" full className="mt-2.5">Apply price</Button>
        </form>
      </Group>

      <Group title="Minimum order quantity">
        {MOQ_OPTIONS.map((option) => (
          <label key={option.value || 'any'} className={radio}>
            <input type="radio" name={`${idPrefix}-moq`} value={option.value} checked={filters.maxMoq === option.value} onChange={() => onChange({ maxMoq: option.value })} className="size-4 accent-brand-500" />
            {option.label}
          </label>
        ))}
      </Group>

      <Group title="Supplier country">
        <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
          {countries.map((country) => (
            <Checkbox key={country} id={`${idPrefix}-country-${country.replace(/\W+/g, '-')}`} label={country} checked={filters.countries.includes(country)} onChange={() => toggleIn('countries', country)} />
          ))}
        </div>
      </Group>

      <Group title="Business type">
        <div className="space-y-2">
          {BUSINESS_TYPES.map((type) => (
            <Checkbox key={type} id={`${idPrefix}-type-${type.replace(/\W+/g, '-')}`} label={type} checked={filters.businessTypes.includes(type)} onChange={() => toggleIn('businessTypes', type)} />
          ))}
        </div>
      </Group>

      <Group title="Condition">
        {[['', 'Any condition'], ['New', 'New'], ['Refurbished', 'Refurbished']].map(([value, label]) => (
          <label key={label} className={radio}>
            <input type="radio" name={`${idPrefix}-condition`} value={value} checked={filters.condition === value} onChange={() => onChange({ condition: value })} className="size-4 accent-brand-500" />
            {label}
          </label>
        ))}
      </Group>

      <Group title="Delivery & availability">
        <div className="space-y-2">
          <Checkbox id={`${idPrefix}-ready`} label="Ready to ship" description="Dispatches from stock in days" checked={filters.ready} onChange={(value) => onChange({ ready: value })} />
          <Checkbox id={`${idPrefix}-stock`} label="In stock" checked={filters.inStock} onChange={(value) => onChange({ inStock: value })} />
          <Checkbox id={`${idPrefix}-sample`} label="Sample available" checked={filters.sample} onChange={(value) => onChange({ sample: value })} />
          <Checkbox id={`${idPrefix}-deal`} label="Wholesale deals" checked={filters.deal} onChange={(value) => onChange({ deal: value })} />
        </div>
      </Group>
    </div>
  );
}
