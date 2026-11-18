import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** 'YYYY-MM-DD' <-> local date (no time zone shifts). */
const parse = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Field display: DD/MM/YYYY. */
export const formatPickerDate = (s) => { const d = parse(s); return d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : ''; };
/** Spoken label for a day button, e.g. 12 Nov 2026. */
const longDate = (s) => { const d = parse(s); return d ? `${d.getDate()} ${SHORT[d.getMonth()]} ${d.getFullYear()}` : ''; };

/**
 * Custom date picker matching the TradeExpress dropdowns: shows DD/MM/YYYY, opens a calendar with month
 * navigation, Today and Clear. Value is 'YYYY-MM-DD' ('' when empty). Optional min / max ('YYYY-MM-DD').
 * placement: 'top' opens the calendar above the field, 'bottom' below it.
 */
export default function DatePicker({ id, value = '', onChange, min, max, placeholder = 'DD/MM/YYYY', placement = 'bottom', className = '', 'aria-label': ariaLabel }) {
  const [open, setOpen] = useState(false);
  const selected = parse(value);
  const minD = parse(min);
  const maxD = parse(max);
  const [view, setView] = useState(() => selected || new Date());
  const rootRef = useRef(null);
  const gridId = useId();

  useEffect(() => { if (open) setView(parse(value) || new Date()); }, [open, value]);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', esc); };
  }, [open]);

  const days = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // Monday first
    const count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1))];
  }, [view]);

  const disabled = (d) => (minD && d < minD) || (maxD && d > maxD);
  const todayIso = iso(new Date());
  const pick = (d) => { if (!disabled(d)) { onChange(iso(d)); setOpen(false); } };
  const moveMonth = (n) => setView((v) => new Date(v.getFullYear(), v.getMonth() + n, 1));

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={`group flex h-[2.625rem] w-full items-center gap-2.5 rounded-xl border bg-white pl-3.5 pr-9 text-left text-sm shadow-2xs transition-all ${
          open ? 'border-emerald-600 ring-4 ring-emerald-500/10' : 'border-slate-200/90 hover:border-slate-300'
        }`}
      >
        <CalendarDays className="size-4 shrink-0 text-emerald-700" aria-hidden="true" />
        <span className={`truncate ${value ? 'font-semibold text-navy-950' : 'text-slate-400'}`}>{value ? formatPickerDate(value) : placeholder}</span>
      </button>
      {value ? (
        <button type="button" onClick={() => onChange('')} aria-label="Clear date"
          className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}

      {open ? (
        <div role="dialog" aria-label="Choose a date"
          className={`ts-dropdown-anim absolute left-0 z-50 w-[17.5rem] ${placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} rounded-2xl border border-slate-200/90 bg-white p-3 shadow-[0_20px_50px_-12px_rgba(11,39,22,0.18),0_0_0_1px_rgba(0,0,0,0.04)]`}>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month" className="inline-flex size-8 items-center justify-center rounded-lg text-navy-800 hover:bg-emerald-50"><ChevronLeft className="size-4" /></button>
            <p className="text-sm font-bold text-navy-950" aria-live="polite">{MONTHS[view.getMonth()]} {view.getFullYear()}</p>
            <button type="button" onClick={() => moveMonth(1)} aria-label="Next month" className="inline-flex size-8 items-center justify-center rounded-lg text-navy-800 hover:bg-emerald-50"><ChevronRight className="size-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center" role="grid" aria-labelledby={gridId}>
            {WEEK.map((w) => <span key={w} className="py-1 text-[11px] font-semibold uppercase text-slate-400">{w}</span>)}
            {days.map((d, i) => {
              if (!d) return <span key={`blank-${i}`} />;
              const key = iso(d);
              const isSel = key === value;
              const isToday = key === todayIso;
              const off = disabled(d);
              return (
                <button key={key} type="button" disabled={off} onClick={() => pick(d)} aria-pressed={isSel} aria-label={longDate(key)}
                  className={`inline-flex h-8 items-center justify-center rounded-lg text-[13px] transition-colors ${
                    isSel ? 'bg-emerald-700 font-bold text-white shadow-sm'
                      : off ? 'cursor-not-allowed text-slate-300'
                        : isToday ? 'font-bold text-emerald-700 ring-1 ring-emerald-600/40 hover:bg-emerald-50'
                          : 'text-navy-900 hover:bg-emerald-50'
                  }`}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
            <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100">Clear</button>
            <button type="button" disabled={disabled(parse(todayIso))} onClick={() => pick(parse(todayIso))} className="rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:text-slate-300">Today</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
