import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { ENV } from '../../src/config/env.js';
import { issueVerifiedEmailToken, validateVerifiedEmail } from '../../src/services/otpService.js';
import { signJwt } from '../../src/utils/jwt.js';

const EMAIL = 'supplier@example.com';
const expired = (error) => error.statusCode === 400 && error.errorCode === 'EMAIL_VERIFICATION_EXPIRED';

describe('Email verification token', () => {
  it('stays valid across repeated signup attempts, so correcting another field does not mean verifying again', () => {
    const token = issueVerifiedEmailToken(EMAIL);
    assert.equal(validateVerifiedEmail({ email: EMAIL, verificationToken: token }), true);
    assert.equal(validateVerifiedEmail({ email: EMAIL, verificationToken: token }), true);
  });

  it('ignores letter case and spaces in the email', () => {
    const token = issueVerifiedEmailToken(' Supplier@Example.com ');
    assert.equal(validateVerifiedEmail({ email: 'SUPPLIER@example.com', verificationToken: token }), true);
  });

  it('only works for the email that was verified', () => {
    const token = issueVerifiedEmailToken(EMAIL);
    assert.throws(() => validateVerifiedEmail({ email: 'someone.else@example.com', verificationToken: token }), expired);
  });

  it('refuses a missing, altered, made-up or expired token', () => {
    assert.throws(() => validateVerifiedEmail({ email: EMAIL, verificationToken: '' }), { statusCode: 400 });
    const token = issueVerifiedEmailToken(EMAIL);
    assert.throws(() => validateVerifiedEmail({ email: EMAIL, verificationToken: `${token.slice(0, -2)}xx` }), expired);
    assert.throws(() => validateVerifiedEmail({ email: EMAIL, verificationToken: 'evt_verified' }), expired);
    const old = jwt.sign({ purpose: 'EMAIL_VERIFIED', email: EMAIL, exp: Math.floor(Date.now() / 1000) - 10 }, `${ENV.JWT_SECRET}:email-verified`);
    assert.throws(() => validateVerifiedEmail({ email: EMAIL, verificationToken: old }), expired);
  });

  it('cannot be swapped with a login token, in either direction', () => {
    const login = signJwt({ userId: 'u1', email: EMAIL, role: 'SUPPLIER', purpose: 'EMAIL_VERIFIED' });
    assert.throws(() => validateVerifiedEmail({ email: EMAIL, verificationToken: login }), expired);
    assert.throws(() => jwt.verify(issueVerifiedEmailToken(EMAIL), ENV.JWT_SECRET));
  });
});
