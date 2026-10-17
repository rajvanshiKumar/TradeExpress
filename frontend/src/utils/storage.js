// Shared localStorage utility. Every read is defensive: missing, malformed or
// wrong-shaped data falls back to the value supplied by the caller, so a corrupted
// entry can never crash the app. Data stays in this browser only.

import { LEGACY_STORAGE_PREFIX, STORAGE_PREFIX } from './constants.js';

const fullKey = (key) => `${STORAGE_PREFIX}${key}`;

function available() {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

/** Returns the stored value, or `fallback` when nothing valid is stored. */
export function readStorage(key, fallback) {
  if (!available()) return fallback;
  try {
    const raw = window.localStorage.getItem(fullKey(key));
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    // A collection that was saved as something else is treated as malformed.
    if (Array.isArray(fallback) && !Array.isArray(value)) return fallback;
    if (fallback && typeof fallback === 'object' && !Array.isArray(fallback) && (typeof value !== 'object' || value === null || Array.isArray(value))) {
      return fallback;
    }
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function hasStorage(key) {
  if (!available()) return false;
  try {
    return window.localStorage.getItem(fullKey(key)) !== null;
  } catch {
    return false;
  }
}

export function writeStorage(key, value) {
  if (!available()) return false;
  try {
    window.localStorage.setItem(fullKey(key), JSON.stringify(value));
    return true;
  } catch {
    return false; // storage full or blocked: the app keeps working from memory
  }
}

export function removeStorage(key) {
  if (!available()) return;
  try {
    window.localStorage.removeItem(fullKey(key));
  } catch {
    /* nothing to remove */
  }
}

/** Removes every TradeSphere key, including ones from older versions. Used by "Reset sample data". */
export function clearAllStorage() {
  if (!available()) return;
  try {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(STORAGE_PREFIX) || key.startsWith(LEGACY_STORAGE_PREFIX))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}
