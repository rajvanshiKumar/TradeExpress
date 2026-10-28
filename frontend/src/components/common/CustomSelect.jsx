import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

/**
 * Ultra-premium Custom Select Dropdown with search filter, keyboard accessibility,
 * checkmarks, smooth animations, and drop-in synthetic event support.
 *
 * @param {string} id - HTML ID
 * @param {string} value - Currently selected value
 * @param {Function} onChange - Handler receiving { target: { value, name } }
 * @param {Array<{ value: string|number, label: string }|string>} options
 * @param {string} placeholder - Displayed when nothing selected
 * @param {boolean} searchable - Show search input when options count is high
 * @param {boolean} disabled - Disable trigger
 * @param {string} className - Trigger styling
 * @param {string} panelClassName - Dropdown panel styling
 */
export default function CustomSelect({
  id,
  name,
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  searchable = true,
  disabled = false,
  compact = false,
  className = '',
  panelClassName = '',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const searchInputRef = useRef(null);
  const selectId = useId();

  // Normalize options into { value, label, description, badge } objects
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      return {
        value: opt.value,
        label: opt.label ?? String(opt.value),
        description: opt.description,
        badge: opt.badge || opt.taxpayerType,
      };
    }
    return { value: opt, label: String(opt) };
  });

  const safeVal = typeof value === 'object' && value !== null
    ? (value.value ?? value.target?.value ?? '')
    : (value ?? '');

  const selectedOption = normalizedOptions.find(
    (opt) => String(opt.value) === String(safeVal)
  );

  const filteredOptions = normalizedOptions.filter((opt) =>
    opt.label.toLowerCase().includes(query.toLowerCase()) ||
    (opt.description && opt.description.toLowerCase().includes(query.toLowerCase()))
  );

  // Focus search input when opened
  useEffect(() => {
    if (open && searchable && normalizedOptions.length > 6) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setQuery('');
    }
  }, [open, searchable, normalizedOptions.length]);

  // Click outside and Esc key listener
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleSelect = (val) => {
    if (onChange) {
      onChange({ target: { value: val, name: name || id } });
    }
    setOpen(false);
    triggerRef.current?.focus();
  };

  const showSearch = searchable && normalizedOptions.length > 7;

  return (
    <div ref={rootRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        name={name}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={selectId}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={`group flex w-full items-center justify-between rounded-xl border bg-white text-left font-semibold transition-all shadow-2xs ${
          compact ? 'px-2.5 py-2 text-xs' : 'px-3.5 py-2.5 text-xs sm:text-sm'
        } ${
          open
            ? 'border-emerald-600 ring-4 ring-emerald-500/10'
            : 'border-slate-200/90 hover:border-slate-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer'} ${className}`}
      >
        <span className={`truncate ${selectedOption ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        {compact ? (
          <ChevronDown
            className={`size-3 shrink-0 ml-1 transition-transform duration-200 ${
              open ? 'rotate-180 text-emerald-700' : 'text-slate-400'
            }`}
            aria-hidden="true"
          />
        ) : (
          <span className="ml-2 flex size-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-700 transition-all">
            <ChevronDown
              className={`size-3.5 transition-transform duration-200 ${
                open ? 'rotate-180 text-emerald-700' : ''
              }`}
              aria-hidden="true"
            />
          </span>
        )}
      </button>

      {/* Popover Custom Dropdown Panel */}
      {open && (
        <div
          id={selectId}
          role="listbox"
          tabIndex={-1}
          className={`ts-dropdown-anim absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/98 backdrop-blur-2xl shadow-[0_20px_50px_-12px_rgba(11,39,22,0.18),0_0_0_1px_rgba(0,0,0,0.05)] ${panelClassName}`}
        >
          {/* Top Emerald Glow Accent */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-600/50 to-transparent"
            aria-hidden="true"
          />

          {/* Search Box if list is long */}
          {showSearch && (
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-3 py-2">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 size-3.5 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type to filter..."
                  className="w-full rounded-lg bg-slate-100/80 py-1.5 pl-8 pr-7 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">
                No matching options
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    className={`group flex w-full items-start justify-between rounded-xl px-3 py-2.5 text-left text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-300/70 shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`truncate ${isSelected ? 'text-emerald-950 font-bold' : 'text-slate-900 font-semibold'}`}>{opt.label}</span>
                        {opt.badge && (
                          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-amber-50 text-amber-800 border border-amber-200/80">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.description && (
                        <span className="text-[11px] text-slate-500 font-normal line-clamp-2 mt-0.5 leading-snug">
                          {opt.description}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <span className="flex size-4.5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xs shrink-0 mt-0.5">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
