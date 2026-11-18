import { apiUrl } from '../config/api.js';

/*
 * Aadhaar OTP verification used by Buyer and Supplier signup.
 * Step 1 sends an OTP to the Aadhaar-linked mobile; step 2 checks it and returns a short-lived
 * verificationToken that signup and the PAN–Aadhaar link check must include.
 */

async function post(path, body) {
  let res;
  try {
    res = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      // Longer than the server's provider timeout, so a slow provider is reported by the server, not as a network error
      signal: AbortSignal.timeout(35000),
    });
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError';
    throw new Error(timedOut
      ? 'The Aadhaar verification service took too long to respond. Please try again.'
      : 'Could not reach the TradeExpress server. Please check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success !== true) {
    const error = new Error(data.errors?.[0]?.message || data.error?.message || data.message || 'Aadhaar verification failed. Please try again.');
    error.code = data.error?.code;
    error.retryAfterSeconds = data.retryAfterSeconds;
    throw error;
  }
  return data.data;
}

/** Returns { verificationId, aadhaarLast4, expiresInSeconds, resendAfterSeconds, environment, simulated, message }. */
export const sendAadhaarOtp = (aadhaarNumber) =>
  post('/verification/aadhaar/otp/send', { aadhaarNumber, userConsent: true });

/** Returns { verified, verificationToken, fullName, aadhaarLast4, environment, simulated, message }. */
export const verifyAadhaarOtp = ({ verificationId, aadhaarNumber, otp }) =>
  post('/verification/aadhaar/otp/verify', { verificationId, aadhaarNumber, otp });
