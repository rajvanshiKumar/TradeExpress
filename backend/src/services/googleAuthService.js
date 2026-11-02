import crypto from 'crypto';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';

/*
 * Google Sign-In, server side.
 *
 * The browser obtains a one-time authorization code from Google's own account chooser
 * (Google Identity Services, popup mode). This module exchanges that code with Google using the
 * client secret, then verifies the returned OpenID Connect ID token: RS256 signature against Google's
 * published keys, audience, issuer, expiry and email_verified. Nothing the browser sends is trusted
 * as identity on its own.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

function googleError(message, statusCode = 401, code = 'GOOGLE_AUTH_FAILED') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = code;
  return error;
}

export function isGoogleSignInConfigured() {
  return Boolean(ENV.GOOGLE_CLIENT_ID && ENV.GOOGLE_CLIENT_SECRET);
}

// Google's signing keys rotate; they are cached for the lifetime Google advertises (Cache-Control max-age)
let keyCache = { expiresAt: 0, keys: new Map() };

async function getSigningKey(kid, { fetchCerts = axios.get } = {}) {
  if (Date.now() >= keyCache.expiresAt || !keyCache.keys.has(kid)) {
    let response;
    try {
      response = await fetchCerts(CERTS_URL, { timeout: 10000 });
    } catch {
      throw googleError('Could not reach Google to verify the sign-in. Please try again.', 503, 'GOOGLE_UNREACHABLE');
    }
    const maxAge = Number(/max-age=(\d+)/.exec(response.headers?.['cache-control'] || '')?.[1]) || 3600;
    const keys = new Map((response.data?.keys || []).map((jwk) => [jwk.kid, crypto.createPublicKey({ key: jwk, format: 'jwk' })]));
    keyCache = { expiresAt: Date.now() + maxAge * 1000, keys };
  }
  const key = keyCache.keys.get(kid);
  if (!key) throw googleError('Google sign-in could not be verified (unknown signing key).');
  return key;
}

/** Verifies a Google ID token and returns its claims. Throws a 401 error if anything is wrong. */
export async function verifyGoogleIdToken(idToken, { fetchCerts } = {}) {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded?.header?.kid || decoded.header.alg !== 'RS256') {
    throw googleError('Google sign-in returned an invalid identity token.');
  }
  const key = await getSigningKey(decoded.header.kid, { fetchCerts });

  let claims;
  try {
    claims = jwt.verify(idToken, key, { algorithms: ['RS256'], audience: ENV.GOOGLE_CLIENT_ID, issuer: GOOGLE_ISSUERS });
  } catch (error) {
    throw googleError(`Google sign-in could not be verified (${error.message}).`);
  }
  if (!claims.sub || !claims.email) throw googleError('Google did not share an email address for this account.');
  if (claims.email_verified !== true && claims.email_verified !== 'true') {
    throw googleError('This Google account\'s email address is not verified by Google.', 403, 'GOOGLE_EMAIL_NOT_VERIFIED');
  }
  return claims;
}

/**
 * Exchanges the authorization code from Google's popup for tokens and returns the verified profile.
 * `request` and `fetchCerts` can be replaced in tests.
 */
export async function getVerifiedGoogleProfile(code, { request = axios.post, fetchCerts } = {}) {
  if (!isGoogleSignInConfigured()) {
    throw googleError('Google sign-in is not set up on TradeExpress yet.', 503, 'GOOGLE_NOT_CONFIGURED');
  }

  let tokens;
  try {
    const response = await request(TOKEN_URL, new URLSearchParams({
      code,
      client_id: ENV.GOOGLE_CLIENT_ID,
      client_secret: ENV.GOOGLE_CLIENT_SECRET,
      redirect_uri: 'postmessage', // required value for the Google Identity Services popup flow
      grant_type: 'authorization_code',
    }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000, validateStatus: () => true });

    if (response.status !== 200 || !response.data?.id_token) {
      const reason = response.data?.error_description || response.data?.error || `HTTP ${response.status}`;
      console.warn(`[Google Sign-In] Code exchange rejected: ${reason}`);
      throw googleError(
        response.data?.error === 'invalid_grant'
          ? 'This Google sign-in has expired or was already used. Please try again.'
          : 'Google rejected the sign-in request. Please try again.',
      );
    }
    tokens = response.data;
  } catch (error) {
    if (error.errorCode) throw error;
    throw googleError('Could not reach Google to complete the sign-in. Please try again.', 503, 'GOOGLE_UNREACHABLE');
  }

  const claims = await verifyGoogleIdToken(tokens.id_token, { fetchCerts });
  return {
    googleId: String(claims.sub),
    email: String(claims.email).toLowerCase().trim(),
    name: String(claims.name || claims.given_name || claims.email.split('@')[0]).trim().slice(0, 80),
    picture: claims.picture ? String(claims.picture) : null,
  };
}

/** Test helper: forget cached Google signing keys. */
export function clearGoogleKeyCache() {
  keyCache = { expiresAt: 0, keys: new Map() };
}
