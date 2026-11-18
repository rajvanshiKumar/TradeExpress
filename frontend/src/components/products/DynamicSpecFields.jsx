import Input, { Checkbox, Field, Textarea } from '../common/Input';
import Select from '../common/Select';
import { isVisible } from '../../utils/specValidation';

/**
 * Category-specific specification fields, generated from the schema returned by
 * GET /api/categories/:slug/attributes (no per-category forms).
 * Values are kept by stable attribute key; errors maps key -> message.
 */
export default function DynamicSpecFields({ schema, values, errors = {}, onChange, idPrefix = 'spec' }) {
  const fields = (schema?.attributes || []).filter((def) => isVisible(def, values));
  if (!fields.length) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map((def) => {
        const id = `${idPrefix}-${def.key}`;
        const label = def.unit ? `${def.label} (${def.unit})` : def.label;
        const value = values[def.key];
        const error = errors[def.key];
        const common = { id, label, required: def.required, error, hint: def.help };

        switch (def.type) {
          case 'textarea':
            return (
              <Textarea key={def.key} {...common} rows={3} wrapperClassName="sm:col-span-2" placeholder={def.placeholder}
                value={value ?? ''} onChange={(e) => onChange(def.key, e.target.value)} />
            );
          case 'number':
          case 'decimal':
            return (
              <Input key={def.key} {...common} type="number" inputMode={def.type === 'number' ? 'numeric' : 'decimal'}
                step={def.type === 'number' ? '1' : 'any'} min={def.min} max={def.max} placeholder={def.placeholder}
                value={value ?? ''} onChange={(e) => onChange(def.key, e.target.value)} />
            );
          case 'date':
            return <Input key={def.key} {...common} type="date" value={value ?? ''} onChange={(e) => onChange(def.key, e.target.value)} />;
          case 'select':
          case 'radio':
            return (
              <Select key={def.key} {...common} placeholder={`Choose ${def.label.toLowerCase()}`} options={def.options || []}
                value={value ?? ''} onChange={(e) => onChange(def.key, e.target.value)} />
            );
          case 'boolean':
            return (
              <Select key={def.key} {...common} placeholder="Choose Yes or No"
                options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]}
                value={value === true ? 'true' : value === false ? 'false' : (value ?? '')}
                onChange={(e) => onChange(def.key, e.target.value === '' ? '' : e.target.value === 'true')} />
            );
          case 'multiselect': {
            const selected = Array.isArray(value) ? value : [];
            return (
              <Field key={def.key} id={id} label={label} required={def.required} error={error} hint={def.help} className="sm:col-span-2">
                <div role="group" aria-label={label} aria-describedby={error ? `${id}-error` : def.help ? `${id}-hint` : undefined} className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
                  {(def.options || []).map((option) => (
                    <Checkbox key={option} id={`${id}-${option}`} label={option} checked={selected.includes(option)}
                      onChange={(checked) => onChange(def.key, checked ? [...selected, option] : selected.filter((o) => o !== option))} />
                  ))}
                </div>
              </Field>
            );
          }
          default:
            return (
              <Input key={def.key} {...common} placeholder={def.placeholder} maxLength={200}
                value={value ?? ''} onChange={(e) => onChange(def.key, e.target.value)} />
            );
        }
      })}
    </div>
  );
}
