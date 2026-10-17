import { Check } from 'lucide-react';

export const CHECKOUT_STEPS = ['Contact', 'Address', 'Shipping', 'Payment', 'Review', 'Confirmation'];

/** Progress indicator for the six checkout steps. `current` is 1-based. */
export default function CheckoutSteps({ current, onStepClick }) {
  return (
    <nav aria-label="Checkout progress">
      <ol className="flex items-start">
        {CHECKOUT_STEPS.map((label, index) => {
          const step = index + 1;
          const done = step < current;
          const active = step === current;
          const clickable = done && onStepClick && current < CHECKOUT_STEPS.length;
          const dot = (
            <span className={`inline-flex size-8 items-center justify-center rounded-full text-sm font-bold ring-4 ring-surface sm:size-9 ${done ? 'bg-success text-navy-900' : active ? 'bg-brand-500 text-navy-900' : 'bg-white text-muted ring-1 ring-line'}`}>
              {done ? <Check className="size-4" aria-hidden="true" /> : step}
            </span>
          );
          return (
            <li key={label} className="relative flex flex-1 flex-col items-center text-center" aria-current={active ? 'step' : undefined}>
              {index ? <span className={`absolute right-1/2 top-4 -z-0 h-0.5 w-full sm:top-[1.125rem] ${step <= current ? 'bg-success' : 'bg-line'}`} aria-hidden="true" /> : null}
              <span className="relative z-10">
                {clickable ? <button type="button" onClick={() => onStepClick(step)} aria-label={`Go back to step ${step}: ${label}`} className="rounded-full">{dot}</button> : dot}
              </span>
              <span className={`mt-1.5 text-[0.6875rem] font-semibold sm:text-xs ${active ? 'text-navy-900' : 'text-muted'} ${active ? '' : 'max-sm:sr-only'}`}>
                <span className="sr-only">Step {step}: </span>{label}{done ? <span className="sr-only"> (completed)</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
