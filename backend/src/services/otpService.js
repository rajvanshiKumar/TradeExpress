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

  const isDev = process.env.NODE_ENV !== 'production';
  const effectiveDevOtp = isDev ? (smsResult?.devOtp || generatedOtp) : undefined;

  let message = 'OTP has been sent to your mobile number via SMS.';
  if (isDev && smsResult && !smsResult.delivered) {
    message = `[Dev Mode] Gateway: ${smsResult.gatewayDescription || 'carrier delay'}. Test OTP: ${effectiveDevOtp}`;
  }

  return {
    success: true,
    message,
    devOtp: effectiveDevOtp,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
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

  const isDev = process.env.NODE_ENV !== 'production';
  const effectiveDevOtp = isDev ? (smsResult?.devOtp || generatedOtp) : undefined;

  let message = 'OTP has been resent to your mobile number.';
  if (isDev && smsResult && !smsResult.delivered) {
    message = `[Dev Mode] Gateway: ${smsResult.gatewayDescription || 'carrier delay'}. Test OTP: ${effectiveDevOtp}`;
  }

  return {
    success: true,
    message,
    devOtp: effectiveDevOtp,
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
