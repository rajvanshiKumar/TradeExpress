/**
 * Client-side checks for dynamic product specifications. They mirror the server rules
 * (backend/src/data/categoryAttributes.js) for instant feedback; the server always re-validates.
 */
const isEmpty = (v) => v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);

export function isVisible(def, values) {
  if (!def.showIf) return true;
  const other = values[def.showIf.key];
  if (Array.isArray(def.showIf.in)) return def.showIf.in.includes(other);
  return other === def.showIf.equals;
}

/** Errors map (key -> message) for the visible fields of a schema. */
export function validateSpecValues(schema, values = {}) {
  const errors = {};
  for (const def of schema?.attributes || []) {
    if (!isVisible(def, values)) continue;
    const raw = values[def.key];
    if (isEmpty(raw)) { if (def.required) errors[def.key] = `${def.label} is required.`; continue; }
    if (def.type === 'number' || def.type === 'decimal') {
      const n = Number(raw);
      if (!Number.isFinite(n) || (def.type === 'number' && !Number.isInteger(n))) errors[def.key] = `${def.label} must be a ${def.type === 'number' ? 'whole ' : ''}number.`;
      else if (def.min !== undefined && n < def.min) errors[def.key] = `${def.label} must be at least ${def.min}${def.unit ? ` ${def.unit}` : ''}.`;
      else if (def.max !== undefined && n > def.max) errors[def.key] = `${def.label} must be at most ${def.max}${def.unit ? ` ${def.unit}` : ''}.`;
    } else if ((def.type === 'select' || def.type === 'radio') && def.options && !def.options.includes(raw)) {
      errors[def.key] = `Choose a valid option for ${def.label}.`;
    } else if (def.type === 'multiselect' && def.options) {
      const bad = (Array.isArray(raw) ? raw : [raw]).find((v) => !def.options.includes(v));
      if (bad) errors[def.key] = `${def.label} has an invalid option: ${bad}.`;
    }
  }
  return errors;
}

/** Only the values that belong to the schema's visible fields (what is sent to the server). */
export function pickSchemaValues(schema, values = {}) {
  const out = {};
  for (const def of schema?.attributes || []) {
    if (!isVisible(def, values)) continue;
    if (!isEmpty(values[def.key])) out[def.key] = values[def.key];
  }
  return out;
}

/** Labels of filled values that the schema does not define (they would be dropped on save). */
export function incompatibleValueKeys(schema, values = {}) {
  if (!schema) return [];
  const keys = new Set(schema.attributes.map((d) => d.key));
  return Object.keys(values).filter((k) => !keys.has(k) && !isEmpty(values[k]));
}
