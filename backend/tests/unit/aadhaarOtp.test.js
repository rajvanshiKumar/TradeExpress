import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachAadhaarVerification,
  getAadhaarProviderConfig,
  resolveAadhaarVerification,
  sendAadhaarOtp,
  verifyAadhaarOtp,
} from '../../src/services/aadhaarOtpService.js';

// Test-only provider configuration; requests and the database are stubbed (no network, no real DB rows)
process.env.PAN_AADHAAR_API_BASE_URL = 'https://provider.test/v1/prod/pan/aadhaar-link-status';
process.env.PAN_AADHAAR_API_ID = 'test_id';
process.env.PAN_AADHAAR_API_KEY = 'test_key';
process.env.PAN_AADHAAR_TOKEN_ID = 'test_token';
delete process.env.AADHAAR_API_BASE_URL;
for (const k of ['PAN_AADHAAR_API_MODE', 'PAN_AADHAAR_UAT_URL', 'PAN_AADHAAR_PROD_URL']) delete process.env[k]; // a local .env must not pick the test provider
for (const mode of ['UAT', 'PROD']) for (const step of ['GENERATE', 'VERIFY']) delete process.env[`AADHAAR_${mode}_${step}_URL`];
delete process.env.AADHAAR_API_ID;

const VALID_AADHAAR = '234123412346'; // passes the Verhoeff checksum

/** Minimal in-memory stand-in for prisma.aadhaarVerification. */
function fakeDb() {
  const rows = new Map();
  let seq = 0;
  const matches = (row, where) => Object.entries(where).every(([key, cond]) => {
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('gt' in cond) return row[key] > cond.gt;
      if ('lt' in cond) return row[key] < cond.lt;
    }
    return row[key] === cond;
  });
  const apply = (row, data) => {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && 'increment' in value) row[key] += value.increment;
      else if (value && typeof value === 'object' && 'decrement' in value) row[key] -= value.decrement;
      else row[key] = value;
    }
  };
  const table = {
    rows,
    async create({ data }) {
      seq += 1;
      const row = { id: `av_${seq}`, status: 'OTP_SENT', attempts: 0, userId: null, usedAt: null, verifiedAt: null, responseData: null, lastError: null, createdAt: new Date(), ...data };
      rows.set(row.id, row);
      return { id: row.id };
    },
    async findFirst({ where }) {
      return [...rows.values()].filter((r) => matches(r, where)).sort((a, b) => b.createdAt - a.createdAt)[0] || null;
    },
    async findUnique({ where }) {
      const row = rows.get(where.id);
      return row ? { ...row } : null;
    },
    async update({ where, data }) {
      apply(rows.get(where.id), data);
      return rows.get(where.id);
    },
    async updateMany({ where, data }) {
      const hit = [...rows.values()].filter((r) => matches(r, where));
      hit.forEach((r) => apply(r, data));
      return { count: hit.length };
    },
  };
  return { aadhaarVerification: table };
}

/** Stub for axios.post: replies in order, records calls. */
function provider(...replies) {
  const calls = [];
  const request = async (url, body) => {
    calls.push({ url, body });
    const next = replies.length > 1 ? replies.shift() : replies[0];
    if (next instanceof Error) throw next;
    return next;
  };
  return { request, calls };
}

const otpSent = { status: 200, data: { success: true, requestId: 'rq_gen', environment: 'uat', simulated: true, status: 'VERIFIED', data: { referenceId: 'ref_abc', otpSent: true } } };
const verifiedReply = { status: 200, data: { success: true, requestId: 'rq_ver', environment: 'uat', simulated: true, status: 'VERIFIED', data: { full_name: 'Test Holder', aadhaar_number: 'XXXXXXXX2346', profile_image: 'aW1hZ2U=', has_image: true, status: 'success_aadhaar' } } };

test('Aadhaar OTP verification', async (t) => {
  t.afterEach(() => { delete process.env.AADHAAR_API_MODE; });

  await t.test('UAT/PROD switch builds the provider URLs from the PAN-Aadhaar base', () => {
    process.env.AADHAAR_API_MODE = 'uat';
    assert.equal(getAadhaarProviderConfig().generateUrl, 'https://provider.test/v1/uat/aadhaar/otp/generate');
    assert.equal(getAadhaarProviderConfig().verifyUrl, 'https://provider.test/v1/uat/aadhaar/otp/verify');
    process.env.AADHAAR_API_MODE = 'prod';
    assert.equal(getAadhaarProviderConfig().generateUrl, 'https://provider.test/v1/prod/aadhaar/otp/generate');
    delete process.env.AADHAAR_API_MODE;
    assert.equal(getAadhaarProviderConfig().mode, 'prod', 'unset means real verification');
  });

  await t.test('full URLs from .env win over the built ones, per mode', () => {
    process.env.AADHAAR_UAT_GENERATE_URL = 'https://other.test/v1/uat/aadhaar/otp/generate';
    process.env.AADHAAR_PROD_VERIFY_URL = 'https://other.test/v1/prod/aadhaar/otp/verify';
    try {
      process.env.AADHAAR_API_MODE = 'uat';
      assert.equal(getAadhaarProviderConfig().generateUrl, 'https://other.test/v1/uat/aadhaar/otp/generate');
      assert.equal(getAadhaarProviderConfig().verifyUrl, 'https://provider.test/v1/uat/aadhaar/otp/verify');
      process.env.AADHAAR_API_MODE = 'prod';
      assert.equal(getAadhaarProviderConfig().verifyUrl, 'https://other.test/v1/prod/aadhaar/otp/verify');
    } finally {
      delete process.env.AADHAAR_UAT_GENERATE_URL;
      delete process.env.AADHAAR_PROD_VERIFY_URL;
    }
  });

  await t.test('consent is required and nothing is sent without it', async () => {
    const p = provider(otpSent);
    await assert.rejects(sendAadhaarOtp({ aadhaarNumber: VALID_AADHAAR, userConsent: false, request: p.request, db: fakeDb() }), (e) => e.code === 'CONSENT_REQUIRED');
    assert.equal(p.calls.length, 0);
  });

  await t.test('prod rejects a mistyped Aadhaar locally without spending a credit', async () => {
    const p = provider(otpSent);
    await assert.rejects(sendAadhaarOtp({ aadhaarNumber: '234123412345', userConsent: true, request: p.request, db: fakeDb() }), (e) => e.code === 'INVALID_AADHAAR_NUMBER');
    assert.equal(p.calls.length, 0);
  });

  await t.test('full flow: send, verify, full response saved, token single-use at signup', async () => {
    process.env.AADHAAR_API_MODE = 'uat';
    const db = fakeDb();
    const p = provider(otpSent, verifiedReply);
    const sent = await sendAadhaarOtp({ aadhaarNumber: '123412341234', userConsent: true, request: p.request, db });
    assert.equal(p.calls[0].body.aadhaarNumber, '123412341234');
    assert.equal(p.calls[0].body.consent, true);
    assert.equal(p.calls[0].body.api_id, 'test_id');
    assert.equal(sent.aadhaarLast4, '1234');
    assert.equal(sent.environment, 'uat');
    assert.ok(!('referenceId' in sent), 'provider reference stays on the server');

    const row = db.aadhaarVerification.rows.get(sent.verificationId);
    assert.equal(row.referenceId, 'ref_abc');
    assert.ok(!JSON.stringify(row).includes('123412341234'), 'full Aadhaar number is never stored');

    const done = await verifyAadhaarOtp({ verificationId: sent.verificationId, otp: '123456', aadhaarNumber: '123412341234', request: p.request, db });
    assert.deepEqual(p.calls[1].body.referenceId, 'ref_abc');
    assert.equal(p.calls[1].body.otp, '123456');
    assert.equal(done.verified, true);
    assert.equal(done.fullName, 'Test Holder');
    assert.equal(row.status, 'VERIFIED');
    assert.deepEqual(JSON.parse(row.responseData), verifiedReply.data, 'the whole provider response (incl. image) is saved as readable JSON text');

    await assert.rejects(resolveAadhaarVerification({ token: done.verificationToken, aadhaarNumber: '999912341234', db }), (e) => e.code === 'AADHAAR_MISMATCH');
    const resolved = await resolveAadhaarVerification({ token: done.verificationToken, aadhaarNumber: '123412341234', db });
    assert.equal(resolved.verificationId, sent.verificationId);
    assert.equal(await attachAadhaarVerification({ verificationId: resolved.verificationId, userId: 'user_1', db }), true);
    assert.equal(row.userId, 'user_1');
    await assert.rejects(resolveAadhaarVerification({ token: done.verificationToken, aadhaarNumber: '123412341234', db }), (e) => e.code === 'AADHAAR_VERIFICATION_USED');
  });

  await t.test('a verified OTP request never gives out another token', async () => {
    process.env.AADHAAR_API_MODE = 'uat';
    const db = fakeDb();
    const p = provider(otpSent, verifiedReply);
    const sent = await sendAadhaarOtp({ aadhaarNumber: '123412341234', userConsent: true, request: p.request, db });
    await verifyAadhaarOtp({ verificationId: sent.verificationId, otp: '123456', aadhaarNumber: '123412341234', request: p.request, db });
    await assert.rejects(
      verifyAadhaarOtp({ verificationId: sent.verificationId, otp: '000000', aadhaarNumber: '123412341234', request: p.request, db }),
      (e) => e.code === 'AADHAAR_OTP_ALREADY_USED' && e.statusCode === 409,
    );
    assert.equal(p.calls.length, 2, 'no provider call for the reused request');
  });

  await t.test('an Aadhaar already registered to an account gets no OTP (and spends no credit)', async () => {
    const db = fakeDb();
    db.aadhaarVerification.findFirst = async ({ where }) => (where.userId ? { id: 'owned' } : null);
    const p = provider(otpSent);
    await assert.rejects(sendAadhaarOtp({ aadhaarNumber: VALID_AADHAAR, userConsent: true, request: p.request, db }), (e) => e.code === 'AADHAAR_ALREADY_REGISTERED' && e.statusCode === 409 && e.errorCode === 'AADHAAR_ALREADY_REGISTERED');
    assert.equal(p.calls.length, 0);
  });

  await t.test('resend is blocked during the cooldown', async () => {
    const db = fakeDb();
    const p = provider(otpSent);
    await sendAadhaarOtp({ aadhaarNumber: VALID_AADHAAR, userConsent: true, request: p.request, db });
    await assert.rejects(sendAadhaarOtp({ aadhaarNumber: VALID_AADHAAR, userConsent: true, request: p.request, db }), (e) => e.code === 'OTP_COOLDOWN' && e.statusCode === 429);
    assert.equal(p.calls.length, 1);
  });

  await t.test('wrong OTP counts attempts and locks after five', async () => {
    const db = fakeDb();
    const wrong = { status: 200, data: { success: false, message: 'Invalid OTP.' } };
    const p = provider(otpSent, wrong);
    const sent = await sendAadhaarOtp({ aadhaarNumber: VALID_AADHAAR, userConsent: true, request: p.request, db });
    const tryOtp = () => verifyAadhaarOtp({ verificationId: sent.verificationId, otp: '000000', aadhaarNumber: VALID_AADHAAR, request: p.request, db });
    await assert.rejects(tryOtp(), (e) => e.code === 'OTP_INVALID' && /Invalid OTP\. 4 attempts left/.test(e.message));
    for (let i = 0; i < 3; i += 1) await assert.rejects(tryOtp(), (e) => e.code === 'OTP_INVALID');
    await assert.rejects(tryOtp(), (e) => e.code === 'OTP_LOCKED');
    await assert.rejects(tryOtp(), (e) => e.code === 'OTP_LOCKED');
    assert.equal(p.calls.length, 6, 'no provider call once locked');
  });

  await t.test('a provider outage does not use up an attempt and is never treated as verified', async () => {
    const db = fakeDb();
    const p = provider(otpSent, Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }));
    const sent = await sendAadhaarOtp({ aadhaarNumber: VALID_AADHAAR, userConsent: true, request: p.request, db });
    await assert.rejects(
      verifyAadhaarOtp({ verificationId: sent.verificationId, otp: '123456', aadhaarNumber: VALID_AADHAAR, request: p.request, db }),
      (e) => e.code === 'PROVIDER_TIMEOUT' && e.statusCode === 503,
    );
    const row = db.aadhaarVerification.rows.get(sent.verificationId);
    assert.equal(row.attempts, 0);
    assert.equal(row.status, 'OTP_SENT');
  });

  await t.test('an OTP for a different Aadhaar number or an expired request is refused', async () => {
    const db = fakeDb();
    const p = provider(otpSent, verifiedReply);
    const sent = await sendAadhaarOtp({ aadhaarNumber: VALID_AADHAAR, userConsent: true, request: p.request, db });
    await assert.rejects(verifyAadhaarOtp({ verificationId: sent.verificationId, otp: '123456', aadhaarNumber: '123412341234', request: p.request, db }), (e) => e.code === 'OTP_REQUEST_NOT_FOUND');
    db.aadhaarVerification.rows.get(sent.verificationId).expiresAt = new Date(Date.now() - 1000);
    await assert.rejects(verifyAadhaarOtp({ verificationId: sent.verificationId, otp: '123456', aadhaarNumber: VALID_AADHAAR, request: p.request, db }), (e) => e.code === 'OTP_EXPIRED');
    assert.equal(p.calls.length, 1);
  });

  await t.test('the direct provider format (status { code, type }, no "success") is accepted, saved and returned as is', async () => {
    const db = fakeDb();
    const photo = '/9j/4AAQSkZJRgABAgsss\nAAAQABAAD/2wBDAAgGBgcGBQ==';
    const directSent = { status: 200, data: { status: { code: 200, type: 'success', message: 'OTP sent.' }, data: { reference_id: 'ref_direct' } } };
    const directVerified = { status: 200, data: {
      status: { code: 200, type: 'success', message: 'Aadhaar verified successfully.' },
      message: 'Aadhaar verified successfully.',
      data: { full_name: 'Test Holder', aadhaar_number: VALID_AADHAAR, dob: '2000-01-01', gender: 'M', care_of: 'S/O: Test', profile_image: photo, has_image: true, status: 'success_aadhaar' },
    } };
    const p = provider(directSent, directVerified);
    const sent = await sendAadhaarOtp({ aadhaarNumber: VALID_AADHAAR, userConsent: true, request: p.request, db });
    const done = await verifyAadhaarOtp({ verificationId: sent.verificationId, otp: '123456', aadhaarNumber: VALID_AADHAAR, request: p.request, db });
    assert.equal(done.verified, true);
    assert.deepEqual(done.providerResponse, directVerified.data, 'the provider reply is returned unchanged');
    assert.deepEqual(JSON.parse(db.aadhaarVerification.rows.get(sent.verificationId).responseData), directVerified.data, 'and saved unchanged');
    assert.equal(done.holder.fullName, 'Test Holder');
    assert.equal(done.holder.photo, `data:image/jpeg;base64,${photo.replace(/\s+/g, '')}`, 'photo keeps every character (only line breaks removed)');
  });

  await t.test('the direct format with type "error" is a rejection, never verified', async () => {
    const db = fakeDb();
    const failed = { status: 200, data: { status: { code: 400, type: 'error', message: 'Invalid OTP.' }, message: 'Invalid OTP.' } };
    const p = provider(otpSent, failed);
    const sent = await sendAadhaarOtp({ aadhaarNumber: VALID_AADHAAR, userConsent: true, request: p.request, db });
    await assert.rejects(
      verifyAadhaarOtp({ verificationId: sent.verificationId, otp: '000000', aadhaarNumber: VALID_AADHAAR, request: p.request, db }),
      (e) => e.code === 'OTP_INVALID',
    );
    assert.equal(db.aadhaarVerification.rows.get(sent.verificationId).status, 'OTP_SENT');
  });

  await t.test('signup without an Aadhaar OTP token is refused', async () => {
    await assert.rejects(resolveAadhaarVerification({ token: '', aadhaarNumber: VALID_AADHAAR, db: fakeDb() }), (e) => e.code === 'AADHAAR_NOT_VERIFIED' && e.statusCode === 400);
    await assert.rejects(resolveAadhaarVerification({ token: 'not-a-jwt', aadhaarNumber: VALID_AADHAAR, db: fakeDb() }), (e) => e.code === 'AADHAAR_VERIFICATION_EXPIRED');
  });
});
