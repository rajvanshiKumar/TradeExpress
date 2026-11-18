import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDevOtpAllowed,
  verifyEmailVerificationOtp,
  validateVerifiedEmail,
  verifyMobileOtp,
  validateVerifiedMobile,
} from '../../src/services/otpService.js';

describe('Signup OTP Verification Suite (Original OTP and 123456)', () => {
  describe('1. Dev Test Code 123456 for Email and Mobile Signup', () => {
    it('verifies email signup directly using test code 123456', async () => {
      const email = 'testbuyer-dev@example.com';
      const result = await verifyEmailVerificationOtp({
        email,
        otp: '123456',
        purpose: 'registration',
      });

      assert.equal(result.success, true);
      assert.ok(result.verificationToken, 'Must issue a signed verification token');
      assert.equal(result.email, email);

      // Verify that validateVerifiedEmail accepts the issued token
      const isValid = validateVerifiedEmail({
        email,
        verificationToken: result.verificationToken,
      });
      assert.equal(isValid, true, 'validateVerifiedEmail must accept the token');
    });

    it('verifies mobile signup directly using test code 123456', async () => {
      const phone = '9876543210';
      const result = await verifyMobileOtp({
        phone,
        country: 'India',
        otp: '123456',
      });

      assert.equal(result.success, true);
      assert.ok(result.data?.verificationToken, 'Must issue a mobile verification token');

      // Verify token is accepted
      const isValid = await validateVerifiedMobile({
        phone: result.data.phone || '+91 9876543210',
        country: 'India',
        verificationToken: result.data.verificationToken,
      });
      assert.ok(isValid);
    });
  });

  describe('2. Invalid OTP Rejection and Edge Cases', () => {
    it('rejects incorrect codes with OTP_INVALID error code', async () => {
      await assert.rejects(
        async () => {
          await verifyEmailVerificationOtp({
            email: 'unrequested@example.com',
            otp: '999999',
          });
        },
        (err) => err.statusCode === 400
      );
    });

    it('rejects empty or malformed OTPs', async () => {
      await assert.rejects(
        async () => {
          await verifyEmailVerificationOtp({
            email: 'test@example.com',
            otp: '',
          });
        },
        (err) => err.statusCode === 400
      );

      await assert.rejects(
        async () => {
          await verifyMobileOtp({
            phone: '9876543210',
            otp: '12',
          });
        },
        (err) => err.statusCode === 400
      );
    });
  });

  describe('3. Production Rejection of Dev Code', () => {
    it('is never accepted when NODE_ENV is production', () => {
      const savedEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        assert.equal(isDevOtpAllowed('123456'), false);
      } finally {
        process.env.NODE_ENV = savedEnv;
      }
    });

    it('is never accepted when DEV_OTP_ENABLED is false', () => {
      const savedDevOtp = process.env.DEV_OTP_ENABLED;
      process.env.DEV_OTP_ENABLED = 'false';
      try {
        assert.equal(isDevOtpAllowed('123456'), false);
      } finally {
        process.env.DEV_OTP_ENABLED = savedDevOtp;
      }
    });
  });
});
