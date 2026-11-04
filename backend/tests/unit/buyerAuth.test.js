import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import prisma from '../../src/config/db.js';
import { loginUser, registerBuyer } from '../../src/services/authService.js';
import { issueVerifiedEmailToken, resendMobileOtp, verifyMobileOtp } from '../../src/services/otpService.js';
import { sendOtp } from '../../src/services/msg91Service.js';

let prismaStub;
prisma.$use(async (params, next) => (prismaStub ? prismaStub(params) : null));

const registration = (overrides = {}) => ({
  name: 'Test Buyer', email: 'buyer@example.com', phone: '9876543210', country: 'India',
  password: 'Strong@Pass123', confirmPassword: 'Strong@Pass123', verificationToken: 'verified',
  emailVerificationToken: issueVerifiedEmailToken('buyer@example.com'), ...overrides,
});

function stubQueries(t, handler) {
  prismaStub = handler;
  t.after(() => { prismaStub = null; });
}

function useMockMsg91(t) {
  const names = ['MSG91_AUTH_KEY', 'MSG91_TEMPLATE_ID', 'SMS_API_URL', 'SMS_SENDER_ID'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  process.env.MSG91_AUTH_KEY = 'test-placeholder-key';
  process.env.MSG91_TEMPLATE_ID = 'test-placeholder-template';
  delete process.env.SMS_API_URL;
  delete process.env.SMS_SENDER_ID;
  t.after(() => names.forEach((name) => {
    if (previous[name] === undefined) delete process.env[name];
    else process.env[name] = previous[name];
  }));
}

describe('Buyer registration validation', () => {
  it('creates an account only after both verification proofs and marks both channels verified', async (t) => {
    const previousMode = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    t.after(() => {
      if (previousMode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousMode;
    });
    stubQueries(t, async (query) => {
      if (query.model === 'User' && query.action === 'findUnique') return null;
      if (query.model === 'User' && query.action === 'findFirst') return null;
      if (query.model === 'UserSession' && query.action === 'create') return { id: 'session-signup', ...query.args.data };
      if (query.model === 'User' && query.action === 'create') {
        return { id: 'buyer-test', ...query.args.data };
      }
      return null;
    });
    const result = await registerBuyer(registration());
    assert.equal(result.user.isVerified, true);
    assert.equal(result.user.isPhoneVerified, true);
    assert.equal(result.user.passwordHash, undefined);
    assert.ok(result.token);
  });

  it('rejects invalid email, invalid Indian mobile and weak passwords before account creation', async (t) => {
    stubQueries(t, async (query) => {
      if (query.model === 'User' && query.action === 'findUnique') return null;
      if (query.model === 'User' && query.action === 'findFirst') return null;
      throw new Error('Account creation must not be reached for invalid input.');
    });
    await assert.rejects(registerBuyer(registration({ email: 'invalid' })), (error) => error.statusCode === 400);
    await assert.rejects(registerBuyer(registration({ phone: '1234567890' })), (error) => error.statusCode === 400);
    await assert.rejects(registerBuyer(registration({ password: 'weak', confirmPassword: 'weak' })), (error) => error.statusCode === 400);
  });

  it('rejects an existing email or mobile number without creating another account', async (t) => {
    stubQueries(t, async (query) => {
      if (query.model === 'User' && query.action === 'findUnique') {
        return { id: 'existing', role: 'SUPPLIER', name: 'Existing Supplier', phone: '+91 9876543210', passwordHash: 'hash' };
      }
      if (query.model === 'User' && query.action === 'findFirst') return null;
      throw new Error('Duplicate email should stop the flow.');
    });
    await assert.rejects(registerBuyer(registration()), (error) => error.statusCode === 409);

    stubQueries(t, async (query) => {
      if (query.model === 'User' && query.action === 'findUnique') return null;
      if (query.model === 'User' && query.action === 'findFirst') return { id: 'existing' };
      throw new Error('Duplicate mobile should stop the flow.');
    });
    await assert.rejects(registerBuyer(registration()), (error) => error.statusCode === 409);
  });
});

describe('Buyer password sign-in', () => {
  it('signs in with a valid password and rejects wrong passwords and unknown accounts', async (t) => {
    const passwordHash = await bcrypt.hash('Strong@Pass123', 4);
    const user = {
      id: 'buyer-login-test', email: 'signin@example.com', name: 'Sign In Buyer', role: 'BUYER',
      phone: '+91 9876543210', passwordHash, company: 'Test Co', isActive: true, status: 'ACTIVE',
      googleId: null,
    };
    stubQueries(t, async (query) => {
      if (query.model === 'User' && query.action === 'findUnique') return user;
      if (query.model === 'UserSession' && query.action === 'create') return { id: 'session-login', ...query.args.data };
      return null;
    });
    const result = await loginUser({ email: user.email, password: 'Strong@Pass123', role: 'BUYER' });
    assert.equal(result.user.id, user.id);
    assert.equal(result.user.passwordHash, undefined);
    assert.ok(result.token);
    // Every sign-in is recorded as a session the user can see and sign out
    assert.equal(JSON.parse(Buffer.from(result.token.split('.')[1], 'base64url').toString()).sid, 'session-login');
    await assert.rejects(
      loginUser({ email: user.email, password: 'Wrong@Pass123', role: 'BUYER' }),
      (error) => error.statusCode === 401,
    );

    stubQueries(t, async () => null);
    await assert.rejects(
      loginUser({ email: 'unknown@example.com', password: 'Strong@Pass123', role: 'BUYER' }),
      (error) => error.statusCode === 404,
    );

    stubQueries(t, async () => ({ ...user, isActive: false, status: 'DEACTIVATED' }));
    await assert.rejects(
      loginUser({ email: user.email, password: 'Strong@Pass123', role: 'BUYER' }),
      (error) => error.statusCode === 403 && /deactivated/i.test(error.message),
    );
  });
});

describe('Buyer OTP provider handling', () => {
  const otpSource = fs.readFileSync(path.resolve('src/services/otpService.js'), 'utf8');
  const authSource = fs.readFileSync(path.resolve('src/services/authService.js'), 'utf8');
  const routeSource = fs.readFileSync(path.resolve('src/routes/authRoutes.js'), 'utf8');

  it('requires OTP expiry, attempt limits and one-time verification token consumption', () => {
    assert.match(otpSource, /new Date\(\)\s*>\s*new Date\(verification\.expiresAt\)/);
    assert.match(otpSource, /MAX_VERIFY_ATTEMPTS/);
    assert.match(otpSource, /updateMany\([\s\S]*?used:\s*false[\s\S]*?data:\s*\{\s*used:\s*true/);
    assert.match(authSource, /validateVerifiedEmail\([\s\S]*?\);\s*await validateVerifiedMobile/);
    assert.match(routeSource, /body\('confirmPassword'\)/);
  });

  it('accepts a successful mocked MSG91 delivery without exposing provider data', async (t) => {
    const previousKey = process.env.MSG91_AUTH_KEY;
    const previousTemplate = process.env.MSG91_TEMPLATE_ID;
    process.env.MSG91_AUTH_KEY = 'test-placeholder-key';
    process.env.MSG91_TEMPLATE_ID = 'test-placeholder-template';
    t.after(() => {
      if (previousKey === undefined) delete process.env.MSG91_AUTH_KEY;
      else process.env.MSG91_AUTH_KEY = previousKey;
      if (previousTemplate === undefined) delete process.env.MSG91_TEMPLATE_ID;
      else process.env.MSG91_TEMPLATE_ID = previousTemplate;
    });
    t.mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200, json: async () => ({ type: 'success', request_id: 'mock-request' }),
    }));
    const result = await sendOtp('919876543210');
    assert.equal(result.success, true);
    assert.equal(result.requestId, 'mock-request');
  });

  it('returns a failure when the SMS provider rejects delivery', async (t) => {
    useMockMsg91(t);
    t.mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 503, json: async () => ({ type: 'error', message: 'sensitive provider details' }),
    }));
    await assert.rejects(sendOtp('919876543210'), (error) => {
      assert.equal(error.statusCode, 502);
      assert.doesNotMatch(error.message, /sensitive provider details/);
      return true;
    });
  });

  it('returns a controlled error when the SMS network request fails', async (t) => {
    useMockMsg91(t);
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('network unavailable'); });
    await assert.rejects(sendOtp('919876543210'), (error) => {
      assert.equal(error.statusCode, 502);
      assert.match(error.message, /Failed to send OTP/);
      return true;
    });
  });

  it('verifies a valid mobile OTP and issues a registration verification token', async (t) => {
    useMockMsg91(t);
    stubQueries(t, async (query) => {
      if (query.model === 'MobileVerification' && query.action === 'findUnique') {
        return { expiresAt: new Date(Date.now() + 60_000), attempts: 0, token: null, used: false };
      }
      if (query.model === 'MobileVerification' && query.action === 'update') return null;
      return null;
    });
    t.mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200, json: async () => ({ type: 'success' }),
    }));
    const result = await verifyMobileOtp({ phone: '9876543210', country: 'India', otp: '654321' });
    assert.equal(result.data.verified, true);
    assert.equal(typeof result.data.verificationToken, 'string');
  });

  it('rejects an expired OTP before reaching the SMS provider', async (t) => {
    stubQueries(t, async (query) => {
      if (query.model === 'MobileVerification' && query.action === 'findUnique') {
        return { expiresAt: new Date(Date.now() - 1_000), attempts: 0, token: null, used: false };
      }
      return null;
    });
    await assert.rejects(
      verifyMobileOtp({ phone: '9876543210', country: 'India', otp: '654321' }),
      (error) => error.errorCode === 'OTP_EXPIRED' || /expired/i.test(error.message),
    );
  });

  it('resends OTP after cooldown and reports the next cooldown period', async (t) => {
    useMockMsg91(t);
    stubQueries(t, async (query) => {
      if (query.model === 'MobileVerification' && query.action === 'findUnique') {
        return { lastSentAt: new Date(Date.now() - 61_000), resendCount: 0, token: null };
      }
      if (query.model === 'User' && query.action === 'findFirst') return null;
      if (query.model === 'MobileVerification' && query.action === 'update') return null;
      return null;
    });
    t.mock.method(globalThis, 'fetch', async () => ({
      ok: true, status: 200, json: async () => ({ type: 'success' }),
    }));
    const result = await resendMobileOtp({ phone: '9876543210', country: 'India' });
    assert.equal(result.success, true);
    assert.equal(result.cooldownSeconds, 60);
  });
});
