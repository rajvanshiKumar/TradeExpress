// Login tokens and sessions, kept separately for each role so Buyer, Supplier and Super Admin can be signed in at the
// same time in different windows of one browser.
//
// localStorage (shared by all windows) holds one token and one session per role ("slot").
// sessionStorage (private to each window) records which slot this window acts as. Every API call uses that slot's token.

import { STORAGE_KEYS } from './constants.js';
import { readStorage, removeStorage, writeStorage } from './storage.js';

export const EMPTY_SESSION = { userId: null, role: null, expiresAt: 0 };
export const TOKEN_KEYS = { buyer: 'buyer_token', supplier: 'supplier_token', admin: 'admin_token' };
export const AUTH_CHANGED_EVENT = 'tradeexpress:auth-changed';

const WINDOW_SLOT_KEY = 'tradeexpress_window_role';
const LAST_SLOT_KEY = 'tradeexpress_last_role';
const NO_SLOT = 'none';
const LEGACY_TOKEN_KEYS = ['tradeexpress_auth_token', 'tradesphere_auth_token'];
// Pages where a new window must show the form, even if another window of this browser is signed in
const SIGN_IN_PATHS = /^\/(login|register|signup|forgot-password)(\/|$)|^\/(buyer|supplier|super-admin|superadmin|admin)\/(login|register)(\/|$)/;

let windowSlot; // undefined until this window has been resolved

const storageOf = (name) => {
  try {
    return typeof window !== 'undefined' ? window[name] : null;
  } catch {
    return null; // Storage blocked by the browser
  }
};
const safeGet = (store, key) => {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
};
const safeSet = (store, key, value) => {
  try {
    store?.setItem(key, value);
  } catch {
    // Storage full or blocked: this window keeps working from memory
  }
};
const safeRemove = (store, key) => {
  try {
    store?.removeItem(key);
  } catch {
    // Nothing to remove
  }
};
const sessionKey = (slot) => `${STORAGE_KEYS.session}:${slot}`;

/** Reads the (unverified) payload of a login token; the server still verifies every request. */
export function readTokenPayload(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const tokenExpired = (payload) => Boolean(payload?.exp && payload.exp * 1000 <= Date.now());

/**
 * True when the stored login token belongs to the signed-in session: same role, same account (the Super Admin
 * session uses a fixed local profile id, so only the role is compared), and not expired.
 */
export function sessionMatchesToken(session, token) {
  if (!session?.userId) return true;
  const payload = readTokenPayload(token);
  if (!payload) return false;
  if (tokenExpired(payload)) return false;
  if (String(payload.role || '').toLowerCase() !== session.role) return false;
  if (session.role === 'super_admin' || session.role === 'admin') return true;
  return payload.userId === session.userId;
}

/** The storage slot for a role: Admin and Super Admin share one. */
export function slotForRole(role) {
  const clean = String(role || '').toLowerCase();
  if (clean === 'buyer' || clean === 'supplier') return clean;
  return clean === 'admin' || clean === 'super_admin' ? 'admin' : null;
}

/** The slot a dashboard address belongs to. Public pages, such as /suppliers, belong to none. */
export function slotForPath(pathname) {
  const path = String(pathname || '');
  // A supplier's public profile (/supplier/TE-SEL-000123) is opened by anyone, so it never changes a window's role
  if (/^\/supplier\/(TE-SEL-|SUP-)/i.test(path)) return null;
  if (/^\/buyer(\/|$)/.test(path)) return 'buyer';
  if (/^\/supplier(\/|$)/.test(path)) return 'supplier';
  return /^\/(super-admin|superadmin|admin)(\/|$)/.test(path) ? 'admin' : null;
}

/** Removes one role's token and session. Other roles are never touched. */
function clearSlot(slot) {
  if (!TOKEN_KEYS[slot]) return;
  const local = storageOf('localStorage');
  safeRemove(local, TOKEN_KEYS[slot]);
  removeStorage(sessionKey(slot));
  if (safeGet(local, LAST_SLOT_KEY) === slot) safeRemove(local, LAST_SLOT_KEY);
}

/** Moves a sign-in from the old single shared token into its role's slot, so nobody is signed out by the upgrade. */
function migrateLegacySession() {
  const local = storageOf('localStorage');
  const legacyToken = LEGACY_TOKEN_KEYS.map((key) => safeGet(local, key)).find(Boolean);
  const legacySession = readStorage(STORAGE_KEYS.session, null);
  if (legacyToken) {
    const slot = slotForRole(readTokenPayload(legacyToken)?.role);
    if (slot && !safeGet(local, TOKEN_KEYS[slot])) {
      safeSet(local, TOKEN_KEYS[slot], legacyToken);
      if (legacySession?.userId && slotForRole(legacySession.role) === slot) writeStorage(sessionKey(slot), legacySession);
      safeSet(local, LAST_SLOT_KEY, slot);
    }
  }
  LEGACY_TOKEN_KEYS.forEach((key) => safeRemove(local, key));
  removeStorage(STORAGE_KEYS.session);
}

/** One role's session, or an empty one if it is missing, expired or does not match that role's token. */
export function readRoleSession(slot) {
  if (!TOKEN_KEYS[slot]) return EMPTY_SESSION;
  const session = readStorage(sessionKey(slot), EMPTY_SESSION);
  if (!session?.userId) return EMPTY_SESSION;
  const token = safeGet(storageOf('localStorage'), TOKEN_KEYS[slot]);
  if (!token) return EMPTY_SESSION;
  if (!session.expiresAt || session.expiresAt < Date.now() || tokenExpired(readTokenPayload(token))) {
    clearSlot(slot);
    return EMPTY_SESSION;
  }
  return sessionMatchesToken(session, token) ? session : EMPTY_SESSION;
}

export const writeRoleSession = (slot, session) => writeStorage(sessionKey(slot), session);

/** Records which role this window acts as. Only this window is affected. */
export function bindWindow(slot) {
  windowSlot = slot || null;
  safeSet(storageOf('sessionStorage'), WINDOW_SLOT_KEY, slot || NO_SLOT);
  if (slot) safeSet(storageOf('localStorage'), LAST_SLOT_KEY, slot);
}

/** Notes the role of the window in use, so a link opened in a new tab from it continues as the same role. */
export function rememberActiveSlot(slot) {
  if (slot) safeSet(storageOf('localStorage'), LAST_SLOT_KEY, slot);
}

/**
 * Works out which role this window acts as when it loads: a dashboard address decides first (if that role is signed
 * in), then this window's own choice, which also survives a refresh. A new window on a public page continues as the
 * role last in use; on a sign-in page it starts signed out, so a different role can sign in.
 */
export function resolveWindowSlot(pathname) {
  migrateLegacySession();
  const fromPath = slotForPath(pathname);
  if (fromPath && readRoleSession(fromPath).userId) {
    bindWindow(fromPath);
    return fromPath;
  }
  const own = safeGet(storageOf('sessionStorage'), WINDOW_SLOT_KEY);
  if (own) {
    windowSlot = TOKEN_KEYS[own] ? own : null;
    return windowSlot;
  }
  if (fromPath || SIGN_IN_PATHS.test(String(pathname || ''))) {
    windowSlot = null;
    return null;
  }
  const last = safeGet(storageOf('localStorage'), LAST_SLOT_KEY);
  if (last && readRoleSession(last).userId) {
    bindWindow(last);
    return last;
  }
  windowSlot = null;
  return null;
}

function currentSlot() {
  if (windowSlot === undefined) resolveWindowSlot(typeof window !== 'undefined' ? window.location?.pathname : '');
  return windowSlot;
}

/** The token of the given role, or '' if there is none or it has expired. */
export function getTokenForSlot(slot) {
  if (!TOKEN_KEYS[slot]) return '';
  const token = safeGet(storageOf('localStorage'), TOKEN_KEYS[slot]);
  if (!token || tokenExpired(readTokenPayload(token))) return '';
  return token;
}

/** The token this window should send with its API requests. */
export const getAuthToken = () => getTokenForSlot(currentSlot());

/** Saves a new login token under its own role and makes this window act as that role. */
export function storeAuthToken(token) {
  const slot = slotForRole(readTokenPayload(token)?.role);
  if (!slot) return;
  safeSet(storageOf('localStorage'), TOKEN_KEYS[slot], token);
  bindWindow(slot);
}

/** Signs this window's role out in this browser and leaves the window signed out. Other roles are untouched. */
export function signOutWindow() {
  const slot = currentSlot();
  if (slot) clearSlot(slot);
  bindWindow(null);
  return slot;
}

/**
 * The server rejected a token (expired, or that device was signed out): that role alone is signed out, and only if
 * the token is still the current one, so a late response cannot end a newer sign-in.
 */
export function handleRejectedToken(token) {
  const slot = slotForRole(readTokenPayload(token)?.role);
  if (!slot || safeGet(storageOf('localStorage'), TOKEN_KEYS[slot]) !== token) return;
  clearSlot(slot);
  try {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  } catch {
    // Not running in a browser window
  }
}

export const roleSessionKey = sessionKey;

/** Test helper: forgets the resolved window, as a page load does. */
export function resetWindowSlotForTests() {
  windowSlot = undefined;
}
