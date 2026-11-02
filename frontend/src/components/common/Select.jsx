import { forwardRef } from 'react';
import { Field } from './Input';
import CustomSelect from './CustomSelect';

export { CustomSelect };

/**
 * Universal Select component.
 * By default renders the ultra-premium TradeExpress CustomSelect with search & keyboard navigation.
 * Set `native={true}` if explicit native browser select behavior is required.
 *
 * options: ['A', 'B'] or [{ value, label, description, badge }]
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
    custom = true,
    native = false,
    searchable = true,
    value,
    onChange,
    disabled = false,
    ...rest
  },
  ref
) {
  const shouldUseCustom = custom && !native;

  if (shouldUseCustom) {
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
          placeholder={placeholder || 'Select an option'}
          searchable={searchable}
          disabled={disabled}
          className={className}
          required={required}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
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
