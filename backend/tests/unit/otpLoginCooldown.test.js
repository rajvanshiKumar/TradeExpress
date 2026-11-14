import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import prisma from '../../src/config/db.js';
import {
  requestEmailLoginOtp,
  requestMobileLoginOtp,
  validateEmailLoginOtp,
} from '../../src/services/otpService.js';

// All database access goes through this stub; nothing reaches a real database
let prismaStub;
prisma.$use(async (params) => (prismaStub ? prismaStub(params) : null));
const stubQueries = (t, handler) => {
  prismaStub = handler;
  t.after(() => { prismaStub = null; });
};

// Capture login emails instead of sending them (the mailer is created lazily on first send)
const sentMail = [];
nodemailer.createTransport = () => ({
  sendMail: async (message) => {
    sentMail.push(message);
    return { messageId: `test-${sentMail.length}` };
  },
});
// The code is the text of an element (">123456<"); colour codes such as #334155 in the styles are not
const lastOtp = () => String(sentMail.at(-1)?.html || '').match(/>\s*(\d{6})\s*</)?.[1];

const buyer = (email) => ({
  id: 'user-1', email, name: 'Test Buyer', phone: '+919876543210', role: 'BUYER',
  passwordHash: 'hash', isActive: true, status: 'ACTIVE',
});

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
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200, json: async () => ({ type: 'success' }) }));
}

describe('Email OTP login: no leftover cooldown after a successful sign-in', () => {
  it('lets the user request a new code right after signing in and logging out', async (t) => {
    const email = 'relogin-buyer@example.com';
    stubQueries(t, async (q) => (q.model === 'User' && q.action === 'findUnique' ? buyer(email) : null));

    // First sign-in: code sent, a second request while it is pending is still rate limited
    await requestEmailLoginOtp({ email, role: 'BUYER' });
    const firstOtp = lastOtp();
    assert.match(firstOtp, /^\d{6}$/);
    await assert.rejects(requestEmailLoginOtp({ email, role: 'BUYER' }), (err) => err.errorCode === 'OTP_COOLDOWN');

    // Signed in with the code
    assert.equal(validateEmailLoginOtp({ email, otp: firstOtp, consume: true }), true);

    // Logged out and back to login immediately: a new code is sent, no "please wait" error
    const result = await requestEmailLoginOtp({ email, role: 'BUYER' });
    assert.equal(result.success, true);
    assert.equal(result.cooldownSeconds, 60);
    const secondOtp = lastOtp();
    assert.match(secondOtp, /^\d{6}$/);
    assert.equal(sentMail.length, 2);

    // The new code works; the old one can never be reused
    if (secondOtp !== firstOtp) {
      assert.throws(() => validateEmailLoginOtp({ email, otp: firstOtp }), (err) => err.errorCode === 'OTP_INVALID');
    }
    assert.equal(validateEmailLoginOtp({ email, otp: secondOtp, consume: true }), true);
  });

  it('works for repeated sign-in / logout cycles without hitting the hourly limit', async (t) => {
    const email = 'many-logins@example.com';
    stubQueries(t, async (q) => (q.model === 'User' && q.action === 'findUnique' ? buyer(email) : null));
    for (let cycle = 0; cycle < 8; cycle += 1) {
      await requestEmailLoginOtp({ email, role: 'BUYER' });
      assert.equal(validateEmailLoginOtp({ email, otp: lastOtp(), consume: true }), true, `cycle ${cycle + 1}`);
    }
  });

  it('a used code cannot be used again', async (t) => {
    const email = 'reuse-check@example.com';
    stubQueries(t, async (q) => (q.model === 'User' && q.action === 'findUnique' ? buyer(email) : null));
    await requestEmailLoginOtp({ email, role: 'BUYER' });
    const otp = lastOtp();
    validateEmailLoginOtp({ email, otp, consume: true });
    assert.throws(() => validateEmailLoginOtp({ email, otp }), (err) => err.errorCode === 'OTP_NOT_REQUESTED');
  });
});

describe('Mobile OTP login: no leftover cooldown after a successful sign-in', () => {
  const mobileStub = (verification, upserts) => async (q) => {
    if (q.model === 'User' && q.action === 'findFirst') return buyer('m@example.com');
    if (q.model === 'MobileVerification' && q.action === 'findUnique') return verification;
    if (q.model === 'MobileVerification' && q.action === 'upsert') { upserts.push(q.args); return {}; }
    return null;
  };

  it('sends a new code immediately when the previous code was already used to sign in', async (t) => {
    useMockMsg91(t);
    const upserts = [];
    stubQueries(t, mobileStub({
      used: true, verified: true, lastSentAt: new Date(Date.now() - 5_000), resendCount: 4, updatedAt: new Date(),
    }, upserts));
    const result = await requestMobileLoginOtp({ phone: '9876543210', country: 'India', role: 'BUYER' });
    assert.equal(result.success, true);
    assert.equal(upserts.length, 1);
    assert.equal(upserts[0].update.resendCount, 0, 'a completed sign-in starts a fresh resend count');
  });

  it('still enforces the cooldown while a sent code is pending', async (t) => {
    useMockMsg91(t);
    stubQueries(t, mobileStub({
      used: false, verified: false, lastSentAt: new Date(Date.now() - 5_000), resendCount: 0, updatedAt: new Date(),
    }, []));
    await assert.rejects(
      requestMobileLoginOtp({ phone: '9876543210', country: 'India', role: 'BUYER' }),
      (err) => err.errorCode === 'OTP_COOLDOWN' && err.cooldownRemaining > 50,
    );
  });

  it('still enforces the hourly limit for pending codes', async (t) => {
    useMockMsg91(t);
    stubQueries(t, mobileStub({
      used: false, verified: false, lastSentAt: new Date(Date.now() - 120_000), resendCount: 5, updatedAt: new Date(),
    }, []));
    await assert.rejects(
      requestMobileLoginOtp({ phone: '9876543210', country: 'India', role: 'BUYER' }),
      (err) => err.statusCode === 429,
    );
  });
});
