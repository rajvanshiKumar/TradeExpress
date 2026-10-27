import { forwardRef } from 'react';
import { CircleAlert } from 'lucide-react';

/** Label + hint + error wrapper shared by Input, Textarea and Select. */
export function Field({ id, label, error, hint, required, className = '', children }) {
  return (
    <div className={className}>
      {label ? (
        <label htmlFor={id} className="ts-label">
          {label}
          {required ? <span className="text-danger" aria-hidden="true"> *</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-start gap-1.5 text-[0.8125rem] font-medium text-danger">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[0.8125rem] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const describedBy = (id, error, hint) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

const Input = forwardRef(function Input({ id, label, error, hint, required, wrapperClassName = '', className = '', icon: Icon, type = 'text', ...rest }, ref) {
  return (
    <Field id={id} label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
      <div className="relative">
        {Icon ? <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" /> : null}
        <input
          ref={ref} id={id} type={type} required={required} aria-required={required || undefined}
          aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy(id, error, hint)}
          className={`ts-input ${Icon ? 'pl-9' : ''} ${className}`} {...rest}
        />
      </div>
    </Field>
  );
});

export default Input;

export const Textarea = forwardRef(function Textarea({ id, label, error, hint, required, wrapperClassName = '', className = '', rows = 4, ...rest }, ref) {
  return (
    <Field id={id} label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
      <textarea
        ref={ref} id={id} rows={rows} required={required} aria-required={required || undefined}
        aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy(id, error, hint)}
        className={`ts-input resize-y ${className}`} {...rest}
      />
    </Field>
  );
});

/** Accessible checkbox with its label. */
export function Checkbox({ id, label, checked, onChange, className = '', description }) {
  return (
    <label htmlFor={id} className={`flex cursor-pointer items-start gap-2.5 text-sm ${className}`}>
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 size-4 shrink-0 rounded border-navy-200 accent-brand-500" />
      <span>
        <span className="text-ink">{label}</span>
        {description ? <span className="block text-[0.8125rem] text-muted">{description}</span> : null}
      </span>
    </label>
  );
}
