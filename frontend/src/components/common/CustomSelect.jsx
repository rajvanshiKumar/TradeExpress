import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

/**
 * Ultra-premium TradeExpress Custom Dropdown.
 * Features:
 * - Search filter for long option lists
 * - Full WAI-ARIA keyboard accessibility (ArrowUp/Down, Enter, Esc, Home, End)
 * - TradeExpress Emerald Green & Champagne Gold branding
 * - Auto-scroll active item into view
 * - Outside click & Escape dismissal
 * - High z-index stacking for modals and scrollable containers
 * - Drop-in synthetic event format: { target: { value, name } }
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
  required = false,
  'aria-describedby': ariaDescribedBy,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listboxRef = useRef(null);
  const selectId = useId();

  // Normalize options into uniform { value, label, description, badge }
  const normalizedOptions = useMemo(() => {
    return (options || []).map((opt) => {
      if (typeof opt === 'object' && opt !== null) {
        return {
          value: opt.value !== undefined ? opt.value : '',
          label: opt.label !== undefined ? String(opt.label) : String(opt.value ?? ''),
          description: opt.description,
          badge: opt.badge || opt.taxpayerType,
        };
      }
      return { value: opt, label: String(opt) };
    });
  }, [options]);

  const safeVal = typeof value === 'object' && value !== null
    ? (value.value ?? value.target?.value ?? '')
    : (value ?? '');

  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => String(opt.value) === String(safeVal));
  }, [normalizedOptions, safeVal]);

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return normalizedOptions;
    const lower = query.toLowerCase();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(lower) ||
        (opt.description && opt.description.toLowerCase().includes(lower))
    );
  }, [normalizedOptions, query]);

  const showSearch = searchable && normalizedOptions.length > 6;

  // Sync highlighted index when filtered options change
  useEffect(() => {
    const selectedIdx = filteredOptions.findIndex(
      (opt) => String(opt.value) === String(safeVal)
    );
    setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
  }, [filteredOptions, safeVal, open]);

  // Focus search input on open
  useEffect(() => {
    if (open && showSearch) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 40);
    } else {
      setQuery('');
    }
  }, [open, showSearch]);

  // Click outside and Esc key listener
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const onGlobalKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onGlobalKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onGlobalKey);
    };
  }, [open]);

  // Auto-scroll highlighted option into view
  useEffect(() => {
    if (open && listboxRef.current) {
      const activeElement = listboxRef.current.children[highlightedIndex];
      if (activeElement && typeof activeElement.scrollIntoView === 'function') {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, open]);

  const handleSelect = (val) => {
    if (onChange) {
      onChange({ target: { value: val, name: name || id } });
    }
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : Math.max(0, filteredOptions.length - 1)
        );
        break;
      case 'Home':
        e.preventDefault();
        setHighlightedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setHighlightedIndex(Math.max(0, filteredOptions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex].value);
        }
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={rootRef}
      className="relative w-full text-left"
      onKeyDown={handleKeyDown}
    >
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
        aria-required={required || undefined}
        aria-describedby={ariaDescribedBy}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={`group flex w-full items-center justify-between rounded-xl border bg-white font-semibold transition-all shadow-2xs ${
          compact ? 'px-2.5 py-1.5 text-xs min-h-[2.25rem]' : 'px-3.5 py-2.5 text-xs sm:text-sm min-h-[2.625rem]'
        } ${
          open
            ? 'border-emerald-600 ring-4 ring-emerald-500/10'
            : 'border-slate-200/90 hover:border-slate-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer'} ${className}`}
      >
        <span className={`truncate text-left ${selectedOption ? 'text-navy-950 font-bold' : 'text-slate-400 font-normal'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        {compact ? (
          <ChevronDown
            className={`size-3 shrink-0 ml-1.5 transition-transform duration-200 ${
              open ? 'rotate-180 text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'
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
          className={`ts-dropdown-anim absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/98 backdrop-blur-2xl shadow-[0_20px_50px_-12px_rgba(11,39,22,0.18),0_0_0_1px_rgba(0,0,0,0.08)] ${panelClassName}`}
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
                  placeholder="Type to search..."
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
          <div
            ref={listboxRef}
            className="max-h-56 overflow-y-auto p-1.5 space-y-0.5 ts-no-scrollbar"
          >
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">
                No matching options
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(safeVal);
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    key={String(opt.value) + '-' + idx}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`group flex w-full items-start justify-between rounded-xl px-3 py-2.5 text-left text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-300/70 shadow-2xs'
                        : isHighlighted
                        ? 'bg-slate-100/80 text-navy-950 font-semibold border border-slate-200/60'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`truncate ${isSelected ? 'text-emerald-950 font-bold' : 'text-slate-900 font-semibold'}`}>
                          {opt.label}
                        </span>
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
