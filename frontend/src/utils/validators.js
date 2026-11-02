import { COUNTRY_PHONE_RULES } from './constants.js';
import { evaluatePassword, validatePassword } from './passwordRules.js';

export { evaluatePassword, validatePassword };

const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;
const PHONE = /^\+?[0-9][0-9\s()-]{6,17}$/;

export const normalizeEmail = (value = '') => String(value).trim().toLowerCase();
export const isEmail = (value = '') => {
  const norm = normalizeEmail(value);
  return norm === 'admin' || EMAIL.test(norm);
};

/**
 * Normalises a mobile number for a country: strips spaces, dashes and brackets, a leading
 * +<dial code> or 00<dial code>, and a trunk 0. Returns { ok, national, international }.
 */
export function parseMobile(value, country) {
  const rule = COUNTRY_PHONE_RULES[country];
  let digits = String(value ?? '').trim().replace(/[\s().-]/g, '');
  if (!rule || !/^\+?\d+$/.test(digits)) return { ok: false };
  if (digits.startsWith('+')) {
    if (!digits.startsWith(`+${rule.dial}`)) return { ok: false };
    digits = digits.slice(rule.dial.length + 1);
  } else if (digits.startsWith(`00${rule.dial}`)) {
    digits = digits.slice(rule.dial.length + 2);
  } else if (digits.length > Math.max(...rule.lengths) && digits.startsWith(rule.dial)) {
    digits = digits.slice(rule.dial.length);
  }
  if (digits.startsWith('0') && !rule.lengths.includes(digits.length)) digits = digits.slice(1);
  const ok = rule.lengths.includes(digits.length) && rule.pattern.test(digits);
  return { ok, national: digits, international: ok ? `+${rule.dial} ${digits}` : '' };
}

export const mobileExample = (country) => {
  const rule = COUNTRY_PHONE_RULES[country];
  return rule ? `+${rule.dial} ${rule.example}` : '';
};

/* Small composable rules. Each returns an error message, or '' when the value is fine. */
export const rules = {
  required: (label) => (value) => (String(value ?? '').trim() ? '' : `${label} is required.`),
  email: () => (value) => (!String(value ?? '').trim() || isEmail(value) ? '' : 'Enter a valid email address, for example name@company.com.'),
  /** Mobile number valid for the country held in values[countryField]. */
  mobile: (countryField = 'country') => (value, values) => {
    if (!String(value ?? '').trim()) return '';
    const country = values[countryField];
    if (!COUNTRY_PHONE_RULES[country]) return 'Choose a country first.';
    return parseMobile(value, country).ok ? '' : `Enter a valid ${country} mobile number, e.g. ${mobileExample(country)}.`;
  },
  /** Standard TradeExpress Password Rule (8-64 chars, upper, lower, number, special @#$!%&*, no spaces, valid symbols) */
  password: () => (value) => {
    const text = String(value ?? '');
    if (!text) return '';
    const res = validatePassword(text);
    return res.isValid ? '' : res.message;
  },
  phone: () => (value) => (!String(value ?? '').trim() || PHONE.test(String(value).trim()) ? '' : 'Enter a valid phone number.'),
  minLength: (label, length) => (value) => (!value || String(value).trim().length >= length ? '' : `${label} must be at least ${length} characters.`),
  maxLength: (label, length) => (value) => (String(value ?? '').length <= length ? '' : `${label} must be ${length} characters or fewer.`),
  number: (label, { min, max, integer = false } = {}) => (value) => {
    if (value === '' || value === null || value === undefined) return '';
    const number = Number(value);
    if (Number.isNaN(number)) return `${label} must be a number.`;
    if (integer && !Number.isInteger(number)) return `${label} must be a whole number.`;
    if (min !== undefined && number < min) return `${label} must be at least ${min}.`;
    if (max !== undefined && number > max) return `${label} must be ${max} or less.`;
    return '';
  },
  matches: (otherKey, message) => (value, values) => (value === values[otherKey] ? '' : message),
  gstin: () => (value) => {
    const text = String(value ?? '').trim().toUpperCase();
    if (!text) return 'GSTIN is required for this registration category.';
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstinRegex.test(text) ? '' : 'Enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5).';
  },
  pan: () => (value) => {
    const text = String(value ?? '').trim().toUpperCase();
    if (!text) return '';
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(text) ? '' : 'Enter a valid 10-character PAN (e.g. ABCDE1234F).';
  },
  pinCode: (countryField = 'country') => (value, values) => {
    const text = String(value ?? '').trim();
    if (!text) return 'Postal code is required.';
    const country = values?.[countryField] || 'India';
    if (country === 'India') {
      const pinRegex = /^[1-9][0-9]{5}$/;
      return pinRegex.test(text) ? '' : 'Enter a valid 6-digit Indian PIN code (e.g. 400001).';
    }
    const generalPostalRegex = /^[A-Za-z0-9\s-]{3,10}$/;
    return generalPostalRegex.test(text) ? '' : 'Enter a valid postal / ZIP code.';
  },
  establishedYear: () => (value) => {
    if (!value) return '';
    const num = Number(value);
    const currentYear = new Date().getFullYear();
    if (Number.isNaN(num) || !Number.isInteger(num)) return 'Enter a valid 4-digit year.';
    if (num < 1800 || num > currentYear) return `Year must be between 1800 and ${currentYear}.`;
    return '';
  },
};

/**
 * Runs a schema ({ field: [rule, rule] }) against form values.
 * Returns { field: message } containing only the fields that failed.
 */
export function validate(schema, values) {
  const errors = {};
  for (const [field, fieldRules] of Object.entries(schema)) {
    for (const rule of fieldRules) {
      const message = rule(values[field], values);
      if (message) {
        errors[field] = message;
        break;
      }
    }
  }
  return errors;
}

export const hasErrors = (errors) => Object.values(errors).some(Boolean);

/** Moves keyboard focus to the first invalid field (fields use their key as the element id). */
export function focusFirstError(errors, prefix = '') {
  const first = Object.keys(errors).find((key) => errors[key]);
  if (first) window.setTimeout(() => document.getElementById(`${prefix}${first}`)?.focus(), 0);
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
