import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

/** Stepper that keeps a quantity between `min` (usually the MOQ) and `max` (stock). */
export default function QuantityInput({ id, value, min = 1, max = Infinity, step = 1, onChange, label = 'Quantity', size = 'md' }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const clamp = (number) => Math.min(Math.max(Math.round(number) || min, min), Math.max(max, min));
  const commit = (number) => {
    const next = clamp(number);
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  const height = size === 'sm' ? 'h-9' : 'h-11';
  const button = `inline-flex ${height} w-10 shrink-0 items-center justify-center text-navy-900 hover:bg-navy-50 disabled:opacity-35`;

  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-[0.625rem] border bg-white" role="group" aria-label={label}>
      <button type="button" className={button} onClick={() => commit(value - step)} disabled={value <= min} aria-label="Decrease quantity">
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <input
        id={id} type="number" inputMode="numeric" min={min} max={Number.isFinite(max) ? max : undefined} step={step} value={draft} aria-label={label}
        onChange={(event) => setDraft(event.target.value)} onBlur={() => commit(Number(draft))}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit(Number(draft)); } }}
        className={`${height} w-20 border-x text-center text-sm font-semibold [appearance:textfield] focus:outline-none focus-visible:bg-navy-50 [&::-webkit-inner-spin-button]:appearance-none`}
      />
      <button type="button" className={button} onClick={() => commit(value + step)} disabled={value >= max} aria-label="Increase quantity">
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
