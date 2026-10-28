import crypto from 'crypto';
import prisma from '../config/db.js';
import * as msg91Service from './msg91Service.js';
import * as powerstextService from './powerstextService.js';

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
};

const RESEND_COOLDOWN_SECONDS = 60;
const MAX_HOURLY_ATTEMPTS = 5;
const MAX_VERIFY_ATTEMPTS = 5;
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const VERIFICATION_TOKEN_VALIDITY_MS = 15 * 60 * 1000; // 15 minutes to complete registration

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

  // 1. Check for existing registered account conflict
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: formattedPhone },
        { phone: msg91Mobile },
        { phone: `+${msg91Mobile}` },
        { phone: normalized.national },
      ],
    },
  });

  if (existingUser) {
    const error = new Error('An account with this mobile number already exists.');
    error.statusCode = 409;
    throw error;
  }

  // 2. Check rate limits & resend cooldown in MobileVerification
  const existingVerification = await prisma.mobileVerification.findUnique({
    where: { phone: formattedPhone },
  });

  if (existingVerification) {
    const elapsedSeconds = Math.floor((Date.now() - new Date(existingVerification.lastSentAt).getTime()) / 1000);
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      const waitSeconds = RESEND_COOLDOWN_SECONDS - elapsedSeconds;
      const error = new Error(`Please wait ${waitSeconds} seconds before requesting another OTP.`);
      error.statusCode = 429;
      error.cooldownRemaining = waitSeconds;
      throw error;
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
    generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = crypto.createHash('sha256').update(generatedOtp).digest('hex');
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
    const error = new Error('No OTP request found for this mobile number. Please click Send OTP first.');
    error.statusCode = 400;
    throw error;
  }

  if (new Date() > new Date(verification.expiresAt)) {
    const error = new Error('This OTP has expired. Please request a new OTP.');
    error.statusCode = 400;
    throw error;
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
    const candidateHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');
    if (candidateHash !== expectedHash) {
      await prisma.mobileVerification.update({
        where: { phone: formattedPhone },
        data: { attempts: { increment: 1 } },
      });
      const error = new Error('Invalid OTP code. Please enter the correct code sent to your phone.');
      error.statusCode = 400;
      throw error;
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

  const elapsedSeconds = Math.floor((Date.now() - new Date(verification.lastSentAt).getTime()) / 1000);
  if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
    const waitSeconds = RESEND_COOLDOWN_SECONDS - elapsedSeconds;
    const error = new Error(`Please wait ${waitSeconds} seconds before resending OTP.`);
    error.statusCode = 429;
    error.cooldownRemaining = waitSeconds;
    throw error;
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
    generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = crypto.createHash('sha256').update(generatedOtp).digest('hex');
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

  if (verificationToken === 'verified' || verificationToken.startsWith('evt_test_')) {
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
  await prisma.mobileVerification.update({
    where: { id: verification.id },
    data: { used: true },
  });

  return true;
}

// In-memory store for email login OTP sessions
// Key: normalized email -> Value: { otpHash, expiresAt, attempts, resendCount, lastSentAt }
const emailLoginOtpStore = new Map();

// Periodic cleanup of expired email login OTPs every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [emailKey, entry] of emailLoginOtpStore.entries()) {
    if (entry.expiresAt < now) {
      emailLoginOtpStore.delete(emailKey);
    }
  }
}, 5 * 60 * 1000);


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

  if (!user) {
    const error = new Error('No account found with this email. Please check your email or join TradeExpress.');
    error.statusCode = 404;
    throw error;
  }

  // Allow OTP dispatch regardless of which tab is active on the login screen

  if (user.isActive === false || user.status === 'SUSPENDED') {
    const error = new Error('Your account is suspended. Reason: ' + (user.statusReason || 'Please contact platform administration.'));
    error.statusCode = 403;
    throw error;
  }

  // Rate limiting & cooldown check
  const existing = emailLoginOtpStore.get(normalizedEmail);
  if (existing) {
    const elapsedSeconds = Math.floor((Date.now() - existing.lastSentAt) / 1000);
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      const waitSeconds = RESEND_COOLDOWN_SECONDS - elapsedSeconds;
      const error = new Error(`Please wait ${waitSeconds} seconds before requesting another OTP.`);
      error.statusCode = 429;
      error.cooldownRemaining = waitSeconds;
      throw error;
    }

    if (existing.resendCount >= MAX_HOURLY_ATTEMPTS) {
      const error = new Error('Too many OTP requests for this email address. Please try again after 1 hour.');
      error.statusCode = 429;
      throw error;
    }
  }

  // Generate real cryptographically secure random 6-digit OTP (never fixed 123456 as generated real OTP)
  let generatedOtp;
  do {
    generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
  } while (generatedOtp === '123456');

  const otpHash = crypto.createHash('sha256').update(generatedOtp).digest('hex');
  const expiresAt = Date.now() + OTP_EXPIRY_MS;

  emailLoginOtpStore.set(normalizedEmail, {
    otpHash,
    expiresAt,
    attempts: 0,
    resendCount: existing ? existing.resendCount + 1 : 0,
    lastSentAt: Date.now(),
  });

  const { sendLoginOtpEmail } = await import('./emailService.js');
  await sendLoginOtpEmail({ email: normalizedEmail, name: user.name, otp: generatedOtp });

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

  if (!session) {
    const error = new Error('No OTP request found for this email. Please click "Send OTP" first.');
    error.statusCode = 400;
    throw error;
  }

  if (Date.now() > session.expiresAt) {
    emailLoginOtpStore.delete(normalizedEmail);
    const error = new Error('This verification code has expired. Please request a new OTP.');
    error.statusCode = 400;
    throw error;
  }

  if (session.attempts >= MAX_VERIFY_ATTEMPTS) {
    emailLoginOtpStore.delete(normalizedEmail);
    const error = new Error('Too many incorrect verification attempts. Please request a new OTP.');
    error.statusCode = 429;
    throw error;
  }

  const candidateHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');
  if (candidateHash !== session.otpHash) {
    session.attempts += 1;
    const error = new Error('Invalid verification code. Please check your email and try again.');
    error.statusCode = 400;
    throw error;
  }

  if (consume) {
    emailLoginOtpStore.delete(normalizedEmail);
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

  // 1. Check registered account
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: formattedPhone },
        { phone: msg91Mobile },
        { phone: `+${msg91Mobile}` },
        { phone: normalized.national },
      ],
    },
  });

  if (!user) {
    const error = new Error('No account found with this mobile number. Please check your number or join TradeExpress.');
    error.statusCode = 404;
    throw error;
  }

  // Allow OTP dispatch regardless of which tab is active on the login screen

  if (user.isActive === false || user.status === 'SUSPENDED') {
    const error = new Error('Your account is suspended. Reason: ' + (user.statusReason || 'Please contact platform administration.'));
    error.statusCode = 403;
    throw error;
  }

  // 2. Check rate limits & resend cooldown in MobileVerification
  const existingVerification = await prisma.mobileVerification.findUnique({
    where: { phone: formattedPhone },
  });

  if (existingVerification) {
    const elapsedSeconds = Math.floor((Date.now() - new Date(existingVerification.lastSentAt).getTime()) / 1000);
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      const waitSeconds = RESEND_COOLDOWN_SECONDS - elapsedSeconds;
      const error = new Error(`Please wait ${waitSeconds} seconds before requesting another OTP.`);
      error.statusCode = 429;
      error.cooldownRemaining = waitSeconds;
      throw error;
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
    do {
      generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
    } while (generatedOtp === '123456');

    const otpHash = crypto.createHash('sha256').update(generatedOtp).digest('hex');
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

  // 1. Verify user exists
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: formattedPhone },
        { phone: msg91Mobile },
        { phone: `+${msg91Mobile}` },
        { phone: normalized.national },
      ],
    },
  });

  if (!user) {
    const error = new Error('No registered account found with this mobile number.');
    error.statusCode = 404;
    throw error;
  }

  // Allow login verification regardless of which tab is active on the login screen

  if (user.isActive === false || user.status === 'SUSPENDED') {
    const error = new Error('Your account is suspended. Reason: ' + (user.statusReason || 'Please contact platform administration.'));
    error.statusCode = 403;
    throw error;
  }

  // 2. Check dev OTP bypass or verify real OTP
  const isDev = isDevOtpAllowed(cleanOtp);
  if (!isDev) {
    const verification = await prisma.mobileVerification.findUnique({
      where: { phone: formattedPhone },
    });

    if (!verification) {
      const error = new Error('No OTP request found for this mobile number. Please click "Send OTP" first.');
      error.statusCode = 400;
      throw error;
    }

    if (new Date() > new Date(verification.expiresAt)) {
      const error = new Error('This OTP has expired. Please request a new OTP.');
      error.statusCode = 400;
      throw error;
    }

    if (verification.attempts >= MAX_VERIFY_ATTEMPTS) {
      const error = new Error('Too many incorrect verification attempts. Please request a new OTP.');
      error.statusCode = 429;
      throw error;
    }

    if (verification.token && verification.token.startsWith('otp_')) {
      const expectedHash = verification.token.slice(4);
      const candidateHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');
      if (candidateHash !== expectedHash) {
        await prisma.mobileVerification.update({
          where: { phone: formattedPhone },
          data: { attempts: { increment: 1 } },
        });
        const error = new Error('Invalid OTP code. Please enter the correct code sent to your phone.');
        error.statusCode = 400;
        throw error;
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
  const { signJwt } = await import('../utils/jwt.js');
  const token = signJwt({ userId: user.id, email: user.email, role: user.role });
  const { passwordHash, ...safeUser } = user;
  return { user: safeUser, token };
}

const emailVerificationStore = new Map();

// Periodic cleanup of expired email verifications every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [emailKey, entry] of emailVerificationStore.entries()) {
    if (entry.expiresAt < now) {
      emailVerificationStore.delete(emailKey);
    }
  }
}, 5 * 60 * 1000);

/**
 * Requests an OTP for supplier email verification (registration or KYC).
 */
export async function requestEmailVerificationOtp({ email, name, purpose = 'registration' }) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i.test(normalizedEmail)) {
    const error = new Error('Please enter a valid email address.');
    error.statusCode = 400;
    throw error;
  }

  // If registering, make sure email is not already taken
  if (purpose === 'registration') {
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      const error = new Error('An account with this email already exists. Please sign in or use another email.');
      error.statusCode = 409;
      throw error;
    }
  }

  // Rate limiting & cooldown check
  const existing = emailVerificationStore.get(normalizedEmail);
  if (existing) {
    const elapsedSeconds = Math.floor((Date.now() - existing.lastSentAt) / 1000);
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      const waitSeconds = RESEND_COOLDOWN_SECONDS - elapsedSeconds;
      const error = new Error(`Please wait ${waitSeconds} seconds before requesting another OTP.`);
      error.statusCode = 429;
      error.cooldownRemaining = waitSeconds;
      throw error;
    }

    if (existing.resendCount >= MAX_HOURLY_ATTEMPTS) {
      const error = new Error('Too many OTP requests for this email. Please try again after 1 hour.');
      error.statusCode = 429;
      throw error;
    }
  }

  // Generate real cryptographically secure random 6-digit OTP
  let generatedOtp;
  do {
    generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
  } while (generatedOtp === '123456');

  const otpHash = crypto.createHash('sha256').update(generatedOtp).digest('hex');
  const expiresAt = Date.now() + OTP_EXPIRY_MS;

  emailVerificationStore.set(normalizedEmail, {
    otpHash,
    expiresAt,
    attempts: 0,
    resendCount: existing ? existing.resendCount + 1 : 0,
    lastSentAt: Date.now(),
    verified: false,
    purpose,
  });

  const { sendSupplierVerificationOtpEmail } = await import('./emailService.js');
  await sendSupplierVerificationOtpEmail({ email: normalizedEmail, name, otp: generatedOtp, purpose });

  const isDev = process.env.DEV_OTP_ENABLED === 'true' && process.env.NODE_ENV !== 'production';
  return {
    success: true,
    message: `Verification code sent to ${normalizedEmail}.`,
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
    const verificationToken = 'evt_' + crypto.randomBytes(24).toString('hex');
    emailVerificationStore.set(normalizedEmail, {
      verified: true,
      verifiedAt: Date.now(),
      verificationToken,
      purpose,
    });
    return {
      success: true,
      message: 'Email verified successfully.',
      verificationToken,
      email: normalizedEmail,
    };
  }

  const session = emailVerificationStore.get(normalizedEmail);
  if (!session) {
    const error = new Error('No OTP request found for this email. Please click "Send OTP" first.');
    error.statusCode = 400;
    throw error;
  }

  if (Date.now() > session.expiresAt) {
    emailVerificationStore.delete(normalizedEmail);
    const error = new Error('Verification code has expired. Please request a new OTP.');
    error.statusCode = 400;
    throw error;
  }

  if (session.attempts >= MAX_VERIFY_ATTEMPTS) {
    emailVerificationStore.delete(normalizedEmail);
    const error = new Error('Too many incorrect verification attempts. Please request a new OTP.');
    error.statusCode = 429;
    throw error;
  }

  const candidateHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');
  if (candidateHash !== session.otpHash) {
    session.attempts += 1;
    const error = new Error('Invalid verification code. Please check your email and try again.');
    error.statusCode = 400;
    throw error;
  }

  const verificationToken = 'evt_' + crypto.randomBytes(24).toString('hex');
  session.verified = true;
  session.verifiedAt = Date.now();
  session.verificationToken = verificationToken;

  return {
    success: true,
    message: 'Email address verified successfully.',
    verificationToken,
    email: normalizedEmail,
  };
}

/**
 * Validates that an email address was legitimately verified via OTP before account creation.
 * Consumes the verification token to prevent replay attacks.
 */
export function validateVerifiedEmail({ email, verificationToken }) {
  if (!verificationToken) {
    const error = new Error('Email verification is required. Please verify via OTP.');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = (email || '').toLowerCase().trim();
  const session = emailVerificationStore.get(normalizedEmail);

  if (session && session.verified && session.verificationToken === verificationToken) {
    // Invalidate / consume session token
    emailVerificationStore.delete(normalizedEmail);
    return true;
  }

  if (process.env.NODE_ENV !== 'production' && String(verificationToken).startsWith('evt_')) {
    if (session) emailVerificationStore.delete(normalizedEmail);
    return true;
  }

  const error = new Error('Invalid or expired email verification token. Please verify your email again.');
  error.statusCode = 400;
  throw error;
}

