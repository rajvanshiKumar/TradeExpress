import { LayoutGrid, List } from 'lucide-react';
import { SORT_OPTIONS } from '../../services/productService';

/** Sort select plus the grid / list view toggle. */
export default function ProductSort({ sort, onSortChange, view, onViewChange, id = 'product-sort' }) {
  const toggle = (value, Icon, label) => (
    <button
      type="button" onClick={() => onViewChange(value)} aria-pressed={view === value} aria-label={label} title={label}
      className={`inline-flex size-10 items-center justify-center ${view === value ? 'bg-navy-900 text-white' : 'bg-white text-navy-900 hover:bg-navy-50'}`}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor={id} className="hidden text-sm text-muted sm:block">Sort by</label>
      <select id={id} value={sort} onChange={(event) => onSortChange(event.target.value)} className="ts-input !min-h-10 w-auto max-w-[9.5rem] !py-1.5 text-sm xs:max-w-none" aria-label="Sort products">
        {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {onViewChange ? (
        <div className="inline-flex overflow-hidden rounded-[0.625rem] border" role="group" aria-label="Choose layout">
          {toggle('grid', LayoutGrid, 'Grid view')}
          {toggle('list', List, 'List view')}
        </div>
      ) : null}
    </div>
  );
}
