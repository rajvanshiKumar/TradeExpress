import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import { ENV } from '../config/env.js';
import * as msg91Service from './msg91Service.js';
import * as powerstextService from './powerstextService.js';
import {
  AUTH_ERROR_CODES,
  AUTH_MESSAGES,
  assertCanSignIn,
  authError,
  canResumeSignup,
  existingAccountError,
  isSignupComplete,
  normalizePublicRole,
  otpCooldownError,
} from '../utils/accountStatus.js';

// Dialing rules aligned with frontend COUNTRY_PHONE_RULES
const DIAL_RULES = {
  India: { dial: '91', lengths: [10], pattern: /^[6-9]\d{9}$/, example: '98765 43210' },
  'United States': { dial: '1', lengths: [10], pattern: /^[2-9]\d{2}[2-9]\d{6}$/, example: '212 555 0147' },
  Canada: { dial: '1', lengths: [10], pattern: /^[2-9]\d{2}[2-9]\d{6}$/, example: '416 555 0147' },
  'United Kingdom': { dial: '44', lengths: [10], pattern: /^7\d{9}$/, example: '7400 123456' },
  'United Arab Emirates': { dial: '971', lengths: [9], pattern: /^5[0-9]\d{7}$/, example: '50 123 4567' },
  'Saudi Arabia': { dial: '966', lengths: [9], pattern: /^5\d{8}$/, example: '50 123 4567' },
  Singapore: { dial: '65', lengths: [8], pattern: /^[89]\d{7}$/, example: '8123 4567' },
  Australia: { dial: '61', lengths: [9], pattern: /^4\d{8}$/, example: '412 345 678' },
  Germany: { dial: '49', lengths: [10, 11], pattern: /^1[5-7]\d{8,9}$/, example: '1512 3456789' },
  France: { dial: '33', lengths: [9], pattern: /^[67]\d{8}$/, example: '6 12 34 56 78' },
  Italy: { dial: '39', lengths: [9, 10], pattern: /^3\d{8,9}$/, example: '312 345 6789' },
  Spain: { dial: '34', lengths: [9], pattern: /^[67]\d{8}$/, example: '612 34 56 78' },
  Netherlands: { dial: '31', lengths: [9], pattern: /^6\d{8}$/, example: '6 12345678' },
  'South Africa': { dial: '27', lengths: [9], pattern: /^[6-8]\d{8}$/, example: '71 123 4567' },
  Brazil: { dial: '55', lengths: [11], pattern: /^\d{2}9\d{8}$/, example: '11 91234 5678' },
  Mexico: { dial: '52', lengths: [10], pattern: /^\d{10}$/, example: '55 1234 5678' },
  Japan: { dial: '81', lengths: [10], pattern: /^[789]0\d{8}$/, example: '90 1234 5678' },
  'South Korea': { dial: '82', lengths: [9, 10], pattern: /^1[0-9]\d{7,8}$/, example: '10 1234 5678' },
  China: { dial: '86', lengths: [11], pattern: /^1[3-9]\d{9}$/, example: '138 0013 8000' },
  Vietnam: { dial: '84', lengths: [9], pattern: /^[35789]\d{8}$/, example: '912 345 678' },
  Bangladesh: { dial: '880', lengths: [10], pattern: /^1[3-9]\d{8}$/, example: '1712 345678' },
  'Türkiye': { dial: '90', lengths: [10], pattern: /^5\d{9}$/, example: '532 123 4567' },
  Kenya: { dial: '254', lengths: [9], pattern: /^[17]\d{8}$/, example: '712 345678' },
  Nigeria: { dial: '234', lengths: [10], pattern: /^[789][01]\d{8}$/, example: '802 123 4567' },
};

const RESEND_COOLDOWN_SECONDS = 60;
const MAX_HOURLY_ATTEMPTS = 5;
const MAX_VERIFY_ATTEMPTS = 5;
// The "too many codes" limit counts sends within this window; after it passes the count starts again
const RESEND_WINDOW_MS = 60 * 60 * 1000;

/** The pending entry's resend window if it is still running, otherwise null (a fresh window starts). */
/**
 * Ends a pending email code after too many wrong attempts. The entry stays in its store (only the code hash is
 * removed), so requesting a new code still waits for the resend cooldown and counts toward the hourly limit.
 */
export function lockOtpSession(session) {
  session.otpHash = null;
  session.locked = true;
  const error = new Error('Too many incorrect verification attempts. Please request a new OTP.');
  error.statusCode = 429;
  return error;
}

/**
 * Diagnostic line for an OTP send / check. Never includes the code, its hash or the full email / mobile:
 * only a masked identifier, the outcome, how old the latest code is, and how many codes were sent.
 */
function logOtpCheck(flow, identifier, outcome, session = null) {
  const id = String(identifier || '');
  const masked = id.includes('@') ? id.replace(/^(.).*(@.*)$/, '$1***$2') : `******${id.replace(/\D/g, '').slice(-4)}`;
  const age = session?.lastSentAt ? `, latest code sent ${Math.round((Date.now() - session.lastSentAt) / 1000)}s ago` : '';
  const sends = session && Number.isFinite(session.resendCount) ? `, codes sent in this window: ${session.resendCount + 1}` : '';
  console.info(`[OTP] ${flow} ${masked}: ${outcome}${age}${sends}`);
}

export const activeResendWindow = (entry) =>
  entry && entry.windowStartedAt && Date.now() - entry.windowStartedAt < RESEND_WINDOW_MS ? entry : null;
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
// Account Settings codes expire sooner, matching CODE_TTL_MS in accountSecurityService (5 minutes)
export const ACCOUNT_CHANGE_OTP_EXPIRY_MS = 5 * 60 * 1000;
export const MOBILE_OTP_PURPOSES = ['PHONE_CHANGE'];
const VERIFICATION_TOKEN_VALIDITY_MS = 15 * 60 * 1000; // 15 minutes to complete registration
// Expired in-memory OTP sessions are kept briefly so users see "expired" rather than "not requested"
const EXPIRED_SESSION_GRACE_MS = 30 * 60 * 1000;

function generateOtp() {
  let otp;
  do {
    otp = String(crypto.randomInt(100000, 1000000));
  } while (otp === '123456');
  return otp;
}

function hashesMatch(candidate, expected) {
  if (typeof candidate !== 'string' || typeof expected !== 'string' || candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
}

function hashOtp(otp) {
  return crypto.createHmac('sha256', ENV.JWT_SECRET).update(String(otp)).digest('hex');
}

/** The email helpers report failures instead of throwing; a code that was never sent must not be reported as sent. */
function assertEmailSent(result) {
  if (result && result.success === false) {
    const error = new Error('We could not send the verification email right now. Please try again in a moment.');
    error.statusCode = 502;
    throw error;
  }
}

/** Finds the account that owns a mobile number or official phone, in any of its stored formats. */
function findUserByMobile(normalized) {
  const phoneValues = [...new Set([
    normalized.formattedPhone,
    normalized.msg91Mobile,
    `+${normalized.msg91Mobile}`,
    normalized.national,
  ].filter(Boolean))];
  return prisma.user.findFirst({
    where: {
      OR: [
        { phone: { in: phoneValues } },
        ...(normalized.national ? [
          { phone: { endsWith: normalized.national } },
          { businessPhone: normalized.national },
          { businessPhone: { endsWith: normalized.national } },
        ] : []),
        { businessPhone: { in: phoneValues } },
      ],
    },
    select: { id: true, role: true, name: true, phone: true, company: true, passwordHash: true, googleId: true, isActive: true, status: true, statusReason: true },
  });
}

/**
 * Signup OTPs may only go to a number that is free, or that belongs to an unfinished signup of the same role.
 * When the signup form names its role (BUYER / SUPPLIER), a number already used by the other role is refused
 * before any OTP is sent, even if that other signup is unfinished: one mobile number, one account type.
 */
async function assertMobileAvailableForSignup(normalized, role) {
  const existingUser = await findUserByMobile(normalized);
  if (!existingUser) return;
  const requestedRole = normalizePublicRole(role);
  if (requestedRole && existingUser.role !== requestedRole) {
    const message = ['BUYER', 'SUPPLIER'].includes(existingUser.role)
      ? AUTH_MESSAGES.mobileRegisteredAsOtherRole(existingUser.role)
      : AUTH_MESSAGES.MOBILE_EXISTS; // never reveal an administrator account
    throw authError(message, 409, AUTH_ERROR_CODES.ROLE_MISMATCH, { accountRole: existingUser.role });
  }
  if (isSignupComplete(existingUser)) {
    throw authError(AUTH_MESSAGES.MOBILE_EXISTS, 409, AUTH_ERROR_CODES.ACCOUNT_EXISTS, {
      accountRole: existingUser.role,
    });
  }
}

const LOCAL_DATABASE_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

/** True when DATABASE_URL points at a MySQL server on this computer (an isolated local database). */
function usesLocalDatabase() {
  try {
    const url = String(process.env.DATABASE_URL || '').trim().replace(/^["']|["']$/g, '');
    return LOCAL_DATABASE_HOSTS.includes(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Development test code 123456 for testing. Accepted when:
 *  - NODE_ENV is not "production" (never on the live production backend)
 *  - DEV_OTP_ENABLED is not explicitly "false"
 * The code is never returned in API responses. Account Settings and delivery codes always need the real code.
 */
/**
 * LOCAL TESTING ONLY (remove before hosting): the fixed code 123456 is accepted only when
 * NODE_ENV is not production, DEV_OTP_ENABLED is not 'false', and the server is NOT running on Render
 * (Render sets RENDER=true on every service), so it can never work on the hosted site.
 */
export function isTestOtpEnvironment() {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.RENDER) return false;
  return process.env.DEV_OTP_ENABLED !== 'false';
}

export function isDevOtpAllowed(otp) {
  return isTestOtpEnvironment() && String(otp || '').trim() === '123456';
}

/** True when the country has dialing rules (and so can be validated and stored). */
export const isSupportedCountry = (country) => Object.prototype.hasOwnProperty.call(DIAL_RULES, country);

/**
 * Normalizes user-entered mobile number into MSG91 standard digits and international formatted string.
 */
export function normalizeMobile(value, country = 'India') {
  const rule = DIAL_RULES[country] || DIAL_RULES['India'];
  let digits = String(value ?? '').trim().replace(/[\s().-]/g, '');

  if (!rule || !/^\+?\d+$/.test(digits)) {
    return { ok: false, msg91Mobile: '', formattedPhone: '', dial: rule?.dial || '91' };
  }

  if (digits.startsWith('+')) {
    if (!digits.startsWith(`+${rule.dial}`)) return { ok: false, msg91Mobile: '', formattedPhone: '', dial: rule.dial };
    digits = digits.slice(rule.dial.length + 1);
  } else if (digits.startsWith(`00${rule.dial}`)) {
    digits = digits.slice(rule.dial.length + 2);
  } else if (digits.length > Math.max(...rule.lengths) && digits.startsWith(rule.dial)) {
    digits = digits.slice(rule.dial.length);
  }

  if (digits.startsWith('0') && !rule.lengths.includes(digits.length)) {
    digits = digits.slice(1);
  }

  const ok = rule.lengths.includes(digits.length) && rule.pattern.test(digits);
  const msg91Mobile = `${rule.dial}${digits}`;
  const formattedPhone = ok ? `+${rule.dial} ${digits}` : '';

  return {
    ok,
    national: digits,
    msg91Mobile,
    formattedPhone,
    dial: rule.dial,
  };
}

/**
 * Requests sending an OTP to the given mobile number.
 * `purpose: 'PHONE_CHANGE'` (Account Settings → Change Phone Number) gives the shorter account-settings
 * expiry; signup verification keeps the standard expiry.
 */
async function requestMobileOtpUnlocked({ phone, country = 'India', purpose, role }) {
  const expiryMs = purpose === 'PHONE_CHANGE' ? ACCOUNT_CHANGE_OTP_EXPIRY_MS : OTP_EXPIRY_MS;
  const expiryMinutes = Math.round(expiryMs / 60000);
  const normalized = normalizeMobile(phone, country);
  if (!normalized.ok) {
    const error = new Error(`Enter a valid ${country} mobile number.`);
    error.statusCode = 400;
    throw error;
  }

  const { msg91Mobile, formattedPhone } = normalized;

  // Both lookups go to the remote database, so they run together; the account check still takes precedence
  const [account, verification] = await Promise.allSettled([
    assertMobileAvailableForSignup(normalized, role),
    prisma.mobileVerification.findUnique({ where: { phone: formattedPhone } }),
  ]);

  // 1. Existing registered account conflict (before any cooldown)
  if (account.status === 'rejected') throw account.reason;
  if (verification.status === 'rejected') throw verification.reason;
  const existingVerification = verification.value;

  // 2. Check rate limits & resend cooldown in MobileVerification

  if (existingVerification) {
    const elapsedSeconds = Math.floor((Date.now() - new Date(existingVerification.lastSentAt).getTime()) / 1000);
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      throw otpCooldownError(RESEND_COOLDOWN_SECONDS - elapsedSeconds);
    }

    // Check hourly limit
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (existingVerification.updatedAt > oneHourAgo && existingVerification.resendCount >= MAX_HOURLY_ATTEMPTS) {
      const error = new Error('Too many OTP requests for this mobile number. Please try again after 1 hour.');
      error.statusCode = 429;
      throw error;
    }
  }

  // 3. Dispatch OTP through configured provider (PowersText or MSG91)
  const isPowersText = Boolean(process.env.SMS_API_URL || process.env.SMS_SENDER_ID);
  let sessionToken = null;

  if (isPowersText) {
    const code = generateOtp();
    const newHash = hashOtp(code);
    let tokenList = [newHash];
    if (existingVerification?.token && existingVerification.token.startsWith('otp_')) {
      const priorHashes = existingVerification.token.slice(4).split('_').filter(Boolean);
      tokenList = [...new Set([newHash, ...priorHashes])].slice(0, 3);
    }
    sessionToken = `otp_${tokenList.join('_')}`;
    await powerstextService.sendOtpSms({
      mobile: msg91Mobile,
      otp: code,
      expiryMinutes: purpose === 'PHONE_CHANGE' ? expiryMinutes : Number(process.env.MSG91_OTP_EXPIRY_MINUTES) || 10,
    });
  } else {
    await msg91Service.sendOtp(msg91Mobile, purpose === 'PHONE_CHANGE' ? { expiryMinutes } : {});
  }

  // 4. Save/update verification state
  const expiresAt = new Date(Date.now() + expiryMs);
  await prisma.mobileVerification.upsert({
    where: { phone: formattedPhone },
    create: {
      phone: formattedPhone,
      token: sessionToken,
      verified: false,
      attempts: 0,
      resendCount: 0,
      lastSentAt: new Date(),
      expiresAt,
      used: false,
    },
    update: {
      token: sessionToken,
      verified: false,
      attempts: 0,
      resendCount: { increment: 1 },
      lastSentAt: new Date(),
      expiresAt,
      used: false,
    },
  });

  // The code itself is never returned in the response
  return {
    success: true,
    message: 'OTP has been sent to your mobile number via SMS.',
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
    expiresInSeconds: expiryMs / 1000,
    phone: formattedPhone,
  };
}

/**
 * Verifies OTP code submitted by the user.
 */
export async function verifyMobileOtp({ phone, country = 'India', otp }) {
  const normalized = normalizeMobile(phone, country);
  if (!normalized.ok) {
    const error = new Error('Invalid mobile number format.');
    error.statusCode = 400;
    throw error;
  }

  const cleanOtp = String(otp || '').trim();
  if (!cleanOtp || cleanOtp.length < 4 || cleanOtp.length > 9) {
    const error = new Error('Please enter a valid OTP code.');
    error.statusCode = 400;
    throw error;
  }

  const { msg91Mobile, formattedPhone } = normalized;

  // Development test code 123456
  if (isDevOtpAllowed(cleanOtp)) {
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + VERIFICATION_TOKEN_VALIDITY_MS);
    let dbSaved = false;
    try {
      await prisma.mobileVerification.upsert({
        where: { phone: formattedPhone },
        create: {
          phone: formattedPhone,
          token: verificationToken,
          verified: true,
          attempts: 0,
          resendCount: 0,
          lastSentAt: new Date(),
          expiresAt: tokenExpiresAt,
          used: false,
        },
        update: {
          token: verificationToken,
          verified: true,
          expiresAt: tokenExpiresAt,
          used: false,
        },
      });
      dbSaved = true;
    } catch {
      // In development when DB connection is offline/sandboxed
    }

    const finalToken = dbSaved ? verificationToken : `evt_test_${verificationToken}`;
    return {
      success: true,
      message: 'Mobile number verified successfully.',
      data: {
        verified: true,
        verificationToken: finalToken,
        phone: formattedPhone,
      },
    };
  }

  // 1. Verify existence of active verification session
  const verification = await prisma.mobileVerification.findUnique({
    where: { phone: formattedPhone },
  });

  if (!verification) {
    throw authError(AUTH_MESSAGES.OTP_NOT_REQUESTED, 400, AUTH_ERROR_CODES.OTP_NOT_REQUESTED);
  }

  if (new Date() > new Date(verification.expiresAt)) {
    throw authError(AUTH_MESSAGES.OTP_EXPIRED, 400, AUTH_ERROR_CODES.OTP_EXPIRED);
  }

  if (verification.attempts >= MAX_VERIFY_ATTEMPTS) {
    const error = new Error('Too many incorrect verification attempts. Please request a new OTP.');
    error.statusCode = 429;
    throw error;
  }

  // 2. Verify OTP (via local cryptographic hash for PowersText/gateway, or MSG91)
  if (verification.token && verification.token.startsWith('otp_')) {
    const expectedHashes = verification.token.slice(4).split('_').filter(Boolean);
    const candidateHash = hashOtp(cleanOtp);
    const isMatch = expectedHashes.some((expectedHash) => hashesMatch(candidateHash, expectedHash));
    if (!isMatch) {
      await prisma.mobileVerification.update({
        where: { phone: formattedPhone },
        data: { attempts: { increment: 1 } },
      }).catch(() => {});
      throw authError(AUTH_MESSAGES.OTP_INVALID, 400, AUTH_ERROR_CODES.OTP_INVALID);
    }
  } else {
    try {
      await msg91Service.verifyOtp(msg91Mobile, cleanOtp);
    } catch (err) {
      await prisma.mobileVerification.update({
        where: { phone: formattedPhone },
        data: { attempts: { increment: 1 } },
      });
      throw err;
    }
  }

  // 3. Generate secure verification token for signup completion
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const tokenExpiresAt = new Date(Date.now() + VERIFICATION_TOKEN_VALIDITY_MS);

  await prisma.mobileVerification.update({
    where: { phone: formattedPhone },
    data: {
      verified: true,
      verifiedAt: new Date(),
      token: verificationToken,
      expiresAt: tokenExpiresAt,
      attempts: 0,
      used: false,
    },
  });

  return {
    success: true,
    message: 'Mobile number verified successfully.',
    data: {
      verified: true,
      verificationToken,
      phone: formattedPhone,
    },
  };
}

/**
 * Resends OTP to the mobile number if cooldown has elapsed.
 */
async function resendMobileOtpUnlocked({ phone, country = 'India', role }) {
  const normalized = normalizeMobile(phone, country);
  if (!normalized.ok) {
    const error = new Error(`Enter a valid ${country} mobile number.`);
    error.statusCode = 400;
    throw error;
  }

  const { msg91Mobile, formattedPhone } = normalized;

  const verification = await prisma.mobileVerification.findUnique({
    where: { phone: formattedPhone },
  });

  if (!verification) {
    // If not requested yet, fall back to initial request
    return requestMobileOtpUnlocked({ phone, country, role });
  }

  await assertMobileAvailableForSignup(normalized, role);

  const elapsedSeconds = Math.floor((Date.now() - new Date(verification.lastSentAt).getTime()) / 1000);
  if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
    throw otpCooldownError(RESEND_COOLDOWN_SECONDS - elapsedSeconds);
  }

  if (verification.resendCount >= 5) {
    const error = new Error('Maximum OTP resend limit reached for this session. Please try again after some time.');
    error.statusCode = 429;
    throw error;
  }

  // Retry through PowersText or MSG91
  const isPowersText = Boolean(process.env.SMS_API_URL || process.env.SMS_SENDER_ID);
  let sessionToken = verification.token;

  if (isPowersText) {
    const code = generateOtp();
    sessionToken = `otp_${hashOtp(code)}`;
    await powerstextService.sendOtpSms({
      mobile: msg91Mobile,
      otp: code,
      expiryMinutes: Number(process.env.MSG91_OTP_EXPIRY_MINUTES) || 10,
    });
  } else {
    await msg91Service.resendOtp(msg91Mobile, 'text');
  }

  await prisma.mobileVerification.update({
    where: { phone: formattedPhone },
    data: {
      token: sessionToken,
      lastSentAt: new Date(),
      resendCount: { increment: 1 },
      attempts: 0,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      used: false,
    },
  });

  return {
    success: true,
    message: 'OTP has been resent to your mobile number via SMS.',
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
    phone: formattedPhone,
  };
}



/**
 * Validates that a mobile number was legitimately verified via OTP before account creation.
 * Consumes the verification token to prevent replay attacks.
 */
export async function validateVerifiedMobile({ phone, country = 'India', verificationToken }) {
  if (!verificationToken) {
    const error = new Error('Mobile verification token is required.');
    error.statusCode = 400;
    throw error;
  }

  if (process.env.NODE_ENV !== 'production' && (verificationToken === 'verified' || verificationToken.startsWith('evt_test_'))) {
    return true;
  }

  const normalized = normalizeMobile(phone, country);
  const formattedPhone = normalized.ok ? normalized.formattedPhone : phone;

  const verification = await prisma.mobileVerification.findFirst({
    where: {
      OR: [
        { phone: formattedPhone },
        { phone: normalized.msg91Mobile },
      ],
      token: verificationToken,
      verified: true,
      used: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (!verification) {
    const error = new Error('Mobile verification required. Please verify your mobile number with OTP before completing registration.');
    error.statusCode = 403;
    throw error;
  }

  // Mark token as consumed (prevents OTP token replay for another account)
  const consumed = await prisma.mobileVerification.updateMany({
    where: {
      id: verification.id,
      token: verificationToken,
      verified: true,
      used: false,
      expiresAt: { gt: new Date() },
    },
    data: { used: true },
  });

  if (consumed.count !== 1) {
    const error = new Error('Mobile verification token is invalid, expired, or already used.');
    error.statusCode = 403;
    throw error;
  }

  return true;
}

// In-memory store for email login OTP sessions
// Key: normalized email -> Value: { otpHash, expiresAt, attempts, resendCount, lastSentAt }
const emailLoginOtpStore = new Map();

// Periodic cleanup of expired email login OTPs every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [emailKey, entry] of emailLoginOtpStore.entries()) {
    if (entry.expiresAt + EXPIRED_SESSION_GRACE_MS < now) {
      emailLoginOtpStore.delete(emailKey);
    }
  }
}, 5 * 60 * 1000).unref();


/**
 * Requests an OTP for email login flow.
 * Dispatches a genuine 6-digit OTP to the registered email address.
 */
async function requestEmailLoginOtpUnlocked({ email, role }) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i.test(normalizedEmail)) {
    const error = new Error('Please enter a valid email address.');
    error.statusCode = 400;
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  // Account existence, role and signup completion are validated before any cooldown applies
  assertCanSignIn(user, { role, via: 'email' });

  // Rate limiting & cooldown check (only reached when an OTP was genuinely sent recently).
  // A code that was already used to sign in ends that cycle: after logout the next sign-in starts fresh,
  // so the cooldown and resend count only guard codes that are still pending.
  const stored = emailLoginOtpStore.get(normalizedEmail);
  const existing = stored && !stored.consumed ? stored : null;
  if (existing) {
    const elapsedSeconds = Math.floor((Date.now() - existing.lastSentAt) / 1000);
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      throw otpCooldownError(RESEND_COOLDOWN_SECONDS - elapsedSeconds);
    }

    if (activeResendWindow(existing)?.resendCount >= MAX_HOURLY_ATTEMPTS) {
      const error = new Error('Too many OTP requests for this email address. Please try again after 1 hour.');
      error.statusCode = 429;
      throw error;
    }
  }
  const loginWindow = activeResendWindow(existing);

  // Real cryptographically secure random 6-digit code
  const code = generateOtp();
  const otpHash = hashOtp(code);

  const { sendLoginOtpEmail } = await import('./emailService.js');
  assertEmailSent(await sendLoginOtpEmail({ email: normalizedEmail, name: user.name, otp: code }));

  // Record the session (and start the cooldown) only once the OTP has actually been dispatched
  const priorHashes = (existing?.validHashes || (existing?.otpHash ? [existing.otpHash] : []))
    .filter((_, idx, arr) => arr.length - idx <= 3);
  const validHashes = [...new Set([...priorHashes, otpHash])];

  emailLoginOtpStore.set(normalizedEmail, {
    otpHash,
    validHashes,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
    resendCount: loginWindow ? loginWindow.resendCount + 1 : 0,
    windowStartedAt: loginWindow ? loginWindow.windowStartedAt : Date.now(),
    lastSentAt: Date.now(),
  });

  return {
    success: true,
    message: 'Verification code has been sent to your email address.',
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
    email: normalizedEmail,
  };
}

/**
 * Validates the email login OTP.
 * Returns true if valid, or throws an error.
 */
export function validateEmailLoginOtp({ email, otp, consume = false }) {
  const cleanOtp = String(otp || '').trim();
  if (!cleanOtp) {
    const error = new Error('Email verification OTP is required.');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = (email || '').toLowerCase().trim();
  const session = emailLoginOtpStore.get(normalizedEmail);

  // Development test code 123456
  if (isDevOtpAllowed(cleanOtp)) {
    if (consume && session) session.consumed = true;
    logOtpCheck('login email', normalizedEmail, 'verified with development test code 123456');
    return true;
  }

  if (session?.locked && !session.consumed) {
    logOtpCheck('login email', normalizedEmail, 'rejected: code locked after too many wrong attempts', session);
    throw lockOtpSession(session);
  }
  if (!session || session.consumed) {
    logOtpCheck('login email', normalizedEmail, 'rejected: no pending code (never requested, already used, or server restarted)');
    throw authError(AUTH_MESSAGES.OTP_NOT_REQUESTED, 400, AUTH_ERROR_CODES.OTP_NOT_REQUESTED);
  }

  if (Date.now() > session.expiresAt) {
    logOtpCheck('login email', normalizedEmail, 'rejected: code expired', session);
    throw authError(AUTH_MESSAGES.OTP_EXPIRED, 400, AUTH_ERROR_CODES.OTP_EXPIRED);
  }

  if (session.attempts >= MAX_VERIFY_ATTEMPTS) {
    // The code is dead, but the entry is kept so the resend cooldown and hourly limit still apply
    logOtpCheck('login email', normalizedEmail, 'rejected: too many wrong attempts', session);
    throw lockOtpSession(session);
  }

  const candidateHash = hashOtp(cleanOtp);
  const validHashes = session.validHashes || (session.otpHash ? [session.otpHash] : []);
  const isMatch = validHashes.some((expected) => hashesMatch(candidateHash, expected));
  if (!isMatch) {
    session.attempts += 1;
    logOtpCheck('login email', normalizedEmail, `rejected: code does not match (wrong attempt ${session.attempts}/${MAX_VERIFY_ATTEMPTS})`, session);
    throw authError(AUTH_MESSAGES.OTP_INVALID, 400, AUTH_ERROR_CODES.OTP_INVALID);
  }

  if (consume) {
    // Used for a successful sign-in: the code can never be reused, and the next sign-in (e.g. after logout)
    // may request a new code immediately instead of waiting out this code's resend cooldown
    session.consumed = true;
  }

  return true;
}

/**
 * Requests an OTP for Mobile login flow.
 * Checks registered account, checks role, and dispatches SMS.
 */
async function requestMobileLoginOtpUnlocked({ phone, country = 'India', role }) {
  const normalized = normalizeMobile(phone, country);
  if (!normalized.ok) {
    const error = new Error(`Enter a valid ${country} mobile number.`);
    error.statusCode = 400;
    throw error;
  }

  const { msg91Mobile, formattedPhone } = normalized;

  // Both lookups go to the remote database, so they run together
  const [user, existingVerification] = await Promise.all([
    findUserByMobile(normalized),
    prisma.mobileVerification.findUnique({ where: { phone: formattedPhone } }),
  ]);

  // 1. Check registered account, role and signup completion before any cooldown applies
  assertCanSignIn(user, { role, via: 'mobile' });

  // 2. Check rate limits & resend cooldown in MobileVerification.
  // A code that was already verified and used ends that cycle: after logout the next sign-in starts fresh.
  const previousCodeUsed = Boolean(existingVerification?.used && existingVerification?.verified);

  if (existingVerification && !previousCodeUsed) {
    const elapsedSeconds = Math.floor((Date.now() - new Date(existingVerification.lastSentAt).getTime()) / 1000);
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      throw otpCooldownError(RESEND_COOLDOWN_SECONDS - elapsedSeconds);
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (existingVerification.updatedAt > oneHourAgo && existingVerification.resendCount >= MAX_HOURLY_ATTEMPTS) {
      const error = new Error('Too many OTP requests for this mobile number. Please try again after 1 hour.');
      error.statusCode = 429;
      throw error;
    }
  }

  // 3. Dispatch OTP through configured provider
  const isPowersText = Boolean(process.env.SMS_API_URL || process.env.SMS_SENDER_ID);
  let sessionToken = null;

  if (isPowersText) {
    const code = generateOtp();
    sessionToken = `otp_${hashOtp(code)}`;
    await powerstextService.sendOtpSms({
      mobile: msg91Mobile,
      otp: code,
      expiryMinutes: Number(process.env.MSG91_OTP_EXPIRY_MINUTES) || 10,
    });
  } else {
    await msg91Service.sendOtp(msg91Mobile);
  }

  // 4. Save/update verification state
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
  await prisma.mobileVerification.upsert({
    where: { phone: formattedPhone },
    create: {
      phone: formattedPhone,
      token: sessionToken,
      verified: false,
      attempts: 0,
      resendCount: 0,
      lastSentAt: new Date(),
      expiresAt,
      used: false,
    },
    update: {
      token: sessionToken,
      verified: false,
      attempts: 0,
      resendCount: previousCodeUsed ? 0 : { increment: 1 },
      lastSentAt: new Date(),
      expiresAt,
      used: false,
    },
  });

  return {
    success: true,
    message: 'OTP has been sent to your mobile number via SMS.',
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
    phone: formattedPhone,
  };
}

/**
 * Verifies mobile OTP and logs in the Buyer or Supplier.
 */
export async function verifyAndLoginMobile({ phone, country = 'India', otp, role }) {
  const normalized = normalizeMobile(phone, country);
  if (!normalized.ok) {
    const error = new Error('Invalid mobile number format.');
    error.statusCode = 400;
    throw error;
  }

  const cleanOtp = String(otp || '').trim();
  if (!cleanOtp) {
    const error = new Error('Please enter the OTP sent to your mobile number.');
    error.statusCode = 400;
    throw error;
  }

  const { msg91Mobile, formattedPhone } = normalized;

  // 1. Verify user exists, matches the selected role and finished signup
  const user = await findUserByMobile(normalized);
  assertCanSignIn(user, { role, via: 'mobile' });

  // 2. Local development test code 123456 (isolated local database only), otherwise verify the real OTP
  //    (must be requested, expire, limited attempts, single use)
  if (isDevOtpAllowed(cleanOtp)) {
    // A successful sign-in closes any pending code, as with a real OTP (no lingering cooldown after logout)
    await prisma.mobileVerification.updateMany({
      where: { phone: formattedPhone, used: false },
      data: { used: true, verified: true, verifiedAt: new Date() },
    });
  } else {
    const verification = await prisma.mobileVerification.findUnique({
      where: { phone: formattedPhone },
    });

    if (!verification || verification.used) {
      throw authError(AUTH_MESSAGES.OTP_NOT_REQUESTED, 400, AUTH_ERROR_CODES.OTP_NOT_REQUESTED);
    }

    if (new Date() > new Date(verification.expiresAt)) {
      throw authError(AUTH_MESSAGES.OTP_EXPIRED, 400, AUTH_ERROR_CODES.OTP_EXPIRED);
    }

    if (verification.attempts >= MAX_VERIFY_ATTEMPTS) {
      const error = new Error('Too many incorrect verification attempts. Please request a new OTP.');
      error.statusCode = 429;
      throw error;
    }

    if (verification.token && verification.token.startsWith('otp_')) {
      const expectedHashes = verification.token.slice(4).split('_').filter(Boolean);
      const candidateHash = hashOtp(cleanOtp);
      const isMatch = expectedHashes.some((expectedHash) => hashesMatch(candidateHash, expectedHash));
      if (!isMatch) {
        await prisma.mobileVerification.update({
          where: { phone: formattedPhone },
          data: { attempts: { increment: 1 } },
        }).catch(() => {});
        throw authError(AUTH_MESSAGES.OTP_INVALID, 400, AUTH_ERROR_CODES.OTP_INVALID);
      }
    } else {
      try {
        await msg91Service.verifyOtp(msg91Mobile, cleanOtp);
      } catch (err) {
        await prisma.mobileVerification.update({
          where: { phone: formattedPhone },
          data: { attempts: { increment: 1 } },
        });
        throw err;
      }
    }

    // Mark as used
    await prisma.mobileVerification.update({
      where: { phone: formattedPhone },
      data: { used: true, verified: true, verifiedAt: new Date() },
    });
  }

  // 3. Issue JWT and return safe user
  const { issueLoginToken } = await import('./sessionService.js');
  const token = await issueLoginToken(user, { method: 'OTP' });
  const { passwordHash, ...safeUser } = user;
  return { user: safeUser, token };
}

const emailVerificationStore = new Map();

const EMAIL_VERIFIED_PURPOSE = 'EMAIL_VERIFIED';
const EMAIL_VERIFIED_VALIDITY = '1h'; // Long enough to finish the multi-step signup form
// A separate key, so this token can never be used as a login token, or the other way round
const emailVerifiedSecret = () => `${ENV.JWT_SECRET}:email-verified`;

/**
 * Proof that an email address passed verification. It is signed rather than kept in server memory, so a restart or a
 * failed signup attempt does not lose it. It only ever works for this exact email, and a registered email cannot sign up
 * again, so it does not need to be single-use.
 */
const signEmailVerified = (normalizedEmail) => jwt.sign(
  { purpose: EMAIL_VERIFIED_PURPOSE, email: normalizedEmail },
  emailVerifiedSecret(),
  { expiresIn: EMAIL_VERIFIED_VALIDITY },
);

// Periodic cleanup of expired email verifications every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [emailKey, entry] of emailVerificationStore.entries()) {
    if ((entry.expiresAt || entry.verifiedAt || 0) + EXPIRED_SESSION_GRACE_MS < now) {
      emailVerificationStore.delete(emailKey);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Requests an OTP for email verification (registration or KYC).
 * For registration, `role` (BUYER / SUPPLIER) decides whether an existing account can be resumed.
 */
async function requestEmailVerificationOtpUnlocked({ email, name, purpose = 'registration', role }) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i.test(normalizedEmail)) {
    const error = new Error('Please enter a valid email address.');
    error.statusCode = 400;
    throw error;
  }

  // If registering, check the email's account status before any cooldown applies
  let resumeSignup = false;
  if (purpose === 'registration') {
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      if (!canResumeSignup(existingUser, role)) {
        throw existingAccountError(existingUser, role);
      }
      resumeSignup = true;
    }
  }

  // Rate limiting & cooldown check (only reached when an OTP was genuinely sent recently)
  const existing = emailVerificationStore.get(normalizedEmail);
  if (existing && existing.lastSentAt) {
    const elapsedSeconds = Math.floor((Date.now() - existing.lastSentAt) / 1000);
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      throw otpCooldownError(RESEND_COOLDOWN_SECONDS - elapsedSeconds);
    }

    if (activeResendWindow(existing)?.resendCount >= MAX_HOURLY_ATTEMPTS) {
      const error = new Error('Too many OTP requests for this email. Please try again after 1 hour.');
      error.statusCode = 429;
      throw error;
    }
  }
  const verificationWindow = activeResendWindow(existing);

  // Real cryptographically secure random 6-digit code
  const code = generateOtp();
  const otpHash = hashOtp(code);

  const { sendSupplierVerificationOtpEmail } = await import('./emailService.js');
  assertEmailSent(await sendSupplierVerificationOtpEmail({ email: normalizedEmail, name, otp: code, purpose }));

  // Record the session (and start the cooldown) only once the OTP has actually been dispatched
  const priorHashes = (existing?.validHashes || (existing?.otpHash ? [existing.otpHash] : []))
    .filter((_, idx, arr) => arr.length - idx <= 3);
  const validHashes = [...new Set([...priorHashes, otpHash])];

  emailVerificationStore.set(normalizedEmail, {
    otpHash,
    validHashes,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
    resendCount: verificationWindow ? verificationWindow.resendCount + 1 : 0,
    windowStartedAt: verificationWindow ? verificationWindow.windowStartedAt : Date.now(),
    lastSentAt: Date.now(),
    verified: false,
    purpose,
  });
  logOtpCheck('signup email', normalizedEmail, 'new code sent', emailVerificationStore.get(normalizedEmail));

  return {
    success: true,
    message: resumeSignup
      ? `${AUTH_MESSAGES.SIGNUP_INCOMPLETE} A verification code has been sent to ${normalizedEmail}.`
      : `Verification code sent to ${normalizedEmail}.`,
    resumeSignup,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
    email: normalizedEmail,
  };
}

/**
 * Validates and completes email verification with submitted OTP.
 */
export async function verifyEmailVerificationOtp({ email, otp, purpose = 'registration' }) {
  const cleanOtp = String(otp || '').trim();
  if (!cleanOtp) {
    const error = new Error('Verification OTP code is required.');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = (email || '').toLowerCase().trim();

  // Development test code 123456
  if (isDevOtpAllowed(cleanOtp)) {
    emailVerificationStore.delete(normalizedEmail);
    logOtpCheck('signup email', normalizedEmail, 'verified with development test code 123456');
    return {
      success: true,
      message: 'Email verified successfully.',
      verificationToken: signEmailVerified(normalizedEmail),
      email: normalizedEmail,
    };
  }

  const session = emailVerificationStore.get(normalizedEmail);
  if (session?.locked) {
    logOtpCheck('signup email', normalizedEmail, 'rejected: code locked after too many wrong attempts', session);
    throw lockOtpSession(session);
  }
  if (!session || !session.otpHash) {
    logOtpCheck('signup email', normalizedEmail, 'rejected: no pending code (never requested, already used, or server restarted)');
    throw authError(AUTH_MESSAGES.OTP_NOT_REQUESTED, 400, AUTH_ERROR_CODES.OTP_NOT_REQUESTED);
  }

  if (Date.now() > session.expiresAt) {
    logOtpCheck('signup email', normalizedEmail, 'rejected: code expired', session);
    throw authError(AUTH_MESSAGES.OTP_EXPIRED, 400, AUTH_ERROR_CODES.OTP_EXPIRED);
  }

  if (session.attempts >= MAX_VERIFY_ATTEMPTS) {
    // The code is dead, but the entry is kept so the resend cooldown and hourly limit still apply
    logOtpCheck('signup email', normalizedEmail, 'rejected: too many wrong attempts', session);
    throw lockOtpSession(session);
  }

  const candidateHash = hashOtp(cleanOtp);
  const validHashes = session.validHashes || (session.otpHash ? [session.otpHash] : []);
  const isMatch = validHashes.some((expected) => hashesMatch(candidateHash, expected));
  if (!isMatch) {
    session.attempts += 1;
    logOtpCheck('signup email', normalizedEmail, `rejected: code does not match (wrong attempt ${session.attempts}/${MAX_VERIFY_ATTEMPTS})`, session);
    throw authError(AUTH_MESSAGES.OTP_INVALID, 400, AUTH_ERROR_CODES.OTP_INVALID);
  }

  // The code itself can only be used once
  emailVerificationStore.delete(normalizedEmail);
  logOtpCheck('signup email', normalizedEmail, 'verified', session);

  return {
    success: true,
    message: 'Email address verified successfully.',
    verificationToken: signEmailVerified(normalizedEmail),
    email: normalizedEmail,
  };
}

/**
 * Records an email address as verified by a trusted identity provider (Google), issuing the same kind
 * of token an email OTP produces, so signup can continue without a second OTP.
 */
export function issueVerifiedEmailToken(email) {
  return signEmailVerified((email || '').toLowerCase().trim());
}

/**
 * Validates that an email address was legitimately verified via OTP before account creation.
 * Stays valid if this signup attempt fails on something else, so correcting that mistake does not mean verifying again.
 */
export function validateVerifiedEmail({ email, verificationToken }) {
  if (!verificationToken) {
    const error = new Error('Email verification is required. Please verify via OTP.');
    error.statusCode = 400;
    throw error;
  }

  if (process.env.NODE_ENV !== 'production' && String(verificationToken).startsWith('evt_test_')) return true;

  const normalizedEmail = (email || '').toLowerCase().trim();
  try {
    const payload = jwt.verify(String(verificationToken), emailVerifiedSecret());
    if (payload.purpose === EMAIL_VERIFIED_PURPOSE && payload.email === normalizedEmail) return true;
  } catch {
    // Expired, altered or not one of ours: handled below
  }

  const error = new Error('Your email verification has expired. Please verify your email again.');
  error.statusCode = 400;
  error.errorCode = 'EMAIL_VERIFICATION_EXPIRED';
  throw error;
}

/* ------------------------------------------------------------------ one send at a time per email / mobile */

// Codes are recorded (and the resend cooldown starts) only after the email / SMS has been sent, which takes a few
// seconds. Without this lock, a second request for the same address during that window (double click, Enter + click,
// a second tab, a retry) also passed the cooldown check: two messages with different codes went out and only the
// last one worked, so the code from the first message was rejected as "Invalid OTP". While a code is being sent, a
// concurrent request for the same email / mobile now gets the normal cooldown answer and nothing extra is sent.
// (Per server process; the in-memory OTP stores are per process too.)
const sendsInProgress = new Set();

async function oneSendAtATime(key, send) {
  if (sendsInProgress.has(key)) throw otpCooldownError(RESEND_COOLDOWN_SECONDS);
  sendsInProgress.add(key);
  try {
    return await send();
  } finally {
    sendsInProgress.delete(key);
  }
}

const emailKey = (email) => String(email || '').trim().toLowerCase();
const mobileKey = (phone, country) => {
  const normalized = normalizeMobile(phone, country);
  return normalized.ok ? normalized.formattedPhone : String(phone || '').replace(/D/g, '');
};

export function requestMobileOtp(args = {}) {
  return oneSendAtATime(`mobile:${mobileKey(args.phone, args.country)}`, () => requestMobileOtpUnlocked(args));
}

export function resendMobileOtp(args = {}) {
  return oneSendAtATime(`mobile:${mobileKey(args.phone, args.country)}`, () => resendMobileOtpUnlocked(args));
}

export function requestMobileLoginOtp(args = {}) {
  return oneSendAtATime(`mobile-login:${mobileKey(args.phone, args.country)}`, () => requestMobileLoginOtpUnlocked(args));
}

export function requestEmailLoginOtp(args = {}) {
  return oneSendAtATime(`email-login:${emailKey(args.email)}`, () => requestEmailLoginOtpUnlocked(args));
}

export function requestEmailVerificationOtp(args = {}) {
  return oneSendAtATime(`email-verify:${emailKey(args.email)}`, () => requestEmailVerificationOtpUnlocked(args));
}
