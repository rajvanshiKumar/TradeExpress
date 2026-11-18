import jwt from 'jsonwebtoken';
import { ENV } from '../../src/config/env.js';
import { secretHash } from '../../src/services/verificationService.js';

export const TEST_AADHAAR = '234123412346';
export const TEST_PAN = 'ABCDE1234F';
export const TEST_AADHAAR_VERIFICATION_ID = 'av-test';

/**
 * Signup fields of an Indian user whose Aadhaar was verified with OTP and whose PAN was verified as linked,
 * signed the same way the verification endpoints sign them (no provider or database involved).
 */
export function verifiedIdentity({ aadhaar = TEST_AADHAAR, pan = TEST_PAN, verificationId = TEST_AADHAAR_VERIFICATION_ID } = {}) {
  const a = secretHash(`aadhaar:${aadhaar}`);
  return {
    aadhaarNumber: aadhaar,
    aadhaarConsent: true,
    pan,
    aadhaarVerificationToken: jwt.sign({ purpose: 'AADHAAR_OTP_VERIFIED', v: verificationId, a, env: 'uat' }, ENV.JWT_SECRET, { expiresIn: '30m' }),
    panAadhaarToken: jwt.sign({ purpose: 'PAN_AADHAAR_LINK', a, p: secretHash(`pan:${pan}`), maskedPan: `${pan.slice(0, 2)}XXXXXX${pan.slice(-2)}`, last4: aadhaar.slice(-4) }, ENV.JWT_SECRET, { expiresIn: '30m' }),
    panAadhaarStatus: 'LINKED',
    panAadhaarLinked: true,
  };
}

/**
 * Answers the identity queries made during signup for a prisma middleware stub: the Aadhaar verification exists,
 * is VERIFIED and unused, and no other account holds the Aadhaar. Returns undefined for other queries.
 */
export function identityQuery(query, { verificationId = TEST_AADHAAR_VERIFICATION_ID } = {}) {
  if (query.model !== 'AadhaarVerification' && query.model !== 'PanAadhaarLinkCheck') return undefined;
  if (query.model === 'AadhaarVerification' && query.action === 'findUnique') {
    return { id: verificationId, status: 'VERIFIED', usedAt: null, environment: 'uat' };
  }
  if (query.action === 'findFirst') return null;
  if (query.action === 'updateMany') return { count: 1 };
  return null;
}
