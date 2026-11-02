import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkPanAadhaarLinkStatus,
  clearVerificationCache,
  doesPanMatchMaskedPan,
  isValidAadhaarNumber,
  resolveSignupPanAadhaar,
} from '../../src/services/verificationService.js';

// Test-only provider configuration; no real network calls are made (requests are stubbed)
process.env.PAN_AADHAAR_API_BASE_URL = 'https://provider.test/v1/prod/pan/aadhaar-link-status';
process.env.PAN_AADHAAR_API_ID = 'test_id';
process.env.PAN_AADHAAR_API_KEY = 'test_key';
process.env.PAN_AADHAAR_TOKEN_ID = 'test_token';
delete process.env.PAN_AADHAAR_TEST_MODE; // a local .env must not change these results; test mode is enabled per test below

const VALID_AADHAAR = '234123412346'; // passes the Verhoeff checksum
const PAN = 'ABCDE1234F';

/** Builds a stub for axios.post that records calls and returns the given HTTP reply. */
function stubProvider(status, data) {
  const calls = [];
  const request = async (url, body) => {
    calls.push({ url, body });
    return { status, data };
  };
  return { request, calls };
}

const linkedReply = (maskedPan) => ({ success: true, requestId: 'rq_1', data: { linking_status: true, masked_pan: maskedPan, reason: 'linked' } });
const check = (request, overrides = {}) => checkPanAadhaarLinkStatus({ aadhaarNumber: VALID_AADHAAR, pan: PAN, userConsent: true, request, ...overrides });

test('PAN-Aadhaar verification uses only real provider answers', async (t) => {
  t.beforeEach(() => clearVerificationCache());

  await t.test('consent is required', async () => {
    await assert.rejects(check(stubProvider(200, {}).request, { userConsent: false }), (err) => err.code === 'CONSENT_REQUIRED' && err.statusCode === 400);
  });

  await t.test('Aadhaar must be 12 digits and pass the UIDAI checksum, before any paid call', async () => {
    const provider = stubProvider(200, linkedReply('ABXXXXXX4F'));
    await assert.rejects(check(provider.request, { aadhaarNumber: '12345' }), (err) => err.code === 'INVALID_AADHAAR_FORMAT');
    await assert.rejects(check(provider.request, { aadhaarNumber: '234123412345' }), (err) => err.code === 'INVALID_AADHAAR_NUMBER');
    await assert.rejects(check(provider.request, { aadhaarNumber: '000000000000' }), (err) => err.code === 'INVALID_AADHAAR_NUMBER');
    assert.equal(provider.calls.length, 0, 'invalid numbers never reach the provider');
    assert.equal(isValidAadhaarNumber(VALID_AADHAAR), true);
  });

  await t.test('PAN is required and must be well formed', async () => {
    const provider = stubProvider(200, linkedReply('ABXXXXXX4F'));
    await assert.rejects(check(provider.request, { pan: null }), (err) => err.code === 'PAN_REQUIRED');
    await assert.rejects(check(provider.request, { pan: 'INVALID_PAN_123' }), (err) => err.code === 'INVALID_PAN_FORMAT');
    assert.equal(provider.calls.length, 0);
  });

  await t.test('LINKED only when the provider says linked AND its PAN matches the entered PAN', async () => {
    const provider = stubProvider(200, linkedReply('ABXXXXXX4F'));
    const result = await check(provider.request);
    assert.equal(provider.calls.length, 1, 'the provider is actually called');
    assert.equal(provider.calls[0].body.aadhaarNumber, VALID_AADHAAR);
    assert.equal(provider.calls[0].body.pan, PAN);
    assert.equal(result.status, 'LINKED');
    assert.equal(result.linked, true);
    assert.equal(result.maskedPan, 'ABXXXXXX4F');
    assert.equal(typeof result.verificationToken, 'string');
    assert.match(result.disclaimer, /Gold Supplier/);
  });

  await t.test('linked to a different PAN is rejected with the real reason', async () => {
    const result = await check(stubProvider(200, linkedReply('MRXXXXXX1F')).request);
    assert.equal(result.status, 'NOT_LINKED');
    assert.equal(result.linked, false);
    assert.equal(result.reason, 'PAN_MISMATCH');
    assert.match(result.message, /different PAN \(MRXXXXXX1F\)/);
    assert.equal(result.verificationToken, undefined);
  });

  await t.test('a fully masked or missing PAN cannot confirm the match', async () => {
    for (const masked of ['XXXXXXXXXX', null]) {
      clearVerificationCache();
      const result = await check(stubProvider(200, linkedReply(masked)).request);
      assert.equal(result.status, 'UNABLE_TO_VERIFY');
      assert.equal(result.reason, 'PAN_MATCH_UNCONFIRMED');
      assert.equal(result.linked, false);
    }
  });

  await t.test('provider "not linked" answer is NOT_LINKED with a readable reason', async () => {
    const result = await check(stubProvider(200, {
      success: true, status: 'NOT_VERIFIED', message: 'not_linked', data: { linking_status: false, masked_pan: null, reason: 'not_linked' },
    }).request);
    assert.equal(result.status, 'NOT_LINKED');
    assert.equal(result.reason, 'not_linked');
    assert.match(result.message, /not linked with the PAN you entered/);
  });

  await t.test('zero credits is reported as such and never treated as verified', async () => {
    const result = await check(stubProvider(402, { success: false, error: { code: 'INSUFFICIENT_CREDITS', message: 'No credits left' } }).request);
    assert.equal(result.status, 'UNABLE_TO_VERIFY');
    assert.equal(result.linked, false);
    assert.equal(result.reason, 'INSUFFICIENT_CREDITS');
    assert.match(result.message, /0 credits/);
  });

  await t.test('other provider failures give specific reasons', async () => {
    const cases = [
      [stubProvider(401, { success: false, error: { code: 'INVALID_CREDENTIALS' } }), 'PROVIDER_AUTH_FAILED'],
      [stubProvider(429, {}), 'PROVIDER_RATE_LIMITED'],
      [stubProvider(503, {}), 'PROVIDER_ERROR'],
      [stubProvider(404, ''), 'PROVIDER_ENDPOINT_NOT_FOUND'],
      [stubProvider(405, {}), 'PROVIDER_ENDPOINT_NOT_FOUND'],
      [stubProvider(302, ''), 'PROVIDER_UNEXPECTED_STATUS'],
      [stubProvider(200, '<html>tunnel offline</html>'), 'PROVIDER_INVALID_RESPONSE'],
      [{ request: async () => { const e = new Error('timeout of 15000ms exceeded'); e.code = 'ECONNABORTED'; throw e; } }, 'PROVIDER_TIMEOUT'],
      [{ request: async () => { const e = new Error('getaddrinfo ENOTFOUND'); e.code = 'ENOTFOUND'; throw e; } }, 'PROVIDER_UNREACHABLE'],
    ];
    for (const [provider, reason] of cases) {
      clearVerificationCache();
      const result = await check(provider.request);
      assert.equal(result.status, 'UNABLE_TO_VERIFY', reason);
      assert.equal(result.linked, false, reason);
      assert.equal(result.reason, reason);
    }
  });

  await t.test('an offline provider address (HTTP 404, empty body) says the service is unavailable', async () => {
    clearVerificationCache();
    const result = await check(stubProvider(404, '').request);
    assert.equal(result.success, false);
    assert.equal(result.linked, false);
    assert.equal(result.reason, 'PROVIDER_ENDPOINT_NOT_FOUND');
    assert.match(result.message, /currently unavailable/);
    assert.doesNotMatch(result.message, /could not be understood/);
  });

  await t.test('test mode: an unreachable provider is treated as linked for testing, clearly labelled', async () => {
    process.env.PAN_AADHAAR_TEST_MODE = 'true';
    try {
      clearVerificationCache();
      const result = await check(stubProvider(404, '').request);
      assert.equal(result.status, 'LINKED');
      assert.equal(result.linked, true);
      assert.equal(result.reason, 'TEST_MODE');
      assert.match(result.message, /TEST MODE/);
      assert.ok(result.verificationToken, 'signup needs a token in test mode');
      const stored = resolveSignupPanAadhaar({ token: result.verificationToken, aadhaarNumber: VALID_AADHAAR, pan: PAN, claimedLinked: true });
      assert.equal(stored.panAadhaarStatus, 'LINKED');
    } finally {
      delete process.env.PAN_AADHAAR_TEST_MODE;
    }
  });

  await t.test('test mode never overrides a real NOT_LINKED answer', async () => {
    process.env.PAN_AADHAAR_TEST_MODE = 'true';
    try {
      clearVerificationCache();
      const result = await check(stubProvider(200, { success: true, data: { linking_status: false, reason: 'not_linked', masked_pan: null } }).request);
      assert.equal(result.status, 'NOT_LINKED');
      assert.equal(result.linked, false);
      assert.equal(result.verificationToken, undefined);
    } finally {
      delete process.env.PAN_AADHAAR_TEST_MODE;
    }
  });

  await t.test('test mode is ignored in production', async () => {
    const savedEnv = process.env.NODE_ENV;
    process.env.PAN_AADHAAR_TEST_MODE = 'true';
    process.env.NODE_ENV = 'production';
    try {
      clearVerificationCache();
      const result = await check(stubProvider(404, '').request);
      assert.equal(result.status, 'UNABLE_TO_VERIFY');
      assert.equal(result.linked, false);
      assert.equal(result.verificationToken, undefined);
    } finally {
      delete process.env.PAN_AADHAAR_TEST_MODE;
      if (savedEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = savedEnv;
    }
  });

  await t.test('missing provider configuration is reported, not faked', async () => {
    const saved = process.env.PAN_AADHAAR_API_BASE_URL;
    delete process.env.PAN_AADHAAR_API_BASE_URL;
    try {
      const provider = stubProvider(200, linkedReply('ABXXXXXX4F'));
      const result = await check(provider.request);
      assert.equal(result.reason, 'PROVIDER_NOT_CONFIGURED');
      assert.equal(result.linked, false);
      assert.equal(provider.calls.length, 0);
    } finally {
      process.env.PAN_AADHAAR_API_BASE_URL = saved;
    }
  });

  await t.test('definitive answers are cached; failures are retried', async () => {
    const provider = stubProvider(200, linkedReply('ABXXXXXX4F'));
    await check(provider.request);
    const second = await check(provider.request);
    assert.equal(second.fromCache, true);
    assert.equal(provider.calls.length, 1);

    clearVerificationCache();
    const failing = stubProvider(402, { error: { code: 'INSUFFICIENT_CREDITS' } });
    await check(failing.request);
    await check(failing.request);
    assert.equal(failing.calls.length, 2, 'credit failures are not cached');
  });

  await t.test('masked PAN matching needs at least 4 visible, agreeing characters', () => {
    assert.equal(doesPanMatchMaskedPan('MRABC1231F', 'MRXXXXXX1F'), true);
    assert.equal(doesPanMatchMaskedPan('ABCDE1234F', 'MRXXXXXX1F'), false);
    assert.equal(doesPanMatchMaskedPan('ABCDE1234F', 'XXXXXXXXXX'), false);
    assert.equal(doesPanMatchMaskedPan('ABCDE1234F', null), false);
    assert.equal(doesPanMatchMaskedPan('ABCDE1234F', 'AXXXXXXXXX'), false);
  });
});

test('Signup accepts LINKED only with a matching verification token', async (t) => {
  t.beforeEach(() => clearVerificationCache());

  await t.test('valid token for the same Aadhaar and PAN gives LINKED', async () => {
    const { verificationToken } = await check(stubProvider(200, linkedReply('ABXXXXXX4F')).request);
    const fields = resolveSignupPanAadhaar({ token: verificationToken, aadhaarNumber: VALID_AADHAAR, pan: PAN, claimedLinked: true });
    assert.equal(fields.panAadhaarStatus, 'LINKED');
    assert.equal(fields.panAadhaarLinked, true);
    assert.equal(fields.panAadhaarMaskedPan, 'ABXXXXXX4F');
  });

  await t.test('claiming LINKED without a token is rejected', () => {
    assert.throws(() => resolveSignupPanAadhaar({ token: null, aadhaarNumber: VALID_AADHAAR, pan: PAN, claimedLinked: true }), (err) => err.code === 'PAN_AADHAAR_NOT_VERIFIED');
  });

  await t.test('a token for different numbers or a forged token is rejected', async () => {
    const { verificationToken } = await check(stubProvider(200, linkedReply('ABXXXXXX4F')).request);
    assert.throws(() => resolveSignupPanAadhaar({ token: verificationToken, aadhaarNumber: VALID_AADHAAR, pan: 'ABCDE9999F' }), (err) => err.code === 'PAN_AADHAAR_MISMATCH');
    assert.throws(() => resolveSignupPanAadhaar({ token: 'not.a.token', aadhaarNumber: VALID_AADHAAR, pan: PAN }), (err) => err.code === 'PAN_AADHAAR_VERIFICATION_EXPIRED');
  });

  await t.test('no claim and no token stores NOT_STARTED', () => {
    const fields = resolveSignupPanAadhaar({ token: null, aadhaarNumber: VALID_AADHAAR, pan: PAN });
    assert.equal(fields.panAadhaarStatus, 'NOT_STARTED');
    assert.equal(fields.panAadhaarLinked, false);
  });
});
