import { useId } from 'react';

/** Small hover/focus tooltip. Wraps one focusable child. */
export default function Tooltip({ text, children, side = 'top', className = '' }) {
  const id = useId();
  const position = side === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2';
  return (
    <span className={`group/tip relative inline-flex ${className}`} aria-describedby={id}>
      {children}
      <span
        id={id} role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-30 w-max max-w-56 -translate-x-1/2 rounded-md bg-navy-950 px-2.5 py-1.5 text-center text-xs font-medium text-white opacity-0 shadow-pop transition-opacity group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${position}`}
      >
        {text}
      </span>
    </span>
  );
}
