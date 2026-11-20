import axios from 'axios';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import { ENV } from '../config/env.js';
import { aadhaarHolderDetails } from '../utils/aadhaarResponse.js';
import { classifyProviderFailure, DELETED_ACCOUNT_EMAIL_DOMAIN, isValidAadhaarNumber, secretHash } from './verificationService.js';
import { isIdentityBlocked, suspendedIdentityError } from './identityBlockService.js';

/*
 * Aadhaar OTP (OKYC) verification through the same provider as the PAN–Aadhaar link check.
 *
 *   1. sendAadhaarOtp    -> provider /aadhaar/otp/generate  (UIDAI sends an OTP to the Aadhaar-linked mobile)
 *   2. verifyAadhaarOtp  -> provider /aadhaar/otp/verify    (returns the Aadhaar holder's details)
 *
 * AADHAAR_API_MODE picks the provider environment: "uat" (provider returns simulated, auto-verified answers for
 * testing) or "prod" (real UIDAI verification, uses paid credits). Anything else means prod.
 * The full verify response is saved in aadhaar_verifications.responseData; the Aadhaar number is never stored.
 */

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_AFTER_SECONDS = 45;
const MAX_OTP_ATTEMPTS = 5;
const TOKEN_TTL = '30m';
const TOKEN_PURPOSE = 'AADHAAR_OTP_VERIFIED';
const SERVICE = { service: 'Aadhaar verification service', inputs: 'Aadhaar details' };

function aadhaarError(message, code, statusCode = 422, extra = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.errorCode = code; // the API error handler sends errorCode to the browser as "code"
  Object.assign(error, extra);
  return error;
}

const aadhaarHash = (digits) => secretHash(`aadhaar:${digits}`);

/** Provider settings. Credentials are shared with the PAN–Aadhaar link check unless AADHAAR_* overrides are set. */
export function getAadhaarProviderConfig() {
  const mode = String(process.env.AADHAAR_API_MODE || 'prod').trim().toLowerCase() === 'uat' ? 'uat' : 'prod';
  // Full URLs per mode from .env (AADHAAR_UAT_GENERATE_URL, AADHAAR_PROD_VERIFY_URL, ...). If missing, they are
  // built from AADHAAR_API_BASE_URL (provider root up to /v1) or from the PAN–Aadhaar URL's root.
  const envUrl = (step) => String(process.env[`AADHAAR_${mode.toUpperCase()}_${step}_URL`] || '').trim();
  let base = String(process.env.AADHAAR_API_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!base) {
    const panUrl = process.env.PAN_AADHAAR_PROD_URL || process.env.PAN_AADHAAR_UAT_URL || process.env.PAN_AADHAAR_API_BASE_URL || '';
    const match = String(panUrl).trim().match(/^(https?:\/\/[^/]+\/v\d+)\//i);
    base = match ? match[1] : '';
  }
  return {
    mode,
    generateUrl: envUrl('GENERATE') || (base ? `${base}/${mode}/aadhaar/otp/generate` : ''),
    verifyUrl: envUrl('VERIFY') || (base ? `${base}/${mode}/aadhaar/otp/verify` : ''),
    apiId: process.env.AADHAAR_API_ID || process.env.PAN_AADHAAR_API_ID || process.env.api_id,
    apiKey: process.env.AADHAAR_API_KEY || process.env.PAN_AADHAAR_API_KEY || process.env.api_key,
    tokenId: process.env.AADHAAR_TOKEN_ID || process.env.PAN_AADHAAR_TOKEN_ID || process.env.token_id,
    timeoutMs: Math.min(parseInt(process.env.AADHAAR_API_TIMEOUT_MS || process.env.PAN_AADHAAR_API_TIMEOUT_MS, 10) || 20000, 30000),
  };
}

function requireConfig() {
  const config = getAadhaarProviderConfig();
  if (!config.generateUrl || !config.apiId || !config.apiKey || !config.tokenId) {
    throw aadhaarError('Aadhaar verification is not configured on TradeExpress yet. Please contact TradeExpress support.', 'PROVIDER_NOT_CONFIGURED', 503);
  }
  return config;
}

async function callProvider(url, payload, config, request) {
  try {
    const response = await request(url, { api_id: config.apiId, api_key: config.apiKey, token_id: config.tokenId, ...payload }, {
      headers: { 'Content-Type': 'application/json', 'X-Tunnel-Skip-Anti-Phishing-Page': 'true' },
      timeout: config.timeoutMs,
      validateStatus: () => true,
    });
    return { httpStatus: response?.status, body: response?.data && typeof response.data === 'object' ? response.data : null };
  } catch (networkError) {
    console.warn(`[Aadhaar OTP] Provider request failed: ${networkError.code || networkError.message}`);
    return { networkError };
  }
}

/** A provider reply that clearly answers "no" (wrong OTP, invalid Aadhaar, ...) rather than failing to answer. */
/**
 * The provider answers in two formats: { success: true, status: 'VERIFIED', ... } (relay) or
 * { status: { code: 200, type: 'success' }, ... } (direct, no "success" field). An explicit success: false always fails.
 */
function providerSucceeded(body) {
  if (!body || typeof body !== 'object' || body.success === false) return false;
  if (body.success === true) return true;
  const status = body.status;
  return Boolean(status && typeof status === 'object'
    && String(status.type || '').toLowerCase() === 'success'
    && (status.code === undefined || Number(status.code) === 200));
}

const isDefinitiveRejection = ({ httpStatus, body }) =>
  Boolean(body) && (httpStatus === 400 || httpStatus === 422 || (httpStatus === 200 && !providerSucceeded(body)));

const providerMessage = (body) => String(body?.error?.message || body?.message || body?.data?.message || '').slice(0, 200);

function unavailable(result) {
  const failure = classifyProviderFailure({ ...result, ...SERVICE });
  console.warn(`[Aadhaar OTP] Provider could not answer: HTTP ${result.httpStatus ?? '-'}, ${failure.reason}`);
  return aadhaarError(failure.message, failure.reason, failure.reason === 'PROVIDER_RATE_LIMITED' ? 429 : 503);
}

function validateAadhaarInput(aadhaarNumber, mode) {
  const digits = String(aadhaarNumber || '').replace(/\D/g, '');
  if (digits.length !== 12) throw aadhaarError('Aadhaar number must be exactly 12 digits.', 'INVALID_AADHAAR_FORMAT');
  // Checked locally so a mistyped number never spends a paid credit; UAT sample numbers may not pass it
  if (mode === 'prod' && !isValidAadhaarNumber(digits)) {
    throw aadhaarError('This Aadhaar number is not valid (its last digit does not match). Please check all 12 digits and try again.', 'INVALID_AADHAAR_NUMBER');
  }
  return digits;
}

/**
 * Step 1: asks the provider to send an OTP to the mobile linked with this Aadhaar.
 * Returns { verificationId, aadhaarLast4, expiresInSeconds, resendAfterSeconds, environment, simulated, message }.
 */
export async function sendAadhaarOtp({ aadhaarNumber, userConsent, request = axios.post, db = prisma }) {
  if (userConsent !== true && userConsent !== 'true') {
    throw aadhaarError('Your consent is required to verify your Aadhaar.', 'CONSENT_REQUIRED', 400);
  }
  const config = requireConfig();
  const digits = validateAadhaarInput(aadhaarNumber, config.mode);
  const hash = aadhaarHash(digits);
  // Checked before any OTP (and paid credit): one Aadhaar belongs to one TradeExpress account
  await assertAadhaarNotRegistered({ aadhaarNumber: digits, db });

  const recent = await db.aadhaarVerification.findFirst({
    where: { aadhaarHash: hash, createdAt: { gt: new Date(Date.now() - RESEND_AFTER_SECONDS * 1000) } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (recent) {
    const wait = Math.max(1, RESEND_AFTER_SECONDS - Math.floor((Date.now() - recent.createdAt.getTime()) / 1000));
    throw aadhaarError(`An OTP was just sent. Please wait ${wait} seconds before requesting another.`, 'OTP_COOLDOWN', 429, { retryAfterSeconds: wait });
  }

  const result = await callProvider(config.generateUrl, { aadhaarNumber: digits, consent: true }, config, request);
  const { body } = result;
  const referenceId = body?.data?.referenceId || body?.data?.reference_id || body?.referenceId;
  if (result.httpStatus === 200 && providerSucceeded(body) && referenceId) {
    const environment = String(body.environment || config.mode).toLowerCase();
    const record = await db.aadhaarVerification.create({
      data: {
        aadhaarHash: hash,
        aadhaarLast4: digits.slice(-4),
        referenceId: String(referenceId),
        environment,
        providerRequestId: body.requestId ? String(body.requestId) : null,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
      select: { id: true },
    });
    return {
      verificationId: record.id,
      aadhaarLast4: digits.slice(-4),
      expiresInSeconds: OTP_TTL_MS / 1000,
      resendAfterSeconds: RESEND_AFTER_SECONDS,
      environment,
      simulated: body.simulated === true,
      message: `OTP sent to the mobile number linked with Aadhaar ending ${digits.slice(-4)}.`,
    };
  }
  if (!result.networkError && isDefinitiveRejection(result)) {
    const reason = providerMessage(body);
    throw aadhaarError(reason ? `Could not send the Aadhaar OTP: ${reason}` : 'Could not send the Aadhaar OTP. Please check the Aadhaar number.', 'AADHAAR_OTP_REJECTED');
  }
  throw unavailable(result);
}

function issueToken({ id, hash, environment }) {
  return jwt.sign({ purpose: TOKEN_PURPOSE, v: id, a: hash, env: environment }, ENV.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

const isVerifiedResponse = (body) =>
  providerSucceeded(body)
  // The relay format says status "VERIFIED"; the direct format carries status as an object ({ code, type })
  && (typeof body.status !== 'string' || body.status.toUpperCase() === 'VERIFIED')
  && body.data && typeof body.data === 'object'
  && (!body.data.status || /success/i.test(String(body.data.status)));

/**
 * Step 2: checks the OTP with the provider and saves its full response.
 * Returns { verified: true, verificationToken, fullName, aadhaarLast4, environment, simulated }.
 */
export async function verifyAadhaarOtp({ verificationId, otp, aadhaarNumber, request = axios.post, db = prisma }) {
  const code = String(otp || '').trim();
  if (!/^\d{6}$/.test(code)) throw aadhaarError('Enter the 6-digit OTP sent to your Aadhaar-linked mobile.', 'INVALID_OTP_FORMAT', 400);
  const digits = String(aadhaarNumber || '').replace(/\D/g, '');
  const record = verificationId
    ? await db.aadhaarVerification.findUnique({ where: { id: String(verificationId) } })
    : null;
  if (!record || record.aadhaarHash !== aadhaarHash(digits)) {
    throw aadhaarError('This OTP request was not found for this Aadhaar number. Please request a new OTP.', 'OTP_REQUEST_NOT_FOUND', 404);
  }
  // An OTP can be used once: a verified request never hands out another token without a new OTP
  if (record.status === 'VERIFIED') {
    throw aadhaarError('This OTP has already been used. Please request a new OTP.', 'AADHAAR_OTP_ALREADY_USED', 409);
  }
  if (record.status === 'FAILED' || record.attempts >= MAX_OTP_ATTEMPTS) {
    throw aadhaarError('Too many incorrect OTP attempts. Please request a new OTP.', 'OTP_LOCKED', 429);
  }
  if (record.expiresAt.getTime() < Date.now()) {
    throw aadhaarError('This OTP has expired. Please request a new OTP.', 'OTP_EXPIRED', 410);
  }

  // Count the attempt before calling the provider, so parallel requests cannot exceed the limit
  const claimed = await db.aadhaarVerification.updateMany({
    where: { id: record.id, status: 'OTP_SENT', attempts: { lt: MAX_OTP_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (!claimed.count) throw aadhaarError('Too many incorrect OTP attempts. Please request a new OTP.', 'OTP_LOCKED', 429);

  const config = requireConfig();
  const result = await callProvider(config.verifyUrl, { referenceId: record.referenceId, otp: code }, config, request);
  const { body } = result;

  if (result.httpStatus === 200 && isVerifiedResponse(body)) {
    const environment = String(body.environment || record.environment).toLowerCase();
    await db.aadhaarVerification.update({
      where: { id: record.id },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        environment,
        providerRequestId: body.requestId ? String(body.requestId) : record.providerRequestId,
        lastError: null,
        // Saved as readable JSON text (owner's decision: no encryption)
        responseData: JSON.stringify(body),
      },
    });
    return {
      verified: true,
      verificationToken: issueToken({ id: record.id, hash: record.aadhaarHash, environment }),
      fullName: body.data.full_name ? String(body.data.full_name) : null,
      aadhaarLast4: record.aadhaarLast4,
      environment,
      simulated: body.simulated === true,
      // Shown to the person who just verified (their own Aadhaar details and photo), then the provider's full reply
      holder: aadhaarHolderDetails(body),
      providerResponse: body,
      message: environment === 'uat' ? 'Aadhaar verified (UAT test mode, simulated response).' : 'Aadhaar verified with UIDAI.',
    };
  }

  if (!result.networkError && isDefinitiveRejection(result)) {
    const reason = providerMessage(body);
    const attemptsLeft = MAX_OTP_ATTEMPTS - (record.attempts + 1);
    await db.aadhaarVerification.update({
      where: { id: record.id },
      data: { lastError: reason || 'OTP rejected', ...(attemptsLeft <= 0 ? { status: 'FAILED' } : {}) },
    });
    throw aadhaarError(
      `${reason || 'The OTP is incorrect.'}${attemptsLeft > 0 ? ` ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.` : ' Please request a new OTP.'}`,
      attemptsLeft > 0 ? 'OTP_INVALID' : 'OTP_LOCKED',
      attemptsLeft > 0 ? 422 : 429,
    );
  }

  // The provider did not answer: give the attempt back so an outage does not lock the user out
  await db.aadhaarVerification.update({ where: { id: record.id }, data: { attempts: { decrement: 1 } } }).catch(() => {});
  throw unavailable(result);
}

/**
 * One Aadhaar, one account: refuses an Aadhaar already used by a completed signup (other than excludeUserId).
 */
export async function assertAadhaarNotRegistered({ aadhaarNumber, excludeUserId = null, db = prisma }) {
  const digits = String(aadhaarNumber || '').replace(/\D/g, '');
  if (digits.length !== 12) return;
  // An Aadhaar of a suspended account (even one deleted later) can never be used again
  if (await isIdentityBlocked('AADHAAR', aadhaarHash(digits), db)) throw suspendedIdentityError('AADHAAR');
  const owner = await db.aadhaarVerification.findFirst({
    where: {
      aadhaarHash: aadhaarHash(digits),
      userId: excludeUserId ? { not: null, notIn: [excludeUserId] } : { not: null },
      // A deleted (anonymised) account no longer holds the Aadhaar
      user: { NOT: { email: { endsWith: DELETED_ACCOUNT_EMAIL_DOMAIN } } },
    },
    select: { id: true, user: { select: { status: true, isActive: true } } },
  });
  if (owner?.user && (owner.user.status === 'SUSPENDED' || owner.user.isActive === false)) throw suspendedIdentityError('AADHAAR');
  if (owner) {
    throw aadhaarError('This Aadhaar is already registered with another TradeExpress account.', 'AADHAAR_ALREADY_REGISTERED', 409);
  }
}

/**
 * Checks an Aadhaar verification token for this exact Aadhaar number and that it has not been used by another
 * signup. Returns { verificationId, environment }. Throws 400 otherwise.
 */
export async function resolveAadhaarVerification({ token, aadhaarNumber, db = prisma }) {
  const digits = String(aadhaarNumber || '').replace(/\D/g, '');
  if (!token) throw aadhaarError('Please verify your Aadhaar with OTP first.', 'AADHAAR_NOT_VERIFIED', 400);
  let payload;
  try {
    payload = jwt.verify(token, ENV.JWT_SECRET);
  } catch {
    throw aadhaarError('Your Aadhaar verification has expired. Please verify your Aadhaar with OTP again.', 'AADHAAR_VERIFICATION_EXPIRED', 400);
  }
  if (payload?.purpose !== TOKEN_PURPOSE || payload.a !== aadhaarHash(digits)) {
    throw aadhaarError('The Aadhaar number you submitted is different from the one verified with OTP. Please verify again.', 'AADHAAR_MISMATCH', 400);
  }
  const record = await db.aadhaarVerification.findUnique({ where: { id: payload.v }, select: { id: true, status: true, usedAt: true, environment: true } });
  if (!record || record.status !== 'VERIFIED' || record.usedAt) {
    throw aadhaarError('This Aadhaar verification is no longer valid. Please verify your Aadhaar with OTP again.', 'AADHAAR_VERIFICATION_USED', 400);
  }
  return { verificationId: record.id, environment: record.environment };
}

/** Links a verified Aadhaar record, and the PAN checks made with it, to the account just created with it (single use). */
export async function attachAadhaarVerification({ verificationId, userId, db = prisma }) {
  const updated = await db.aadhaarVerification.updateMany({
    where: { id: verificationId, usedAt: null },
    data: { userId, usedAt: new Date() },
  });
  if (updated.count === 1 && db.panAadhaarLinkCheck) {
    await db.panAadhaarLinkCheck.updateMany({ where: { aadhaarVerificationId: verificationId, userId: null }, data: { userId } });
  }
  return updated.count === 1;
}
