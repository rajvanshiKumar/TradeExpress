import prisma from '../config/db.js';
import { secretHash } from './verificationService.js';

/*
 * Suspended identities: once an account is suspended, its email, PAN and Aadhaar cannot be used for a new signup
 * (or a new Google account), even if the suspended account is later deleted. Only keyed hashes are stored.
 * Reactivating the account removes the block.
 */

export const SUSPENDED_IDENTITY_CODE = 'IDENTITY_SUSPENDED';

const MESSAGES = {
  EMAIL: 'This email is linked to a suspended TradeExpress account and cannot be used again. Please contact TradeExpress support.',
  PAN: 'This PAN is linked to a suspended TradeExpress account and cannot be used again. Please contact TradeExpress support.',
  AADHAAR: 'This Aadhaar is linked to a suspended TradeExpress account and cannot be used again. Please contact TradeExpress support.',
};

export function suspendedIdentityError(kind) {
  const error = new Error(MESSAGES[kind] || MESSAGES.EMAIL);
  error.statusCode = 403;
  error.errorCode = SUSPENDED_IDENTITY_CODE;
  error.code = SUSPENDED_IDENTITY_CODE;
  return error;
}

/** The stored hash for a value; Aadhaar uses the same hash as the Aadhaar OTP records. */
export function identityHash(kind, value) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (kind === 'EMAIL') return secretHash(`email:${text.toLowerCase()}`);
  if (kind === 'PAN') return secretHash(`pan:${text.toUpperCase()}`);
  if (kind === 'AADHAAR') return /^\d{12}$/.test(text) ? secretHash(`aadhaar:${text}`) : null;
  return null;
}

/** True when the hash belongs to a suspended identity. */
export async function isIdentityBlocked(kind, valueHash, db = prisma) {
  if (!valueHash || !db.blockedIdentity) return false;
  return Boolean(await db.blockedIdentity.findUnique({ where: { kind_valueHash: { kind, valueHash } }, select: { id: true } }));
}

/** Throws 403 IDENTITY_SUSPENDED when this email / PAN / Aadhaar number belongs to a suspended account. */
export async function assertIdentityNotSuspended(kind, value, db = prisma) {
  if (await isIdentityBlocked(kind, identityHash(kind, value), db)) throw suspendedIdentityError(kind);
}

/** Records the email, PAN and every OTP-verified Aadhaar of a suspended account. */
export async function blockUserIdentities(userId, reason = null, db = prisma) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, pan: true, aadhaarVerifications: { where: { status: 'VERIFIED' }, select: { aadhaarHash: true } } },
  });
  if (!user) return 0;
  const rows = [
    ['EMAIL', identityHash('EMAIL', user.email)],
    ['PAN', identityHash('PAN', user.pan)],
    ...user.aadhaarVerifications.map((a) => ['AADHAAR', a.aadhaarHash]),
  ]
    .filter(([, valueHash]) => valueHash)
    .map(([kind, valueHash]) => ({ kind, valueHash, userId, reason: reason ? String(reason).slice(0, 1000) : null }));
  if (!rows.length) return 0;
  const result = await db.blockedIdentity.createMany({ data: rows, skipDuplicates: true });
  return result.count;
}

/** Lifts the blocks created for this account (when it is reactivated). */
export async function unblockUserIdentities(userId, db = prisma) {
  const result = await db.blockedIdentity.deleteMany({ where: { userId } });
  return result.count;
}
