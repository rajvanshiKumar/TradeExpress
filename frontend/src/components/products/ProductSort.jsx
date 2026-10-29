import { LayoutGrid, List } from 'lucide-react';
import CustomSelect from '../common/CustomSelect';
import { SORT_OPTIONS } from '../../services/productService';

/** Sort select plus the grid / list view toggle. */
export default function ProductSort({ sort, onSortChange, view, onViewChange, id = 'product-sort' }) {
  const toggle = (value, Icon, label) => (
    <button
      type="button"
      onClick={() => onViewChange(value)}
      aria-pressed={view === value}
      aria-label={label}
      title={label}
      className={`inline-flex size-9 items-center justify-center transition-colors ${
        view === value ? 'bg-navy-900 text-white' : 'bg-white text-navy-900 hover:bg-slate-100'
      }`}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );

  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor={id} className="hidden text-xs font-semibold text-slate-500 sm:block">
        Sort by
      </label>
      <div className="min-w-[10rem] sm:min-w-[11.5rem]">
        <CustomSelect
          id={id}
          value={sort}
          onChange={(event) => onSortChange(event.target.value)}
          options={SORT_OPTIONS}
          compact
          searchable={false}
        />
      </div>
      {onViewChange ? (
        <div className="inline-flex overflow-hidden rounded-xl border border-slate-200" role="group" aria-label="Choose layout">
          {toggle('grid', LayoutGrid, 'Grid view')}
          {toggle('list', List, 'List view')}
        </div>
      ) : null}
    </div>
  );
}
