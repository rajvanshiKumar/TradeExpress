import crypto from 'crypto';
import axios from 'axios';
import prisma from '../config/db.js';

// In-memory cache to prevent duplicate paid provider requests
// Key: SHA-256 hash of Aadhaar number; Value: { result, expiresAt }
const linkStatusCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function hashAadhaar(aadhaarDigits) {
  return crypto.createHash('sha256').update(aadhaarDigits).digest('hex');
}

/**
 * Returns configuration details for the PAN-Aadhaar Link Status provider.
 */
function getProviderConfig() {
  const baseUrl = process.env.PAN_AADHAAR_API_BASE_URL || 'https://2vjjhgz1-4000.inc1.devtunnels.ms/v1/uat/pan/aadhaar-link-status';
  const apiId = process.env.PAN_AADHAAR_API_ID || process.env.api_id;
  const apiKey = process.env.PAN_AADHAAR_API_KEY || process.env.api_key;
  const tokenId = process.env.PAN_AADHAAR_TOKEN_ID || process.env.token_id;
  const timeoutMs = parseInt(process.env.PAN_AADHAAR_API_TIMEOUT_MS, 10) || 15000;

  return {
    baseUrl,
    apiId,
    apiKey,
    tokenId,
    timeoutMs,
  };
}

/**
 * Validates and executes PAN-Aadhaar link status inquiry.
 * Strictly adheres to data minimization: Never logs full Aadhaar/PAN/secrets.
 *
 * Statuses:
 * - NOT_STARTED
 * - PENDING
 * - LINKED
 * - NOT_LINKED
 * - UNABLE_TO_VERIFY
 */
/**
 * Compares an entered PAN with a provider masked PAN (e.g. "MRXXXXXX1F" or "XXXXXXXXXX").
 * Returns true if all visible unmasked characters match the entered PAN.
 */
function doesPanMatchMaskedPan(enteredPan, maskedPan) {
  if (!enteredPan || !maskedPan) return true;
  const cleanEntered = String(enteredPan).trim().toUpperCase();
  const cleanMasked = String(maskedPan).trim().toUpperCase();
  if (cleanEntered.length !== 10 || cleanMasked.length !== 10) return false;

  for (let i = 0; i < 10; i++) {
    const m = cleanMasked[i];
    const e = cleanEntered[i];
    if (m !== 'X' && m !== '*' && m !== '•') {
      if (m !== e) return false;
    }
  }
  return true;
}

export async function checkPanAadhaarLinkStatus({
  aadhaarNumber,
  pan = null,
  userConsent,
  userId = null,
  bypassCache = false,
}) {
  // 1. Consent verification (Statutory requirement under DPDP / Aadhaar Act)
  if (userConsent !== true && userConsent !== 'true') {
    const error = new Error('Explicit consent is required to verify PAN–Aadhaar link status.');
    error.statusCode = 400;
    error.code = 'CONSENT_REQUIRED';
    throw error;
  }

  // 2. Input validation
  const cleanDigits = String(aadhaarNumber || '').replace(/\D/g, '');
  if (cleanDigits.length !== 12) {
    const error = new Error('Invalid Aadhaar format. Aadhaar number must be exactly 12 digits.');
    error.statusCode = 422;
    error.code = 'INVALID_AADHAAR_FORMAT';
    throw error;
  }

  const cleanPan = pan ? String(pan).trim().toUpperCase() : null;

  // 3. Cache / Deduplication check to prevent duplicate paid requests
  const cacheKey = hashAadhaar(`${cleanDigits}:${cleanPan || ''}`);
  if (!bypassCache) {
    const cached = linkStatusCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        ...cached.result,
        fromCache: true,
      };
    }
  }

  // 4. Provider credentials check
  const config = getProviderConfig();
  if (!config.apiId || !config.apiKey || !config.tokenId) {
    const error = new Error(
      'PAN-Aadhaar verification provider credentials are not configured. Please set PAN_AADHAAR_API_ID, PAN_AADHAAR_API_KEY, and PAN_AADHAAR_TOKEN_ID.'
    );
    error.statusCode = 503;
    error.code = 'PROVIDER_CONFIG_MISSING';
    throw error;
  }

  // 5. Send Provider Request
  // Data minimization: Request body sends credentials and Aadhaar digits over HTTPS.
  const payload = {
    api_id: config.apiId,
    api_key: config.apiKey,
    token_id: config.tokenId,
    aadhaarNumber: cleanDigits,
  };

  let providerResponse = null;
  let status = 'UNABLE_TO_VERIFY';
  let linked = false;
  let maskedPan = null;
  let reason = null;
  let providerRequestId = null;
  let displayMessage = '';

  try {
    const response = await axios.post(config.baseUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: config.timeoutMs,
      validateStatus: () => true, // inspect all status codes
    });

    providerResponse = response.data;
    const httpStatus = response.status;

    if (httpStatus === 200 && providerResponse?.success === true) {
      const respData = providerResponse.data || {};
      providerRequestId = providerResponse.requestId || respData.client_id || null;
      reason = respData.reason || (respData.linking_status ? 'linked' : 'not_linked');

      if (respData.linking_status === true || reason === 'linked') {
        const returnedMasked = respData.masked_pan || 'XXXXXXXXXX';
        const matchesEnteredPan = doesPanMatchMaskedPan(cleanPan, returnedMasked);

        if (cleanPan && !matchesEnteredPan) {
          status = 'NOT_LINKED';
          linked = false;
          maskedPan = returnedMasked;
          reason = 'pan_mismatch';
          displayMessage = `The entered PAN does not match the PAN linked to this Aadhaar number in Income Tax records (${returnedMasked}).`;
        } else {
          status = 'LINKED';
          linked = true;
          maskedPan = returnedMasked;
          displayMessage = 'Aadhaar is linked with PAN according to Income Tax statutory records.';
        }
      } else {
        status = 'NOT_LINKED';
        linked = false;
        maskedPan = null;
        displayMessage = 'Aadhaar is not linked with PAN. Please link PAN with Aadhaar on the Income Tax e-filing portal.';
      }
    } else if (httpStatus === 422) {
      status = 'UNABLE_TO_VERIFY';
      linked = false;
      reason = providerResponse?.error?.code || 'VALIDATION_FAILED';
      displayMessage = providerResponse?.error?.message || 'Invalid identification format provided to verification provider.';
    } else if (httpStatus === 401 || httpStatus === 403) {
      status = 'UNABLE_TO_VERIFY';
      linked = false;
      reason = 'PROVIDER_AUTH_ERROR';
      displayMessage = 'Verification service authentication error with provider.';
    } else {
      status = 'UNABLE_TO_VERIFY';
      linked = false;
      reason = providerResponse?.error?.code || 'PROVIDER_ERROR';
      displayMessage = providerResponse?.error?.message || 'Verification provider was unable to process the link status request.';
    }
  } catch (err) {
    status = 'UNABLE_TO_VERIFY';
    linked = false;
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      reason = 'PROVIDER_TIMEOUT';
      displayMessage = 'Verification provider timed out. Please retry in a few moments.';
    } else {
      reason = 'PROVIDER_NETWORK_ERROR';
      displayMessage = 'Could not establish connection to verification provider service.';
    }
  }

  const result = {
    success: status === 'LINKED' || status === 'NOT_LINKED',
    status, // NOT_STARTED, PENDING, LINKED, NOT_LINKED, UNABLE_TO_VERIFY
    linked,
    maskedPan,
    reason,
    requestId: providerRequestId,
    verifiedAt: new Date().toISOString(),
    message: displayMessage,
    // Explicit compliance disclaimer:
    disclaimer: 'Link status indicates ITD PAN-Aadhaar linkage only. This does not constitute full PAN KYC, Aadhaar identity authentication, GST verification, or Gold Supplier approval.',
  };

  // Cache successful provider responses (both LINKED and NOT_LINKED)
  if (status === 'LINKED' || status === 'NOT_LINKED') {
    linkStatusCache.set(cacheKey, {
      result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  // 6. If user is authenticated, update database record
  if (userId) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          panAadhaarStatus: status,
          panAadhaarLinked: linked,
          panAadhaarCheckedAt: new Date(),
          panAadhaarMaskedPan: maskedPan,
        },
      });
    } catch {
      // Non-blocking if database update encounters an issue
    }
  }

  return result;
}

/**
 * Clears cache entry (primarily for testing)
 */
export function clearVerificationCache() {
  linkStatusCache.clear();
}
