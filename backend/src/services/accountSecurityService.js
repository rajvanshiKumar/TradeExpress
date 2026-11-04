import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { ENV } from '../config/env.js';
import { reissueCurrentToken } from './sessionService.js';
import { getRequestContext } from '../utils/requestContext.js';
import { validatePassword } from '../utils/passwordValidator.js';
import { isDevOtpAllowed, normalizeMobile, validateVerifiedMobile } from './otpService.js';
import { maskEmail, maskPhone } from './accountService.js';
import { sendAccountCodeEmail, sendAccountSecurityEmail } from './emailService.js';

/*
 * Verified account changes (Account Settings): change password, change email.
 *
 * - Codes: 6 digits from crypto.randomInt, stored only as an HMAC, valid 5 minutes, at most 5 attempts,
 *   single use, bound to one user and one purpose. Resend cooldown and hourly limit are enforced here.
 * - After a code is verified the server issues a single-use authorization ("grant", valid 10 minutes),
 *   also stored only as an HMAC. Consuming it is atomic, so concurrent requests cannot reuse it.
 * - Codes and passwords are never logged or returned.
 */

export const CODE_TTL_MS = 5 * 60 * 1000;
export const GRANT_TTL_MS = 10 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const MAX_SENDS_PER_HOUR = 5;

const SELF_EMAIL_PURPOSES = ['PASSWORD_CHANGE', 'EMAIL_CHANGE_CURRENT', 'ACCOUNT_DELETE', 'PHONE_CHANGE'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;

const keyedHash = (value) => crypto.createHmac('sha256', ENV.JWT_SECRET).update(String(value)).digest('hex');
const codeHash = (recordId, otp) => keyedHash(`otp:${recordId}:${otp}`);
const grantHashOf = (grant) => keyedHash(`grant:${grant}`);

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function fail(message, statusCode = 400, code = 'ACCOUNT_VERIFICATION_ERROR', extra = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = code; // returned to the client as "code" by the error handler
  if (extra.retryAfterSeconds) error.cooldownRemaining = extra.retryAfterSeconds;
  Object.assign(error, extra);
  return error;
}

function generateCode() {
  let otp;
  do {
    otp = String(crypto.randomInt(100000, 1000000));
  } while (otp === '123456');
  return otp;
}

async function loadUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, role: true, passwordHash: true } });
  if (!user) throw fail('Account not found.', 404, 'NOT_FOUND');
  return user;
}

/** Creates (or replaces) the pending code for this user + purpose and emails it to `target`. */
async function issueCode(user, purpose, target, relatedId = null) {
  const now = Date.now();
  const latest = await prisma.accountVerification.findFirst({
    where: { userId: user.id, purpose, consumedAt: null, verifiedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (latest && now - latest.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    const retryAfterSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - latest.lastSentAt.getTime())) / 1000);
    throw fail(`Please wait ${retryAfterSeconds} seconds before requesting a new code.`, 429, 'OTP_COOLDOWN', { retryAfterSeconds });
  }
  const sentLastHour = await prisma.accountVerification.count({ where: { userId: user.id, purpose, createdAt: { gt: new Date(now - 60 * 60 * 1000) } } });
  if (sentLastHour >= MAX_SENDS_PER_HOUR) {
    throw fail('Too many verification codes requested. Please try again in an hour.', 429, 'OTP_RATE_LIMITED');
  }

  // A new code replaces any earlier pending one for the same purpose
  await prisma.accountVerification.updateMany({
    where: { userId: user.id, purpose, consumedAt: null, verifiedAt: null },
    data: { consumedAt: new Date(now) },
  });

  const id = crypto.randomUUID();
  const otp = generateCode();
  await prisma.accountVerification.create({
    data: {
      id, userId: user.id, purpose, target, otpHash: codeHash(id, otp), relatedId,
      lastSentAt: new Date(now), expiresAt: new Date(now + CODE_TTL_MS),
    },
  });

  const sent = await sendAccountCodeEmail({ email: target, name: user.name, otp, purpose });
  if (!sent.success) {
    await prisma.accountVerification.delete({ where: { id } }).catch(() => {});
    throw fail('We could not send the verification email right now. Please try again in a moment.', 502, 'EMAIL_NOT_SENT');
  }
  return { maskedTarget: maskEmail(target), expiresInSeconds: CODE_TTL_MS / 1000, resendAfterSeconds: RESEND_COOLDOWN_MS / 1000 };
}

/** Checks a submitted code against the pending record; counts failed attempts. Returns the record. */
async function checkCode(userId, purpose, otp, extraWhere = {}) {
  const cleanOtp = String(otp || '').trim();
  if (!/^\d{6}$/.test(cleanOtp)) throw fail('Enter the 6-digit code from the email.', 400, 'OTP_INVALID');

  const record = await prisma.accountVerification.findFirst({
    where: { userId, purpose, consumedAt: null, verifiedAt: null, ...extraWhere },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) throw fail('No active code. Please request a new verification code.', 400, 'OTP_NOT_REQUESTED');
  if (record.expiresAt.getTime() < Date.now()) throw fail('This code has expired. Please request a new one.', 400, 'OTP_EXPIRED');
  if (record.attempts >= MAX_ATTEMPTS) {
    await prisma.accountVerification.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    throw fail('Too many incorrect attempts. Please request a new code.', 429, 'OTP_ATTEMPTS_EXCEEDED');
  }

  // Testing bypass (123456) works only outside production, exactly like the sign-in codes
  if (!isDevOtpAllowed(cleanOtp) && !safeEqual(record.otpHash, codeHash(record.id, cleanOtp))) {
    const attempts = record.attempts + 1;
    await prisma.accountVerification.update({
      where: { id: record.id },
      data: { attempts, ...(attempts >= MAX_ATTEMPTS ? { consumedAt: new Date() } : {}) },
    });
    const left = MAX_ATTEMPTS - attempts;
    throw left > 0
      ? fail(`Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.`, 400, 'OTP_INVALID', { attemptsLeft: left })
      : fail('Too many incorrect attempts. Please request a new code.', 429, 'OTP_ATTEMPTS_EXCEEDED');
  }
  return record;
}

/** Atomically marks a verified record's grant as used. Throws if it is missing, expired or already used. */
async function consumeGrant(tx, userId, purpose, grant) {
  if (!grant || typeof grant !== 'string') throw fail('Please verify your email again to continue.', 400, 'GRANT_REQUIRED');
  const record = await tx.accountVerification.findFirst({
    where: { userId, purpose, grantHash: grantHashOf(grant), consumedAt: null, grantExpiresAt: { gt: new Date() } },
  });
  if (!record) throw fail('This verification has expired or was already used. Please verify your email again.', 400, 'GRANT_INVALID');
  const { count } = await tx.accountVerification.updateMany({ where: { id: record.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (count !== 1) throw fail('This verification was already used. Please verify your email again.', 409, 'GRANT_INVALID');
  return record;
}

/** Used by other verified actions (e.g. account deletion) to consume their authorization inside a transaction. */
export const consumeAccountGrant = (tx, userId, purpose, grant) => consumeGrant(tx, userId, purpose, grant);

/** Step 1 of change password / change email / delete account: send a code to the account's current email. */
export async function sendAccountCode(userId, purpose) {
  if (!SELF_EMAIL_PURPOSES.includes(purpose)) throw fail('Unknown verification purpose.', 400, 'BAD_PURPOSE');
  const user = await loadUser(userId);
  return issueCode(user, purpose, user.email);
}

/** Step 2: verify the code and receive a single-use authorization for the next step. */
export async function verifyAccountCode(userId, purpose, otp) {
  if (!SELF_EMAIL_PURPOSES.includes(purpose)) throw fail('Unknown verification purpose.', 400, 'BAD_PURPOSE');
  const record = await checkCode(userId, purpose, otp);
  const grant = crypto.randomBytes(32).toString('hex');
  await prisma.accountVerification.update({
    where: { id: record.id },
    data: { verifiedAt: new Date(), grantHash: grantHashOf(grant), grantExpiresAt: new Date(Date.now() + GRANT_TTL_MS) },
  });
  return { grant, expiresInSeconds: GRANT_TTL_MS / 1000 };
}

/** Rejects every login token issued before now (whole seconds, matching the token's "iat"). */
const sessionCutoff = () => new Date(Math.floor(Date.now() / 1000) * 1000);
/** A fresh token for this device (same signed-in session) after a password or email change. */
const tokenFor = (user, email) => reissueCurrentToken(user, { email });

/** Change password with an authorization from a verified email code. Signs out every other session. */
export async function changePasswordWithGrant(userId, { grant, newPassword, confirmPassword }) {
  const user = await loadUser(userId);
  const check = validatePassword(newPassword);
  if (!check.isValid) throw fail(check.message, 400, 'WEAK_PASSWORD');
  if (newPassword !== confirmPassword) throw fail('The passwords do not match.', 400, 'PASSWORD_MISMATCH');
  if (await bcrypt.compare(newPassword, user.passwordHash)) throw fail('Choose a password you have not used for this account.', 400, 'PASSWORD_REUSED');

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction(async (tx) => {
    await consumeGrant(tx, userId, 'PASSWORD_CHANGE', grant);
    await tx.user.update({ where: { id: userId }, data: { passwordHash, sessionsValidAfter: sessionCutoff() } });
    // Every other signed-in device is signed out
    const { sessionId } = getRequestContext();
    await tx.userSession.updateMany({ where: { userId, revokedAt: null, ...(sessionId ? { id: { not: sessionId } } : {}) }, data: { revokedAt: new Date() } });
    // Any other password-change codes still pending are no longer needed
    await tx.accountVerification.updateMany({ where: { userId, purpose: 'PASSWORD_CHANGE', consumedAt: null }, data: { consumedAt: new Date() } });
  }, { maxWait: 10000, timeout: 20000 });

  await prisma.auditLog.create({ data: { actorId: userId, actorEmail: user.email, actorRole: user.role, action: 'PASSWORD_CHANGE', resource: 'ACCOUNT', targetId: userId, result: 'SUCCESS' } }).catch(() => {});
  sendAccountSecurityEmail({ email: user.email, name: user.name, subject: 'Your TradeExpress password was changed', message: 'The password for your TradeExpress account was just changed, and other devices were signed out.' });
  return { token: await tokenFor(user, user.email) };
}

/** Change email, step 3: with the current-email authorization, send a code to the proposed new email. */
export async function requestEmailChange(userId, { grant, newEmail }) {
  const user = await loadUser(userId);
  const cleanEmail = String(newEmail || '').trim().toLowerCase();
  if (!EMAIL_REGEX.test(cleanEmail) || cleanEmail.length > 190) throw fail('Enter a valid email address.', 400, 'INVALID_EMAIL');
  if (cleanEmail === user.email.toLowerCase()) throw fail('The new email address must be different from your current one.', 400, 'SAME_EMAIL');

  // The current-email authorization must still be valid (it is consumed only when the change completes)
  const current = await prisma.accountVerification.findFirst({
    where: { userId, purpose: 'EMAIL_CHANGE_CURRENT', grantHash: grantHashOf(grant || ''), consumedAt: null, grantExpiresAt: { gt: new Date() } },
  });
  if (!current) throw fail('Your verification has expired. Please verify your current email again.', 400, 'GRANT_INVALID');

  const taken = await prisma.user.findFirst({ where: { email: cleanEmail }, select: { id: true } });
  if (taken) throw fail('This email address is already registered with TradeExpress.', 409, 'EMAIL_TAKEN');

  return issueCode(user, 'EMAIL_CHANGE_NEW', cleanEmail, current.id);
}

/** Change email, step 4: verify the new-email code and update the email atomically. */
export async function completeEmailChange(userId, { grant, otp }) {
  const user = await loadUser(userId);
  const current = await prisma.accountVerification.findFirst({
    where: { userId, purpose: 'EMAIL_CHANGE_CURRENT', grantHash: grantHashOf(grant || ''), consumedAt: null, grantExpiresAt: { gt: new Date() } },
  });
  if (!current) throw fail('Your verification has expired. Please start the email change again.', 400, 'GRANT_INVALID');

  const pending = await checkCode(userId, 'EMAIL_CHANGE_NEW', otp, { relatedId: current.id });
  const newEmail = pending.target;
  const oldEmail = user.email;

  await prisma.$transaction(async (tx) => {
    // Both authorizations are consumed together; a concurrent request finds them already used
    await consumeGrant(tx, userId, 'EMAIL_CHANGE_CURRENT', grant);
    const { count } = await tx.accountVerification.updateMany({ where: { id: pending.id, consumedAt: null }, data: { verifiedAt: new Date(), consumedAt: new Date() } });
    if (count !== 1) throw fail('This code was already used. Please start again.', 409, 'OTP_USED');
    const taken = await tx.user.findFirst({ where: { email: newEmail, NOT: { id: userId } }, select: { id: true } });
    if (taken) throw fail('This email address is already registered with TradeExpress.', 409, 'EMAIL_TAKEN');
    // Only if the email has not changed since the process started
    const updated = await tx.user.updateMany({ where: { id: userId, email: oldEmail }, data: { email: newEmail } });
    if (updated.count !== 1) throw fail('Your email was changed in another session. Please refresh and try again.', 409, 'EMAIL_CHANGED');
    await tx.accountVerification.updateMany({ where: { userId, purpose: { in: ['EMAIL_CHANGE_CURRENT', 'EMAIL_CHANGE_NEW', 'PASSWORD_CHANGE'] }, consumedAt: null }, data: { consumedAt: new Date() } });
  }, { maxWait: 10000, timeout: 20000 });

  await prisma.auditLog.create({ data: { actorId: userId, actorEmail: newEmail, actorRole: user.role, action: 'EMAIL_CHANGE', resource: 'ACCOUNT', targetId: userId, details: { from: maskEmail(oldEmail), to: maskEmail(newEmail) }, result: 'SUCCESS' } }).catch(() => {});
  sendAccountSecurityEmail({ email: oldEmail, name: user.name, subject: 'Your TradeExpress email address was changed', message: `The email address for your TradeExpress account was changed to ${maskEmail(newEmail)}. This address will no longer receive account emails.` });
  sendAccountSecurityEmail({ email: newEmail, name: user.name, subject: 'Your new TradeExpress email address is confirmed', message: 'This is now the email address for your TradeExpress account.' });
  return { email: newEmail, maskedEmail: maskEmail(newEmail), token: await tokenFor(user, newEmail) };
}

/**
 * Change phone number. Needs the email authorization (PHONE_CHANGE) and the single-use token from verifying the new
 * number by SMS (the SMS step already refuses numbers that belong to another account).
 */
export async function changePhoneWithGrant(userId, { grant, phone, country = 'India', verificationToken }) {
  const user = await loadUser(userId);
  const normalized = normalizeMobile(phone, country);
  if (!normalized.ok) throw fail('Enter a valid mobile number.', 400, 'INVALID_PHONE');
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
  if (current?.phone === normalized.formattedPhone) throw fail('This is already your phone number.', 400, 'SAME_PHONE');
  const taken = await prisma.user.findFirst({ where: { phone: normalized.formattedPhone, NOT: { id: userId } }, select: { id: true } });
  if (taken) throw fail('This mobile number is already registered with TradeExpress.', 409, 'PHONE_TAKEN');

  // The email authorization must still be valid before the single-use SMS token is spent
  const pending = await prisma.accountVerification.findFirst({
    where: { userId, purpose: 'PHONE_CHANGE', grantHash: grantHashOf(grant || ''), consumedAt: null, grantExpiresAt: { gt: new Date() } },
    select: { id: true },
  });
  if (!pending) throw fail('Your verification has expired. Please verify your email again.', 400, 'GRANT_INVALID');
  await validateVerifiedMobile({ phone, country, verificationToken });

  await prisma.$transaction(async (tx) => {
    await consumeGrant(tx, userId, 'PHONE_CHANGE', grant);
    await tx.user.update({ where: { id: userId }, data: { phone: normalized.formattedPhone, isPhoneVerified: true } });
  }, { maxWait: 10000, timeout: 20000 });

  const masked = maskPhone(normalized.formattedPhone);
  await prisma.auditLog.create({ data: { actorId: userId, actorEmail: user.email, actorRole: user.role, action: 'PHONE_CHANGE', resource: 'ACCOUNT', targetId: userId, details: { to: masked }, result: 'SUCCESS' } }).catch(() => {});
  sendAccountSecurityEmail({ email: user.email, name: user.name, subject: 'Your TradeExpress phone number was changed', message: `The mobile number on your TradeExpress account was changed to ${masked}.` });
  return { phone: normalized.formattedPhone, maskedPhone: masked };
}
