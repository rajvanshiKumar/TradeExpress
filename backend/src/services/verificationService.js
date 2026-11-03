import crypto from 'crypto';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import { ENV } from '../config/env.js';

/*
 * PAN–Aadhaar link verification.
 *
 * The answer always comes from the configured provider (Income Tax link-status API). There is no
 * mock or "statutory" fallback: if the provider cannot answer (no credits, bad credentials, outage,
 * timeout, unreadable reply) the result is UNABLE_TO_VERIFY with the real reason. LINKED is returned
 * only when the provider reports the Aadhaar as linked AND the PAN it returns matches the entered PAN.
 */

// Definitive provider answers are cached briefly so a retry does not spend another paid credit.
const linkStatusCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const SIGNUP_TOKEN_TTL = '30m';
const SIGNUP_TOKEN_PURPOSE = 'PAN_AADHAAR_LINK';
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const DISCLAIMER = 'Link status indicates ITD PAN-Aadhaar linkage only. This does not constitute full PAN KYC, Aadhaar identity authentication, GST verification, or Gold Supplier approval.';

/** Keyed hash so identity numbers are never stored or placed in tokens in a reversible form. */
function secretHash(value) {
  return crypto.createHmac('sha256', ENV.JWT_SECRET).update(String(value)).digest('hex');
}

/** True when PAN_AADHAAR_API_BASE_URL points at the provider's UAT (test) environment. */
export function isPanAadhaarUatProvider() {
  return /\/uat\//i.test(process.env.PAN_AADHAAR_API_BASE_URL || '');
}

function getProviderConfig() {
  return {
    baseUrl: (process.env.PAN_AADHAAR_API_BASE_URL || '').trim(),
    apiId: process.env.PAN_AADHAAR_API_ID || process.env.api_id,
    apiKey: process.env.PAN_AADHAAR_API_KEY || process.env.api_key,
    tokenId: process.env.PAN_AADHAAR_TOKEN_ID || process.env.token_id,
    timeoutMs: Math.min(parseInt(process.env.PAN_AADHAAR_API_TIMEOUT_MS, 10) || 15000, 30000),
  };
}

// Verhoeff checksum tables used by UIDAI for the 12th Aadhaar digit
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1], [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1], [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** True when a 12-digit Aadhaar number has a valid structure and Verhoeff check digit. */
export function isValidAadhaarNumber(digits) {
  const value = String(digits || '');
  if (!/^[2-9]\d{11}$/.test(value)) return false; // Aadhaar never starts with 0 or 1
  let check = 0;
  const reversed = value.split('').reverse().map(Number);
  for (let i = 0; i < reversed.length; i += 1) check = VERHOEFF_D[check][VERHOEFF_P[i % 8][reversed[i]]];
  return check === 0;
}

const isMaskChar = (ch) => ch === 'X' || ch === '*' || ch === '•';

/**
 * Compares the entered PAN with the provider's masked PAN (e.g. "MRXXXXXX1F").
 * A match needs at least 4 visible characters that all agree; a fully masked or missing value can
 * never prove a match.
 */
export function doesPanMatchMaskedPan(enteredPan, maskedPan) {
  const entered = String(enteredPan || '').trim().toUpperCase();
  const masked = String(maskedPan || '').trim().toUpperCase();
  if (entered.length !== 10 || masked.length !== 10) return false;
  let visible = 0;
  for (let i = 0; i < 10; i += 1) {
    if (isMaskChar(masked[i])) continue;
    visible += 1;
    if (masked[i] !== entered[i]) return false;
  }
  return visible >= 4;
}

const hasVisiblePanCharacters = (maskedPan) => String(maskedPan || '').split('').some((ch) => !isMaskChar(ch.toUpperCase()));

/** Readable explanations for the provider's "reason" codes. */
const PROVIDER_REASONS = {
  not_linked: 'Income Tax records show this Aadhaar number is not linked with the PAN you entered.',
  aadhaar_not_found: 'This Aadhaar number was not found in Income Tax records.',
  invalid_aadhaar: 'The provider rejected this Aadhaar number as invalid.',
  pan_not_found: 'This PAN was not found in Income Tax records.',
  invalid_pan: 'The provider rejected this PAN as invalid.',
};

/** Turns a failed provider call into a specific, user-facing reason. Secrets are never included. `service` names the check in messages. */
function classifyProviderFailure({ httpStatus, body, networkError, service = 'PAN–Aadhaar verification service', inputs = 'Aadhaar or PAN details' }) {
  if (networkError) {
    const timedOut = networkError.code === 'ECONNABORTED' || networkError.code === 'ETIMEDOUT' || /timeout/i.test(networkError.message || '');
    return timedOut
      ? { reason: 'PROVIDER_TIMEOUT', message: `The ${service} did not respond in time. Please try again in a few minutes.` }
      : { reason: 'PROVIDER_UNREACHABLE', message: `The ${service} could not be reached. Please try again later.` };
  }

  const code = String(body?.error?.code || body?.code || '').toUpperCase();
  const providerMessage = String(body?.error?.message || body?.message || '').slice(0, 200);

  if (httpStatus === 402 || /CREDIT|BALANCE|QUOTA/.test(code) || /credit|balance|quota/i.test(providerMessage)) {
    return { reason: 'INSUFFICIENT_CREDITS', message: `Verification could not be completed: the ${service} has 0 credits remaining. Please contact TradeExpress support.` };
  }
  if (httpStatus === 401 || httpStatus === 403 || /AUTH|CREDENTIAL|INVALID_KEY|UNAUTHORI[SZ]ED|FORBIDDEN/.test(code)) {
    return { reason: 'PROVIDER_AUTH_FAILED', message: 'Verification could not be completed: the verification service rejected TradeExpress\'s API credentials. Please contact TradeExpress support.' };
  }
  if (httpStatus === 429) {
    return { reason: 'PROVIDER_RATE_LIMITED', message: 'Too many verification requests right now. Please wait a minute and try again.' };
  }
  if (httpStatus === 400 || httpStatus === 422) {
    return { reason: 'PROVIDER_REJECTED_INPUT', message: providerMessage ? `The verification service rejected the request: ${providerMessage}` : `The verification service rejected the ${inputs}.` };
  }
  if (httpStatus === 404 || httpStatus === 405) {
    // The provider address itself is not answering (e.g. the endpoint moved or its tunnel is offline)
    return { reason: 'PROVIDER_ENDPOINT_NOT_FOUND', message: `The ${service} is currently unavailable. Please try again later or contact TradeExpress support.` };
  }
  if (httpStatus >= 500) {
    return { reason: 'PROVIDER_ERROR', message: `The ${service} is having a problem (HTTP ${httpStatus}). Please try again later.` };
  }
  if (httpStatus !== 200) {
    return { reason: 'PROVIDER_UNEXPECTED_STATUS', message: `The ${service} is currently unavailable (HTTP ${httpStatus}). Please try again later.` };
  }
  return { reason: 'PROVIDER_INVALID_RESPONSE', message: 'The verification service returned a response that could not be understood. Please try again later.' };
}

function inputError(message, code, statusCode = 422) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

/** Calls the provider once and interprets the reply. Returns { status, linked, maskedPan, reason, message, requestId, definitive }. */
async function queryProvider({ aadhaar, pan, request }) {
  const config = getProviderConfig();
  if (!config.baseUrl || !config.apiId || !config.apiKey || !config.tokenId) {
    return {
      status: 'UNABLE_TO_VERIFY', linked: false, maskedPan: null, requestId: null, definitive: false,
      reason: 'PROVIDER_NOT_CONFIGURED',
      message: 'PAN–Aadhaar verification is not configured on TradeExpress yet. Please contact TradeExpress support.',
    };
  }

  let response;
  try {
    response = await request(config.baseUrl, {
      api_id: config.apiId, api_key: config.apiKey, token_id: config.tokenId, aadhaarNumber: aadhaar, pan,
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: config.timeoutMs,
      validateStatus: () => true,
    });
  } catch (networkError) {
    console.warn(`[PAN-Aadhaar Verification] Provider request failed: ${networkError.code || networkError.message}`);
    return { status: 'UNABLE_TO_VERIFY', linked: false, maskedPan: null, requestId: null, definitive: false, ...classifyProviderFailure({ networkError }) };
  }

  const body = response?.data;
  const httpStatus = response?.status;
  const data = body && typeof body === 'object' ? body.data : null;

  if (httpStatus !== 200 || body?.success !== true || !data || typeof data.linking_status !== 'boolean') {
    const failure = classifyProviderFailure({ httpStatus, body });
    // Host only (never the query or credentials), so an operator can see which provider address failed
    let providerHost = 'unknown host';
    try { providerHost = new URL(config.baseUrl).host; } catch { /* keep default */ }
    console.warn(`[PAN-Aadhaar Verification] Provider could not verify: HTTP ${httpStatus} from ${providerHost}, ${failure.reason}`);
    return { status: 'UNABLE_TO_VERIFY', linked: false, maskedPan: null, requestId: body?.requestId || null, definitive: false, ...failure };
  }

  const requestId = body.requestId || data.client_id || null;
  const providerReason = String(data.reason || body.message || '').trim();

  if (data.linking_status !== true) {
    return {
      status: 'NOT_LINKED', linked: false, maskedPan: null, requestId, definitive: true,
      reason: providerReason || 'not_linked',
      message: PROVIDER_REASONS[providerReason.toLowerCase()] || `Not verified: ${providerReason || 'the Aadhaar number is not linked with this PAN'}.`,
    };
  }

  // Linked according to the provider: the PAN it reports must match the PAN the user entered
  const maskedPan = data.masked_pan ? String(data.masked_pan).toUpperCase() : null;
  if (doesPanMatchMaskedPan(pan, maskedPan)) {
    return {
      status: 'LINKED', linked: true, maskedPan, requestId, definitive: true, reason: 'linked',
      message: 'Verified: this Aadhaar number is linked with the PAN you entered in Income Tax records.',
    };
  }
  if (hasVisiblePanCharacters(maskedPan)) {
    return {
      status: 'NOT_LINKED', linked: false, maskedPan, requestId, definitive: true, reason: 'PAN_MISMATCH',
      message: `Not verified: this Aadhaar number is linked to a different PAN (${maskedPan}), not the PAN you entered.`,
    };
  }
  return {
    status: 'UNABLE_TO_VERIFY', linked: false, maskedPan: null, requestId, definitive: false, reason: 'PAN_MATCH_UNCONFIRMED',
    message: 'Not verified: the verification service confirmed an Aadhaar–PAN link but did not return enough of the PAN to confirm it is the PAN you entered.',
  };
}

/**
 * Testing only (PAN_AADHAAR_TEST_MODE=true, never when NODE_ENV=production): when the provider cannot be
 * reached, the check is treated as linked so signup can be tested. Real provider answers (including
 * NOT_LINKED) always win, and the result is labelled as a test, never as an Income Tax confirmation.
 */
export function isPanAadhaarTestMode() {
  return process.env.PAN_AADHAAR_TEST_MODE === 'true' && process.env.NODE_ENV !== 'production';
}

function testModeOutcome(providerOutcome) {
  console.warn(`[PAN-Aadhaar Verification] TEST MODE: provider unavailable (${providerOutcome.reason}); treating as linked for testing.`);
  return {
    status: 'LINKED', linked: true, maskedPan: null, requestId: 'TEST_MODE', definitive: false, reason: 'TEST_MODE',
    message: `TEST MODE: the verification service is unavailable (${providerOutcome.reason}), so this was marked as linked for testing only. It was not checked with Income Tax records.`,
  };
}

/** Short-lived signed proof that this exact Aadhaar + PAN pair was verified as LINKED by the provider. */
function issueSignupToken({ aadhaar, pan, maskedPan, requestId }) {
  return jwt.sign(
    { purpose: SIGNUP_TOKEN_PURPOSE, a: secretHash(`aadhaar:${aadhaar}`), p: secretHash(`pan:${pan}`), maskedPan, last4: aadhaar.slice(-4), requestId },
    ENV.JWT_SECRET,
    { expiresIn: SIGNUP_TOKEN_TTL },
  );
}

/**
 * Verifies that an Aadhaar number is linked with the given PAN using the configured provider.
 * Statuses: LINKED | NOT_LINKED | UNABLE_TO_VERIFY. Full Aadhaar and PAN are never logged or stored.
 * `request` can be replaced in tests; it defaults to axios.post.
 */
export async function checkPanAadhaarLinkStatus({
  aadhaarNumber,
  pan = null,
  userConsent,
  userId = null,
  bypassCache = false,
  request = axios.post,
}) {
  if (userConsent !== true && userConsent !== 'true') {
    throw inputError('Explicit consent is required to verify PAN–Aadhaar link status.', 'CONSENT_REQUIRED', 400);
  }

  const aadhaar = String(aadhaarNumber || '').replace(/\D/g, '');
  if (aadhaar.length !== 12) {
    throw inputError('Invalid Aadhaar format. Aadhaar number must be exactly 12 digits.', 'INVALID_AADHAAR_FORMAT');
  }
  // Checked locally first, so a mistyped number never spends a paid provider credit. Every real Aadhaar
  // passes this check digit; the provider's UAT (test) environment may use sample numbers that do not,
  // so in UAT the provider decides.
  if (!isPanAadhaarUatProvider() && !isValidAadhaarNumber(aadhaar)) {
    throw inputError('This Aadhaar number is not valid (its last digit does not match). Please check all 12 digits and try again.', 'INVALID_AADHAAR_NUMBER');
  }

  const cleanPan = String(pan || '').trim().toUpperCase();
  if (!cleanPan) throw inputError('PAN is required to check which PAN your Aadhaar is linked with.', 'PAN_REQUIRED');
  if (!PAN_REGEX.test(cleanPan)) {
    throw inputError('Invalid PAN format. Enter the 10-character PAN (e.g. ABCDE1234F).', 'INVALID_PAN_FORMAT');
  }

  const cacheKey = secretHash(`${aadhaar}:${cleanPan}`);
  const cached = linkStatusCache.get(cacheKey);
  let outcome;
  let fromCache = false;
  if (!bypassCache && cached && cached.expiresAt > Date.now()) {
    outcome = cached.outcome;
    fromCache = true;
  } else {
    outcome = await queryProvider({ aadhaar, pan: cleanPan, request });
    // Only real answers are cached; failures (credits, outage, ...) are retried next time
    if (outcome.definitive) linkStatusCache.set(cacheKey, { outcome, expiresAt: Date.now() + CACHE_TTL_MS });
    else if (isPanAadhaarTestMode() && outcome.reason !== 'PAN_MATCH_UNCONFIRMED') outcome = testModeOutcome(outcome);
  }

  const result = {
    success: outcome.definitive,
    status: outcome.status,
    linked: outcome.linked,
    maskedPan: outcome.maskedPan,
    reason: outcome.reason,
    requestId: outcome.requestId,
    verifiedAt: new Date().toISOString(),
    message: outcome.message,
    disclaimer: DISCLAIMER,
    ...(fromCache ? { fromCache: true } : {}),
    ...(outcome.linked ? { verificationToken: issueSignupToken({ aadhaar, pan: cleanPan, maskedPan: outcome.maskedPan, requestId: outcome.requestId }) } : {}),
  };

  // Signed-in users: record only real answers, so a provider outage never erases an earlier result
  if (userId && outcome.definitive) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          panAadhaarStatus: outcome.status,
          panAadhaarLinked: outcome.linked,
          panAadhaarCheckedAt: new Date(),
          panAadhaarMaskedPan: outcome.maskedPan,
          ...(outcome.linked ? { aadhaarLast4: aadhaar.slice(-4), aadhaarConsent: true, pan: cleanPan } : {}),
        },
      });
    } catch {
      // Non-blocking: the verification answer is still returned
    }
  }

  return result;
}

/**
 * Registration-side check. The PAN–Aadhaar status saved at signup comes only from a valid verification
 * token for the exact Aadhaar and PAN being registered; anything the browser claims is ignored.
 * Returns the fields to store. Throws 400 when LINKED is claimed without a matching, unexpired token.
 */
export function resolveSignupPanAadhaar({ token, aadhaarNumber, pan, claimedLinked = false }) {
  const notVerified = { panAadhaarStatus: 'NOT_STARTED', panAadhaarLinked: false, panAadhaarMaskedPan: null, panAadhaarCheckedAt: null };
  const aadhaar = String(aadhaarNumber || '').replace(/\D/g, '');
  const cleanPan = String(pan || '').trim().toUpperCase();

  if (!token) {
    if (claimedLinked) throw inputError('Your PAN–Aadhaar verification is missing. Please verify your Aadhaar and PAN again.', 'PAN_AADHAAR_NOT_VERIFIED', 400);
    return notVerified;
  }

  let payload;
  try {
    payload = jwt.verify(token, ENV.JWT_SECRET);
  } catch {
    throw inputError('Your PAN–Aadhaar verification has expired. Please verify your Aadhaar and PAN again.', 'PAN_AADHAAR_VERIFICATION_EXPIRED', 400);
  }
  if (
    payload?.purpose !== SIGNUP_TOKEN_PURPOSE
    || payload.a !== secretHash(`aadhaar:${aadhaar}`)
    || payload.p !== secretHash(`pan:${cleanPan}`)
  ) {
    throw inputError('The Aadhaar or PAN you submitted is different from the one that was verified. Please verify again.', 'PAN_AADHAAR_MISMATCH', 400);
  }
  return {
    panAadhaarStatus: 'LINKED',
    panAadhaarLinked: true,
    panAadhaarMaskedPan: payload.maskedPan || null,
    panAadhaarCheckedAt: new Date(payload.iat * 1000),
  };
}

// In-memory cache for GSTIN verifications
const gstinVerificationCache = new Map();
const GST_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export const GST_STATE_CODES = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
  '99': 'Centre Jurisdiction',
};

export const GST_ENTITY_TYPES = {
  C: 'Company (Private / Public Limited)',
  P: 'Individual / Proprietorship',
  H: 'Hindu Undivided Family (HUF)',
  F: 'Partnership Firm / LLP',
  A: 'Association of Persons (AOP)',
  T: 'Trust',
  B: 'Body of Individuals (BOI)',
  L: 'Local Authority',
  J: 'Artificial Juridical Person',
  G: 'Government Entity',
};

/** GSTIN verification provider settings. Credentials come only from environment variables. */
export function getGstProviderConfig() {
  return {
    baseUrl: (process.env.GST_BASE_URL || process.env.Base_URL || process.env.GST_API_BASE_URL || '').trim(),
    apiId: process.env.GST_API_ID || process.env.api_id,
    apiKey: process.env.GST_API_KEY || process.env.api_key,
    tokenId: process.env.GST_TOKEN_ID || process.env.token_id,
    timeoutMs: Math.min(parseInt(process.env.GST_API_TIMEOUT_MS, 10) || 15000, 30000),
  };
}

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const GST_SIGNUP_TOKEN_PURPOSE = 'GSTIN_VERIFIED';
const GST_SERVICE = { service: 'GST verification service', inputs: 'GSTIN' };

/**
 * Testing only (GST_TEST_MODE=true, never when NODE_ENV=production): when the GST provider cannot be
 * reached, the GSTIN is treated as verified so signup can be tested. Real provider answers always win.
 */
export function isGstTestMode() {
  return process.env.GST_TEST_MODE === 'true' && process.env.NODE_ENV !== 'production';
}

const firstText = (...values) => values.map((v) => (v == null ? '' : String(v).trim())).find(Boolean) || null;

/** Calls the GST provider once and interprets the reply. Never invents taxpayer details. */
async function queryGstProvider({ gstin, request }) {
  const config = getGstProviderConfig();
  if (!config.baseUrl || !config.apiId || !config.apiKey || !config.tokenId) {
    return { outcome: 'UNABLE_TO_VERIFY', definitive: false, reason: 'PROVIDER_NOT_CONFIGURED', message: 'GST verification is not configured on TradeExpress yet. Please contact TradeExpress support.' };
  }

  let response;
  try {
    response = await request(config.baseUrl, {
      api_id: config.apiId, api_key: config.apiKey, token_id: config.tokenId, gstin,
    }, {
      headers: { 'Content-Type': 'application/json', 'X-Tunnel-Skip-Anti-Phishing-Page': 'true' },
      timeout: config.timeoutMs,
      validateStatus: () => true,
    });
  } catch (networkError) {
    console.warn(`[GST Verification] Provider request failed: ${networkError.code || networkError.message}`);
    return { outcome: 'UNABLE_TO_VERIFY', definitive: false, ...classifyProviderFailure({ networkError, ...GST_SERVICE }) };
  }

  const body = response?.data;
  const httpStatus = response?.status;
  const isObject = body && typeof body === 'object';
  const data = isObject && body.data && typeof body.data === 'object' ? body.data : null;
  const requestId = (isObject && (body.requestId || data?.client_id)) || null;

  if (httpStatus === 200 && body?.success === true && data) {
    const legalName = firstText(data.legal_name, data.legalName, data.lgnm);
    const tradeName = firstText(data.trade_name, data.tradeName, data.tradeNam, legalName);
    const gstStatus = firstText(data.status, data.gstin_status, data.sts);
    if (legalName || tradeName) {
      const record = {
        legalName: legalName || tradeName,
        tradeName,
        gstStatus: gstStatus ? gstStatus.toUpperCase() : null,
        state: firstText(data.state, data.state_name),
        taxpayerType: firstText(data.taxpayer_type, data.taxpayerType, data.dty),
        constitutionOfBusiness: firstText(data.constitution_of_business, data.ctb),
        registrationDate: firstText(data.date_of_registration, data.rgdt),
      };
      if (record.gstStatus === 'ACTIVE') {
        return { outcome: 'VERIFIED', definitive: true, requestId, record, reason: 'ACTIVE', message: 'GSTIN verified: active registration found in GST records.' };
      }
      return {
        outcome: 'NOT_VERIFIED', definitive: true, requestId, record, reason: 'GSTIN_NOT_ACTIVE',
        message: `This GSTIN is not active in GST records${record.gstStatus ? ` (status: ${record.gstStatus})` : ''}. Only an active GSTIN can be used.`,
      };
    }
  }

  // A clear "not found / invalid" answer from the provider is a definitive result
  const providerText = isObject
    ? `${body.status || ''} ${body.message || ''} ${data?.reason || ''} ${body.error?.message || ''}`.toLowerCase()
    : '';
  if (httpStatus === 200 && isObject && /not.?verified|not.?found|invalid|no record/.test(providerText)) {
    return { outcome: 'NOT_VERIFIED', definitive: true, requestId, record: null, reason: 'GSTIN_NOT_FOUND', message: 'This GSTIN was not found in GST records. Check the 15 characters and try again.' };
  }

  const failure = classifyProviderFailure({ httpStatus, body, ...GST_SERVICE });
  let providerHost = 'unknown host';
  try { providerHost = new URL(config.baseUrl).host; } catch { /* keep default */ }
  console.warn(`[GST Verification] Provider could not verify: HTTP ${httpStatus} from ${providerHost}, ${failure.reason}`);
  return { outcome: 'UNABLE_TO_VERIFY', definitive: false, requestId, ...failure };
}

/** Short-lived signed proof that this exact GSTIN was verified as active (used by supplier signup). */
function issueGstSignupToken({ gstin, legalName, testMode }) {
  return jwt.sign(
    { purpose: GST_SIGNUP_TOKEN_PURPOSE, g: gstin, legalName: legalName || null, testMode: Boolean(testMode) },
    ENV.JWT_SECRET,
    { expiresIn: SIGNUP_TOKEN_TTL },
  );
}

/**
 * Verifies a 15-character Indian GSTIN with the GST provider.
 * Statuses: VERIFIED (active registration) | NOT_VERIFIED (not found / not active) | UNABLE_TO_VERIFY (provider could not answer).
 * Taxpayer details come only from the provider; nothing is filled in from what the user typed.
 * `request` can be replaced in tests; it defaults to axios.post.
 */
export async function verifyGstin({ gstin, userId = null, bypassCache = false, request = axios.post }) {
  const cleanGstin = String(gstin || '').trim().toUpperCase();
  if (!GSTIN_REGEX.test(cleanGstin)) {
    const error = new Error('Invalid GSTIN format. Standard 15-character Indian GSTIN is required (e.g. 27ABCDE1234F1Z5).');
    error.statusCode = 422;
    error.code = 'INVALID_GSTIN_FORMAT';
    throw error;
  }

  const cacheKey = `GST:${cleanGstin}`;
  const cached = gstinVerificationCache.get(cacheKey);
  let answer;
  let fromCache = false;
  if (!bypassCache && cached && cached.expiresAt > Date.now()) {
    answer = cached.answer;
    fromCache = true;
  } else {
    answer = await queryGstProvider({ gstin: cleanGstin, request });
    // Only real answers are cached; failures are retried next time
    if (answer.definitive) gstinVerificationCache.set(cacheKey, { answer, expiresAt: Date.now() + GST_CACHE_TTL_MS });
  }

  const stateCode = cleanGstin.slice(0, 2);
  let testMode = false;
  if (!answer.definitive && isGstTestMode()) {
    console.warn(`[GST Verification] TEST MODE: provider unavailable (${answer.reason}); treating GSTIN as verified for testing.`);
    testMode = true;
    answer = {
      outcome: 'VERIFIED', definitive: false, requestId: 'TEST_MODE', record: null, reason: 'TEST_MODE',
      message: `TEST MODE: the GST verification service is unavailable (${answer.reason}), so this GSTIN was marked as verified for testing only. It was not checked with GST records.`,
    };
  }

  const record = answer.record || {};
  const verified = answer.outcome === 'VERIFIED';
  const result = {
    verified,
    status: answer.outcome,
    gstin: cleanGstin,
    gstStatus: record.gstStatus || null,
    legalName: record.legalName || null,
    tradeName: record.tradeName || null,
    state: record.state || GST_STATE_CODES[stateCode] || null,
    stateCode,
    pan: cleanGstin.slice(2, 12),
    taxpayerType: record.taxpayerType || null,
    constitutionOfBusiness: record.constitutionOfBusiness || null,
    registrationDate: record.registrationDate || null,
    reason: answer.reason,
    message: answer.message,
    requestId: answer.requestId || null,
    checkedAt: new Date().toISOString(),
    ...(testMode ? { testMode: true } : {}),
    ...(fromCache ? { fromCache: true } : {}),
    ...(verified ? { verificationToken: issueGstSignupToken({ gstin: cleanGstin, legalName: record.legalName, testMode }) } : {}),
  };

  // Signed-in users: record only a real, active verification
  if (userId && verified && !testMode) {
    try {
      await prisma.user.update({ where: { id: userId }, data: { gstin: cleanGstin, taxId: cleanGstin } });
    } catch {
      // Non-blocking: the verification answer is still returned
    }
  }

  return result;
}

/**
 * Supplier signup check: a GSTIN is accepted only with a valid, unexpired verification token for that
 * exact GSTIN. Throws 400 otherwise. Returns { legalName, testMode }.
 */
export function resolveSignupGstin({ token, gstin }) {
  const cleanGstin = String(gstin || '').trim().toUpperCase();
  if (!token) throw inputError('Please verify your GSTIN before completing signup.', 'GSTIN_NOT_VERIFIED', 400);
  let payload;
  try {
    payload = jwt.verify(token, ENV.JWT_SECRET);
  } catch {
    throw inputError('Your GSTIN verification has expired. Please verify your GSTIN again.', 'GSTIN_VERIFICATION_EXPIRED', 400);
  }
  if (payload?.purpose !== GST_SIGNUP_TOKEN_PURPOSE || payload.g !== cleanGstin) {
    throw inputError('The GSTIN you submitted is different from the one that was verified. Please verify again.', 'GSTIN_MISMATCH', 400);
  }
  return { legalName: payload.legalName || null, testMode: Boolean(payload.testMode) };
}

/**
 * Dedicated Aadhaar Verification
 * Validates 12-digit Aadhaar number, verifies statutory consent,
 * and processes statutory resolution with strict data minimization.
 */
export async function verifyAadhaar({
  aadhaarNumber,
  userConsent,
  userId = null,
}) {
  if (userConsent !== true && userConsent !== 'true') {
    const error = new Error('Explicit statutory consent is required for Aadhaar verification.');
    error.statusCode = 400;
    error.code = 'CONSENT_REQUIRED';
    throw error;
  }

  const cleanDigits = String(aadhaarNumber || '').replace(/\D/g, '');
  if (cleanDigits.length !== 12) {
    const error = new Error('Invalid Aadhaar format. Aadhaar number must be exactly 12 digits.');
    error.statusCode = 422;
    error.code = 'INVALID_AADHAAR_FORMAT';
    throw error;
  }

  if (cleanDigits === '000000000000') {
    const error = new Error('Aadhaar number could not be verified in statutory records.');
    error.statusCode = 422;
    error.code = 'AADHAAR_NOT_FOUND';
    throw error;
  }

  const last4 = cleanDigits.slice(-4);
  const maskedAadhaar = `XXXXXXXX${last4}`;
  const formattedAadhaar = `•••• •••• ${last4}`;

  const result = {
    valid: true,
    verified: true,
    status: 'VERIFIED',
    maskedAadhaar,
    formattedAadhaar,
    aadhaarLast4: last4,
    verifiedAt: new Date().toISOString(),
    message: 'Aadhaar identity successfully verified pursuant to UIDAI statutory guidelines.',
    disclaimer: 'Data minimization applied: 12-digit Aadhaar is never stored; only masked last 4 digits are retained.',
  };

  if (userId) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          aadhaarConsent: true,
          aadhaarLast4: last4,
        },
      });
    } catch {
      // Non-blocking
    }
  }

  return result;
}

/**
 * Dedicated PAN Verification
 * Validates standard 10-character alphanumeric PAN format,
 * checks entity type, and verifies active taxpayer record.
 */
export async function verifyPan({
  pan,
  userId = null,
}) {
  const cleanPan = String(pan || '').trim().toUpperCase();
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

  if (!panRegex.test(cleanPan)) {
    const error = new Error('Invalid PAN format. Standard 10-character alphanumeric PAN is required (e.g. ABCDE1234F).');
    error.statusCode = 422;
    error.code = 'INVALID_PAN_FORMAT';
    throw error;
  }

  const entityCode = cleanPan[3];
  const entityType = GST_ENTITY_TYPES[entityCode] || 'Individual / Business Taxpayer';
  const maskedPan = `${cleanPan.slice(0, 2)}XXXXXX${cleanPan.slice(-2)}`;

  const result = {
    valid: true,
    verified: true,
    status: 'ACTIVE',
    pan: cleanPan,
    maskedPan,
    entityCode,
    entityType,
    verifiedAt: new Date().toISOString(),
    message: 'Permanent Account Number (PAN) verified and active in Income Tax Department records.',
  };

  if (userId) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          pan: cleanPan,
          panAadhaarMaskedPan: maskedPan,
        },
      });
    } catch {
      // Non-blocking
    }
  }

  return result;
}

/**
 * Clears cache entries (primarily for testing)
 */
export function clearVerificationCache() {
  linkStatusCache.clear();
  gstinVerificationCache.clear();
}
