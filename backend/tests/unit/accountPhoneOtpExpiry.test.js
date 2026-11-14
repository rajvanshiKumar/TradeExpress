import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../../src/config/db.js';
import { requestMobileOtp } from '../../src/services/otpService.js';

// All database access goes through this stub; nothing reaches a real database
let prismaStub;
prisma.$use(async (params) => (prismaStub ? prismaStub(params) : null));

function setup(t) {
  const names = ['MSG91_AUTH_KEY', 'MSG91_TEMPLATE_ID', 'SMS_API_URL', 'SMS_SENDER_ID', 'MSG91_OTP_EXPIRY_MINUTES'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  process.env.MSG91_AUTH_KEY = 'test-placeholder-key';
  process.env.MSG91_TEMPLATE_ID = 'test-placeholder-template';
  delete process.env.SMS_API_URL;
  delete process.env.SMS_SENDER_ID;
  delete process.env.MSG91_OTP_EXPIRY_MINUTES;

  const upserts = [];
  const smsRequests = [];
  prismaStub = async (q) => {
    if (q.model === 'MobileVerification' && q.action === 'upsert') { upserts.push(q.args); return {}; }
    return null; // number not registered, no previous code
  };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    smsRequests.push(JSON.parse(options.body));
    return { ok: true, status: 200, json: async () => ({ type: 'success' }) };
  });
  t.after(() => {
    prismaStub = null;
    names.forEach((name) => (previous[name] === undefined ? delete process.env[name] : (process.env[name] = previous[name])));
  });
  return { upserts, smsRequests };
}

const minutesUntil = (date) => (new Date(date).getTime() - Date.now()) / 60000;

describe('Mobile OTP expiry: Account Settings vs signup', () => {
  it('Change Phone Number (Account Settings) SMS code expires in 5 minutes', async (t) => {
    const { upserts, smsRequests } = setup(t);
    const result = await requestMobileOtp({ phone: '9812345234', country: 'India', purpose: 'PHONE_CHANGE' });
    assert.equal(result.expiresInSeconds, 300);
    const stored = minutesUntil(upserts[0].create.expiresAt);
    assert.ok(stored > 4.9 && stored <= 5, `stored expiry ${stored} min`);
    assert.equal(smsRequests[0].otp_expiry, 5, 'the SMS provider is told 5 minutes too');
  });

  it('signup mobile verification keeps the 10-minute expiry', async (t) => {
    const { upserts, smsRequests } = setup(t);
    const result = await requestMobileOtp({ phone: '9812345234', country: 'India' });
    assert.equal(result.expiresInSeconds, 600);
    const stored = minutesUntil(upserts[0].create.expiresAt);
    assert.ok(stored > 9.9 && stored <= 10, `stored expiry ${stored} min`);
    assert.equal(smsRequests[0].otp_expiry, 10);
  });

  it('an unknown purpose cannot change the expiry', async (t) => {
    const { upserts } = setup(t);
    const result = await requestMobileOtp({ phone: '9812345234', country: 'India', purpose: 'SOMETHING_ELSE' });
    assert.equal(result.expiresInSeconds, 600);
    assert.ok(minutesUntil(upserts[0].create.expiresAt) > 9.9);
  });
});
