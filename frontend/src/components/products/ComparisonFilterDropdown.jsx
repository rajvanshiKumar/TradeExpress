import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

const SEARCH_THRESHOLD = 8;

/**
 * Compact filter dropdown used by the Product & Seller Comparison page.
 * Multi-select (checkboxes) by default; `multiple={false}` makes it a single-choice list (radios).
 * `closeOnSelect` applies the choice and closes the panel on each pick (always on for single choice);
 * with multi-select, further values are added by reopening the dropdown. Closes on outside click, Escape or when focus leaves it,
 * and supports Arrow/Home/End keys between options.
 *
 * @param {Array<{ value: string|number, label: string, count?: number, swatch?: string, icon?: Function }>} options
 * @param {Array<string|number>} selected - Selected option values ([] means "all")
 * @param {(next: Array<string|number>) => void} onChange
 * @param {string} panelClassName - Panel position classes (e.g. 'left-0', 'sm:right-0')
 */
export default function ComparisonFilterDropdown({
  label,
  icon: Icon,
  allLabel,
  options = [],
  selected = [],
  onChange,
  multiple = true,
  closeOnSelect = !multiple,
  emptyText = 'Not available',
  panelClassName = 'left-0',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);
  const baseId = useId();
  const panelId = `${baseId}-panel`;

  const disabled = options.length === 0;
  const showSearch = options.length > SEARCH_THRESHOLD;
  const selectedSet = useMemo(() => new Set(selected.map(String)), [selected]);

  const visibleOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((opt) => opt.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const selectedLabels = options.filter((opt) => selectedSet.has(String(opt.value))).map((opt) => opt.label);
  const summary = disabled
    ? emptyText
    : selectedLabels.length === 0
      ? allLabel
      : selectedLabels.length === 1
        ? selectedLabels[0]
        : `${selectedLabels[0]} +${selectedLabels.length - 1}`;
  const isActive = selectedLabels.length > 0;

  const close = (restoreFocus = false) => {
    setOpen(false);
    setQuery('');
    if (restoreFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) close();
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close(true);
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer, { passive: true });
    document.addEventListener('keydown', onKey);

    const focusTimer = window.setTimeout(() => {
      if (searchRef.current) {
        searchRef.current.focus({ preventScroll: true });
        return;
      }
      const inputs = listRef.current?.querySelectorAll('input') || [];
      const target = [...inputs].find((input) => input.checked) || inputs[0];
      target?.focus({ preventScroll: true });
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const moveFocus = (event) => {
    const inputs = [...(listRef.current?.querySelectorAll('input') || [])];
    if (!inputs.length) return;
    const current = inputs.indexOf(document.activeElement);
    let next = null;
    if (event.key === 'ArrowDown') next = current < 0 ? 0 : Math.min(current + 1, inputs.length - 1);
    else if (event.key === 'ArrowUp') next = current <= 0 ? (searchRef.current ? -1 : 0) : current - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = inputs.length - 1;
    if (next === null) return;
    event.preventDefault();
    if (next === -1) searchRef.current?.focus();
    else inputs[next].focus();
  };

  // Pressing on an option must not move focus out of the panel: the app's focusable <main> would take
  // focus, which reads as leaving the dropdown and closes it before the click selects anything.
  // The click itself still reaches the option's input; only the search box needs real mouse focus.
  const onPanelMouseDown = (event) => {
    if (event.target !== searchRef.current) event.preventDefault();
  };

  const onPanelKeyDown = (event) => {
    if (event.target === searchRef.current && (event.key === 'Home' || event.key === 'End')) return;
    moveFocus(event);
  };

  // Keyboard Tab out of the dropdown closes it; pointer clicks outside are handled by the mousedown listener.
  const onRootBlur = (event) => {
    if (open && event.relatedTarget && !rootRef.current?.contains(event.relatedTarget)) close();
  };

  const toggleValue = (value) => {
    const isSelected = selectedSet.has(String(value));
    if (!multiple) {
      onChange(isSelected ? [] : [value]);
    } else {
      onChange(isSelected ? selected.filter((v) => String(v) !== String(value)) : [...selected, value]);
    }
    if (closeOnSelect) close(true);
  };

  const selectAll = () => {
    onChange([]);
    if (closeOnSelect) close(true);
  };

  const inputType = multiple ? 'checkbox' : 'radio';
  const rowClass =
    'group/opt flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-slate-50 has-[:focus-visible]:bg-slate-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500/40';

  const renderMark = (checked) => (
    <span
      aria-hidden="true"
      className={`flex size-4 shrink-0 items-center justify-center border transition-colors ${
        multiple ? 'rounded' : 'rounded-full'
      } ${checked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white group-hover/opt:border-slate-400'}`}
    >
      {checked && (multiple ? <Check className="size-3 stroke-[3]" /> : <span className="size-1.5 rounded-full bg-white" />)}
    </span>
  );

  return (
    <div ref={rootRef} className="relative min-w-0" onBlur={onRootBlur}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-60 ${
          isActive
            ? 'border-emerald-500 bg-emerald-50/70 shadow-xs'
            : open
              ? 'border-slate-300 bg-white shadow-xs'
              : 'border-slate-200 bg-white hover:border-slate-300'
        } ${disabled ? '' : 'cursor-pointer'}`}
      >
        {Icon && <Icon aria-hidden="true" className={`size-4 shrink-0 ${isActive ? 'text-emerald-600' : 'text-navy-400'}`} />}
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-navy-500">{label}</span>
          <span className={`block truncate text-xs ${isActive ? 'font-bold text-emerald-950' : 'font-semibold text-navy-900'}`}>
            {summary}
          </span>
        </span>
        {isActive && multiple && (
          <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-black leading-none text-white">
            {selectedLabels.length}
            <span className="sr-only"> selected</span>
          </span>
        )}
        <ChevronDown
          aria-hidden="true"
          className={`size-4 shrink-0 text-navy-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={`${label} filter options`}
          onKeyDown={onPanelKeyDown}
          onMouseDown={onPanelMouseDown}
          className={`ts-dropdown-anim-left absolute top-full z-40 mt-2 w-full min-w-[16rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_22px_54px_-12px_rgba(11,39,22,0.18),0_0_0_1px_rgba(0,0,0,0.04)] ${panelClassName}`}
        >
          {showSearch && (
            <div className="border-b border-slate-100 p-2">
              <div className="relative">
                <Search aria-hidden="true" className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-navy-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={`Search ${label.toLowerCase()}...`}
                  aria-label={`Search ${label.toLowerCase()}`}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-7 text-xs font-medium text-navy-950 placeholder:text-navy-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      searchRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-navy-400 hover:text-navy-700"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div ref={listRef} className="max-h-64 overflow-y-auto overscroll-contain p-1.5">
            {!query && (
              <label className={rowClass}>
                <input
                  type={inputType}
                  name={multiple ? undefined : baseId}
                  className="sr-only"
                  checked={selected.length === 0}
                  onChange={selectAll}
                />
                {renderMark(selected.length === 0)}
                <span className={`flex-1 ${selected.length === 0 ? 'font-bold text-navy-950' : 'font-semibold text-navy-700'}`}>
                  {allLabel}
                </span>
              </label>
            )}

            {visibleOptions.map((opt) => {
              const checked = selectedSet.has(String(opt.value));
              const OptIcon = opt.icon;
              return (
                <label key={String(opt.value)} className={rowClass}>
                  <input
                    type={inputType}
                    name={multiple ? undefined : baseId}
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggleValue(opt.value)}
                  />
                  {renderMark(checked)}
                  {opt.swatch && (
                    <span
                      aria-hidden="true"
                      className="size-3.5 shrink-0 rounded-full border border-black/15 shadow-2xs"
                      style={{ backgroundColor: opt.swatch }}
                    />
                  )}
                  {OptIcon && <OptIcon aria-hidden="true" className={`size-3.5 shrink-0 ${checked ? 'text-emerald-600' : 'text-navy-400'}`} />}
                  <span className={`min-w-0 flex-1 break-words ${checked ? 'font-bold text-navy-950' : 'font-medium text-navy-800'}`}>
                    {opt.label}
                  </span>
                  {typeof opt.count === 'number' && (
                    <span className={`shrink-0 text-[10px] tabular-nums ${checked ? 'font-bold text-emerald-700' : 'text-slate-400'}`}>
                      {opt.count}
                      <span className="sr-only"> {opt.count === 1 ? 'seller' : 'sellers'}</span>
                    </span>
                  )}
                </label>
              );
            })}

            {visibleOptions.length === 0 && (
              <p className="px-2.5 py-3 text-center text-xs text-navy-500">
                No {label.toLowerCase()} matches &ldquo;{query}&rdquo;
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
