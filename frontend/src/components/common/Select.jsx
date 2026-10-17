import { forwardRef } from 'react';
import { Field } from './Input';

/**
 * Native select styled to match the inputs.
 * options: ['A', 'B'] or [{ value, label }]
 */
const Select = forwardRef(function Select({ id, label, error, hint, required, options = [], placeholder, wrapperClassName = '', className = '', ...rest }, ref) {
  return (
    <Field id={id} label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
      <select
        ref={ref} id={id} required={required} aria-required={required || undefined} aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} className={`ts-input ${className}`} {...rest}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => {
          const value = typeof option === 'object' ? option.value : option;
          const text = typeof option === 'object' ? option.label : option;
          return <option key={value} value={value}>{text}</option>;
        })}
      </select>
    </Field>
  );
});

export default Select;
