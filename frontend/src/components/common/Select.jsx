import { forwardRef } from 'react';
import { Field } from './Input';
import CustomSelect from './CustomSelect';

export { CustomSelect };

/**
 * Universal Select component.
 * When `custom={true}`, renders the custom search & animated dropdown panel.
 * When native, renders the accessible native select styled with the design system.
 *
 * options: ['A', 'B'] or [{ value, label }]
 */
const Select = forwardRef(function Select(
  {
    id,
    label,
    error,
    hint,
    required,
    options = [],
    placeholder,
    wrapperClassName = '',
    className = '',
    custom = false,
    searchable = true,
    value,
    onChange,
    disabled = false,
    ...rest
  },
  ref
) {
  if (custom) {
    return (
      <Field
        id={id}
        label={label}
        error={error}
        hint={hint}
        required={required}
        className={wrapperClassName}
      >
        <CustomSelect
          id={id}
          value={value}
          onChange={onChange}
          options={options}
          placeholder={placeholder}
          searchable={searchable}
          disabled={disabled}
          className={className}
          {...rest}
        />
      </Field>
    );
  }

  return (
    <Field
      id={id}
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={wrapperClassName}
    >
      <select
        ref={ref}
        id={id}
        required={required}
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-required={required || undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={
          error ? `${id}-error` : hint ? `${id}-hint` : undefined
        }
        className={`ts-input ${className}`}
        {...rest}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => {
          const optValue = typeof option === 'object' ? option.value : option;
          const text = typeof option === 'object' ? option.label : option;
          return (
            <option key={optValue} value={optValue}>
              {text}
            </option>
          );
        })}
      </select>
    </Field>
  );
});

export default Select;
