import { countryName, defaultCurrencyFor, isCountryCode, isCurrencyCode, validatePostalCode } from './countryData.js';

// The buyer's location and display currency on this device. Signed-in users also keep it on their account.
const STORAGE_KEY = 'tradeexpress_location';
export const LOCATION_EVENT = 'tradeexpress:location-change';

export const DEFAULT_LOCATION = { countryCode: 'IN', countryName: 'India', postalCode: '', displayCurrency: 'INR', currencyManual: false };

/** A complete, valid location. Anything invalid falls back to the default, so a bad stored value can never break a page. */
export function sanitizeLocation(value) {
  const code = String(value?.countryCode || '').toUpperCase();
  if (!isCountryCode(code)) return { ...DEFAULT_LOCATION };
  const postal = validatePostalCode(code, value?.postalCode);
  const manual = value?.currencyManual === true && isCurrencyCode(value?.displayCurrency);
  return {
    countryCode: code,
    countryName: countryName(code),
    postalCode: postal.ok ? postal.value : '',
    displayCurrency: manual ? value.displayCurrency : defaultCurrencyFor(code),
    currencyManual: manual,
    ...(value?.savedAt ? { savedAt: value.savedAt } : {}),
  };
}

export function readLocation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeLocation(JSON.parse(raw)) : { ...DEFAULT_LOCATION };
  } catch {
    return { ...DEFAULT_LOCATION };
  }
}

/** Saves on this device and tells every open part of the page, so the header updates at once. */
export function writeLocation(value) {
  const next = sanitizeLocation(value);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: the page still updates for this visit
  }
  try {
    window.dispatchEvent(new CustomEvent(LOCATION_EVENT, { detail: next }));
  } catch {
    // Not in a browser
  }
  return next;
}

/** True when a location has been chosen on this device, as opposed to the untouched default. */
export function hasChosenLocation() {
  try {
    return Boolean(localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

/** "110001, IN" for the header, or just "AE" where no postal code is used. */
export const locationLabel = (location) => (location.postalCode ? `${location.postalCode}, ${location.countryCode}` : location.countryCode);
