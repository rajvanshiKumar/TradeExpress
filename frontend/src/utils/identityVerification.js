/*
 * Signup identity verification (Aadhaar OTP, then PAN linked with it): which server answers mean the user has to
 * verify again. Both proofs are short-lived server tokens (30 minutes), so the form also expires them itself.
 */

// The Aadhaar proof is missing, expired, already used or for another number: verify Aadhaar (and then PAN) again
const AADHAAR_REVERIFY_CODES = new Set([
  'AADHAAR_NOT_VERIFIED',
  'AADHAAR_VERIFICATION_EXPIRED',
  'AADHAAR_VERIFICATION_USED',
  'AADHAAR_MISMATCH',
  'PAN_CHECK_LIMIT',
]);

// Only the PAN proof is missing, expired or for another PAN: verify the PAN again
const PAN_REVERIFY_CODES = new Set([
  'PAN_AADHAAR_NOT_VERIFIED',
  'PAN_AADHAAR_VERIFICATION_EXPIRED',
  'PAN_AADHAAR_MISMATCH',
]);

/** Slightly shorter than the server's 30-minute token life, so the form never submits an expired proof. */
export const IDENTITY_PROOF_LIFETIME_MS = 29 * 60 * 1000;

export const IDENTITY_EXPIRED_MESSAGE = 'Your verification has expired. Please verify your Aadhaar and PAN again.';

/** The error code in an API reply, whichever shape the endpoint uses. */
export const apiErrorCode = (body) => body?.code || body?.error?.code || null;

/** 'aadhaar' (verify Aadhaar again), 'pan' (verify PAN again) or null (show the message only). */
export function identityReverifyScope(code) {
  if (AADHAAR_REVERIFY_CODES.has(code)) return 'aadhaar';
  if (PAN_REVERIFY_CODES.has(code)) return 'pan';
  return null;
}
