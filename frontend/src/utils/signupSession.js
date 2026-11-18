/*
 * Signup progress that survives a page refresh.
 *
 * A session starts once the email is verified. It keeps what the user has entered and where they were, plus the
 * server's short-lived proofs (email: about 1 hour, mobile: 15 minutes). Aadhaar / PAN details are never stored.
 * When the email proof has expired, the data is kept and the user only verifies the email again, then continues
 * from the step they were on.
 */

const KEY_PREFIX = 'tradeexpress:signup:';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // stored progress is dropped after a day
// The server accepts a verified mobile for 15 minutes; resume treats it as expired a little earlier
export const PHONE_PROOF_LIFETIME_MS = 14 * 60 * 1000;
const EXPIRY_MARGIN_MS = 60 * 1000;

const storageKey = (role) => `${KEY_PREFIX}${role}`;

function storage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Expiry time (ms) inside a JWT, or null when it cannot be read. The signature is checked by the server only. */
export function tokenExpiresAt(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part) return null;
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** True while a signed proof is still valid (with a one-minute margin). */
export function isProofAlive(token, now = Date.now()) {
  const expiresAt = tokenExpiresAt(token);
  return Boolean(expiresAt) && expiresAt - EXPIRY_MARGIN_MS > now;
}

/** Saves the signup progress for a role ('buyer' / 'supplier'). Ignores storage that is unavailable or full. */
export function saveSignupSession(role, session) {
  try {
    storage()?.setItem(storageKey(role), JSON.stringify({ ...session, savedAt: Date.now() }));
  } catch {
    // Private mode or full storage: signup still works, it just cannot resume after a refresh
  }
}

export function clearSignupSession(role) {
  try {
    storage()?.removeItem(storageKey(role));
  } catch {
    // nothing to clear
  }
}

/** The stored progress for a role, or null when there is none, it is too old or unreadable. */
export function loadSignupSession(role, now = Date.now()) {
  try {
    const raw = storage()?.getItem(storageKey(role));
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session || typeof session !== 'object' || !session.email || now - (session.savedAt || 0) > MAX_AGE_MS) {
      clearSignupSession(role);
      return null;
    }
    return session;
  } catch {
    clearSignupSession(role);
    return null;
  }
}

/**
 * Where a restored signup continues.
 * Returns { emailValid, phoneValid, step, resumeStep }:
 *  - email proof expired: step 1 (verify the email again), then continue at resumeStep
 *  - mobile proof expired: no later than step 2
 */
export function resolveResume(session, now = Date.now()) {
  const savedStep = Math.max(1, Number(session?.step) || 1);
  const emailValid = isProofAlive(session?.emailToken, now);
  const phoneValid = Boolean(session?.phoneToken) && now - (session?.phoneVerifiedAt || 0) < PHONE_PROOF_LIFETIME_MS;
  const furthest = phoneValid ? savedStep : Math.min(savedStep, 2);
  if (!emailValid) return { emailValid, phoneValid, step: 1, resumeStep: furthest > 1 ? furthest : null };
  return { emailValid, phoneValid, step: Math.max(2, furthest), resumeStep: null };
}
