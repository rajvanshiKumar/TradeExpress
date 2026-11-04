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
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
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

/** Finds the account that owns a mobile number, in any of its stored formats. */
function findUserByMobile(normalized) {
  const phoneValues = [...new Set([
    normalized.formattedPhone,
    normalized.msg91Mobile,
    `+${normalized.msg91Mobile}`,
    normalized.national,
  ].filter(Boolean))];
  return prisma.user.findFirst({
    where: {
      phone: { in: phoneValues },
    },
    select: { id: true, role: true, name: true, phone: true, company: true, passwordHash: true, googleId: true, isActive: true, status: true, statusReason: true },
  });
}

/** Signup OTPs may only go to a number that is free, or that belongs to an unfinished signup. */
async function assertMobileAvailableForSignup(normalized) {
  const existingUser = await findUserByMobile(normalized);
  if (existingUser && isSignupComplete(existingUser)) {
    throw authError(AUTH_MESSAGES.MOBILE_EXISTS, 409, AUTH_ERROR_CODES.ACCOUNT_EXISTS, {
      accountRole: existingUser.role,
    });
  }
}

/**
 * Checks whether the development bypass OTP (123456) is permitted.
 * STRICT ENFORCEMENT: Never allowed in production (NODE_ENV=production),
 * and only permitted when DEV_OTP_ENABLED=true or in development.
 */
export function isDevOtpAllowed(otp) {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  const isDevOtpConfigured = process.env.DEV_OTP_ENABLED === 'true' && process.env.NODE_ENV !== 'production';
  return isDevOtpConfigured && String(otp || '').trim() === '123456';
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
 */
export async function requestMobileOtp({ phone, country = 'India' }) {
  const normalized = normalizeMobile(phone, country);
  if (!normalized.ok) {
    const error = new Error(`Enter a valid ${country} mobile number.`);
    error.statusCode = 400;
    throw error;
  }

  const { msg91Mobile, formattedPhone } = normalized;

  // Both lookups go to the remote database, so they run together; the account check still takes precedence
  const [account, verification] = await Promise.allSettled([
    assertMobileAvailableForSignup(normalized),
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
  let smsResult = null;
  let generatedOtp = null;

  if (isPowersText) {
    generatedOtp = generateOtp();
    const otpHash = hashOtp(generatedOtp);
    sessionToken = `otp_${otpHash}`;
    smsResult = await powerstextService.sendOtpSms({
      mobile: msg91Mobile,
      otp: generatedOtp,
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
      resendCount: { increment: 1 },
      lastSentAt: new Date(),
      expiresAt,
      used: false,
    },
  });

  const isDev = process.env.DEV_OTP_ENABLED === 'true' && process.env.NODE_ENV !== 'production';
  return {
    success: true,
    message: 'OTP has been sent to your mobile number via SMS.',
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
    phone: formattedPhone,
    ...(isDev ? { devOtp: generatedOtp || '123456' } : {}),
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

  // Development / Test OTP bypass (123456)
  if (isDevOtpAllowed(cleanOtp)) {
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + VERIFICATION_TOKEN_VALIDITY_MS);
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
  if (isDevOtpAllowed(cleanOtp)) {
    // Development OTP bypass allowed only when non-production and configured
  } else if (verification.token && verification.token.startsWith('otp_')) {
    const expectedHash = verification.token.slice(4);
    const candidateHash = hashOtp(cleanOtp);
    if (!hashesMatch(candidateHash, expectedHash)) {
      await prisma.mobileVerification.update({
        where: { phone: formattedPhone },
        data: { attempts: { increment: 1 } },
      });
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
export async function resendMobileOtp({ phone, country = 'India' }) {
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
    return requestMobileOtp({ phone, country });
  }

  await assertMobileAvailableForSignup(normalized);

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
  let smsResult = null;
  let generatedOtp = null;

  if (isPowersText) {
    generatedOtp = generateOtp();
    const otpHash = hashOtp(generatedOtp);
    sessionToken = `otp_${otpHash}`;
    smsResult = await powerstextService.sendOtpSms({
      mobile: msg91Mobile,
      otp: generatedOtp,
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
export async function requestEmailLoginOtp({ email, role }) {
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

  // Rate limiting & cooldown check (only reached when an OTP was genuinely sent recently)
  const existing = emailLoginOtpStore.get(normalizedEmail);
  if (existing) {
    const elapsedSeconds = Math.floor((Date.now() - existing.lastSentAt) / 1000);
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      throw otpCooldownError(RESEND_COOLDOWN_SECONDS - elapsedSeconds);
    }

    if (existing.resendCount >= MAX_HOURLY_ATTEMPTS) {
      const error = new Error('Too many OTP requests for this email address. Please try again after 1 hour.');
      error.statusCode = 429;
      throw error;
    }
  }

  // Generate real cryptographically secure random 6-digit OTP (never fixed 123456 as generated real OTP)
  const generatedOtp = generateOtp();

  const otpHash = hashOtp(generatedOtp);

  const { sendLoginOtpEmail } = await import('./emailService.js');
  assertEmailSent(await sendLoginOtpEmail({ email: normalizedEmail, name: user.name, otp: generatedOtp }));

  // Record the session (and start the cooldown) only once the OTP has actually been dispatched
  emailLoginOtpStore.set(normalizedEmail, {
    otpHash,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
    resendCount: existing ? existing.resendCount + 1 : 0,
    lastSentAt: Date.now(),
  });

  return {
    success: true,
    message: 'Verification code has been sent to your email address.',
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
    email: normalizedEmail,
    ...(process.env.DEV_OTP_ENABLED === 'true' && process.env.NODE_ENV !== 'production'
      ? { devOtp: generatedOtp }
      : {}),
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

  // Check development OTP bypass
  if (isDevOtpAllowed(cleanOtp)) {
    return true;
  }

  const normalizedEmail = (email || '').toLowerCase().trim();
  const session = emailLoginOtpStore.get(normalizedEmail);

  if (!session || session.consumed) {
    throw authError(AUTH_MESSAGES.OTP_NOT_REQUESTED, 400, AUTH_ERROR_CODES.OTP_NOT_REQUESTED);
  }

  if (Date.now() > session.expiresAt) {
    throw authError(AUTH_MESSAGES.OTP_EXPIRED, 400, AUTH_ERROR_CODES.OTP_EXPIRED);
  }

  if (session.attempts >= MAX_VERIFY_ATTEMPTS) {
    emailLoginOtpStore.delete(normalizedEmail);
    const error = new Error('Too many incorrect verification attempts. Please request a new OTP.');
    error.statusCode = 429;
    throw error;
  }

  const candidateHash = hashOtp(cleanOtp);
  if (!hashesMatch(candidateHash, session.otpHash)) {
    session.attempts += 1;
    throw authError(AUTH_MESSAGES.OTP_INVALID, 400, AUTH_ERROR_CODES.OTP_INVALID);
  }

  if (consume) {
    // Keep lastSentAt/resendCount so the resend cooldown and hourly limit still apply after sign-in
    session.consumed = true;
  }

  return true;
}

/**
 * Requests an OTP for Mobile login flow.
 * Checks registered account, checks role, and dispatches SMS.
 */
export async function requestMobileLoginOtp({ phone, country = 'India', role }) {
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

  // 2. Check rate limits & resend cooldown in MobileVerification

  if (existingVerification) {
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
  let generatedOtp = null;

  if (isPowersText) {
    generatedOtp = generateOtp();

    const otpHash = hashOtp(generatedOtp);
    sessionToken = `otp_${otpHash}`;
    await powerstextService.sendOtpSms({
      mobile: msg91Mobile,
      otp: generatedOtp,
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
      resendCount: { increment: 1 },
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
    ...(process.env.DEV_OTP_ENABLED === 'true' && process.env.NODE_ENV !== 'production'
      ? { devOtp: generatedOtp || '123456' }
      : {}),
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

  // 2. Check dev OTP bypass or verify real OTP
  const isDev = isDevOtpAllowed(cleanOtp);
  if (!isDev) {
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
      const expectedHash = verification.token.slice(4);
      const candidateHash = hashOtp(cleanOtp);
      if (!hashesMatch(candidateHash, expectedHash)) {
        await prisma.mobileVerification.update({
          where: { phone: formattedPhone },
          data: { attempts: { increment: 1 } },
        });
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
export async function requestEmailVerificationOtp({ email, name, purpose = 'registration', role }) {
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

    if (existing.resendCount >= MAX_HOURLY_ATTEMPTS) {
      const error = new Error('Too many OTP requests for this email. Please try again after 1 hour.');
      error.statusCode = 429;
      throw error;
    }
  }

  // Generate real cryptographically secure random 6-digit OTP
  const generatedOtp = generateOtp();

  const otpHash = hashOtp(generatedOtp);

  const { sendSupplierVerificationOtpEmail } = await import('./emailService.js');
  assertEmailSent(await sendSupplierVerificationOtpEmail({ email: normalizedEmail, name, otp: generatedOtp, purpose }));

  // Record the session (and start the cooldown) only once the OTP has actually been dispatched
  emailVerificationStore.set(normalizedEmail, {
    otpHash,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
    resendCount: existing?.resendCount !== undefined ? existing.resendCount + 1 : 0,
    lastSentAt: Date.now(),
    verified: false,
    purpose,
  });

  const isDev = process.env.DEV_OTP_ENABLED === 'true' && process.env.NODE_ENV !== 'production';
  return {
    success: true,
    message: resumeSignup
      ? `${AUTH_MESSAGES.SIGNUP_INCOMPLETE} A verification code has been sent to ${normalizedEmail}.`
      : `Verification code sent to ${normalizedEmail}.`,
    resumeSignup,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
    email: normalizedEmail,
    ...(isDev ? { devOtp: generatedOtp } : {}),
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

  // Check development OTP bypass
  if (isDevOtpAllowed(cleanOtp)) {
    emailVerificationStore.delete(normalizedEmail);
    return {
      success: true,
      message: 'Email verified successfully.',
      verificationToken: signEmailVerified(normalizedEmail),
      email: normalizedEmail,
    };
  }

  const session = emailVerificationStore.get(normalizedEmail);
  if (!session || !session.otpHash) {
    throw authError(AUTH_MESSAGES.OTP_NOT_REQUESTED, 400, AUTH_ERROR_CODES.OTP_NOT_REQUESTED);
  }

  if (Date.now() > session.expiresAt) {
    throw authError(AUTH_MESSAGES.OTP_EXPIRED, 400, AUTH_ERROR_CODES.OTP_EXPIRED);
  }

  if (session.attempts >= MAX_VERIFY_ATTEMPTS) {
    emailVerificationStore.delete(normalizedEmail);
    const error = new Error('Too many incorrect verification attempts. Please request a new OTP.');
    error.statusCode = 429;
    throw error;
  }

  const candidateHash = hashOtp(cleanOtp);
  if (!hashesMatch(candidateHash, session.otpHash)) {
    session.attempts += 1;
    throw authError(AUTH_MESSAGES.OTP_INVALID, 400, AUTH_ERROR_CODES.OTP_INVALID);
  }

  // The code itself can only be used once
  emailVerificationStore.delete(normalizedEmail);

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

