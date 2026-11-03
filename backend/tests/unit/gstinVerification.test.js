import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyGstin,
  getGstProviderConfig,
  resolveSignupGstin,
  clearVerificationCache,
  GST_STATE_CODES,
  GST_ENTITY_TYPES,
} from '../../src/services/verificationService.js';

// Test-only provider configuration; every provider call below is stubbed (no network)
process.env.GST_BASE_URL = 'https://provider.test/v1/prod/gst/verify';
process.env.GST_API_ID = 'test_id';
process.env.GST_API_KEY = 'test_key';
process.env.GST_TOKEN_ID = 'test_token';
delete process.env.GST_TEST_MODE; // a local .env must not change these results

const GSTIN = '24ABCDE1234F1Z5';

/** Stub for axios.post that records calls and returns the given HTTP reply. */
function stubProvider(status, data) {
  const calls = [];
  const request = async (url, body) => {
    calls.push({ url, body });
    return { status, data };
  };
  return { request, calls };
}

const activeReply = (overrides = {}) => ({
  success: true,
  requestId: 'rq_test_1',
  data: { legal_name: 'RAMAN ENTERPRISES', trade_name: 'Raman Enterprises', status: 'Active', state: 'Gujarat', taxpayer_type: 'Regular', ...overrides },
});

describe('GSTIN verification uses only real provider answers', () => {
  beforeEach(() => clearVerificationCache());
  afterEach(() => { delete process.env.GST_TEST_MODE; });

  it('reads provider credentials from the environment only (no hardcoded keys)', () => {
    const config = getGstProviderConfig();
    assert.equal(config.baseUrl, 'https://provider.test/v1/prod/gst/verify');
    assert.equal(config.apiKey, 'test_key');
    const saved = process.env.GST_API_KEY;
    const savedLower = process.env.api_key;
    delete process.env.GST_API_KEY;
    delete process.env.api_key;
    try {
      assert.equal(getGstProviderConfig().apiKey, undefined, 'no built-in fallback key');
    } finally {
      process.env.GST_API_KEY = saved;
      if (savedLower !== undefined) process.env.api_key = savedLower;
    }
  });

  it('an active GSTIN from the provider is verified, with the provider\'s legal name and a signup token', async () => {
    const provider = stubProvider(200, activeReply());
    const result = await verifyGstin({ gstin: GSTIN, request: provider.request });
    assert.equal(result.verified, true);
    assert.equal(result.status, 'VERIFIED');
    assert.equal(result.legalName, 'RAMAN ENTERPRISES');
    assert.equal(result.gstStatus, 'ACTIVE');
    assert.equal(result.state, 'Gujarat');
    assert.ok(result.verificationToken);
    assert.equal(provider.calls[0].body.gstin, GSTIN);
    assert.equal(provider.calls[0].body.api_key, 'test_key');
  });

  it('a cancelled or suspended GSTIN is not verified', async () => {
    const result = await verifyGstin({ gstin: GSTIN, request: stubProvider(200, activeReply({ status: 'Cancelled' })).request });
    assert.equal(result.verified, false);
    assert.equal(result.status, 'NOT_VERIFIED');
    assert.equal(result.reason, 'GSTIN_NOT_ACTIVE');
    assert.match(result.message, /CANCELLED/);
    assert.equal(result.verificationToken, undefined);
  });

  it('a GSTIN the provider cannot find is not verified', async () => {
    const result = await verifyGstin({ gstin: GSTIN, request: stubProvider(200, { success: false, status: 'NOT_VERIFIED', message: 'GSTIN not found' }).request });
    assert.equal(result.verified, false);
    assert.equal(result.status, 'NOT_VERIFIED');
    assert.equal(result.reason, 'GSTIN_NOT_FOUND');
  });

  it('never invents a legal name or ACTIVE status when the provider is down', async () => {
    for (const provider of [
      stubProvider(404, ''),
      stubProvider(503, {}),
      stubProvider(200, '<html>tunnel offline</html>'),
      stubProvider(402, { success: false, error: { code: 'INSUFFICIENT_CREDITS' } }),
      { request: async () => { const e = new Error('getaddrinfo ENOTFOUND'); e.code = 'ENOTFOUND'; throw e; } },
    ]) {
      clearVerificationCache();
      const result = await verifyGstin({ gstin: GSTIN, request: provider.request });
      assert.equal(result.verified, false, result.reason);
      assert.equal(result.status, 'UNABLE_TO_VERIFY', result.reason);
      assert.equal(result.legalName, null);
      assert.equal(result.gstStatus, null);
      assert.equal(result.verificationToken, undefined);
      assert.match(result.message, /GST verification service|could not be understood/);
    }
  });

  it('reports a missing provider configuration instead of faking a result', async () => {
    const saved = process.env.GST_BASE_URL;
    const savedA = process.env.Base_URL;
    delete process.env.GST_BASE_URL;
    delete process.env.Base_URL;
    try {
      const provider = stubProvider(200, activeReply());
      const result = await verifyGstin({ gstin: GSTIN, request: provider.request });
      assert.equal(result.reason, 'PROVIDER_NOT_CONFIGURED');
      assert.equal(result.verified, false);
      assert.equal(provider.calls.length, 0);
    } finally {
      process.env.GST_BASE_URL = saved;
      if (savedA !== undefined) process.env.Base_URL = savedA;
    }
  });

  it('caches only real answers', async () => {
    const down = stubProvider(503, {});
    await verifyGstin({ gstin: GSTIN, request: down.request });
    await verifyGstin({ gstin: GSTIN, request: down.request });
    assert.equal(down.calls.length, 2, 'failures are retried');

    const up = stubProvider(200, activeReply());
    await verifyGstin({ gstin: GSTIN, request: up.request });
    const second = await verifyGstin({ gstin: GSTIN, request: up.request });
    assert.equal(up.calls.length, 1);
    assert.equal(second.fromCache, true);
  });

  it('rejects malformed GSTINs before calling the provider', async () => {
    const provider = stubProvider(200, activeReply());
    for (const bad of ['27ABCDE1234F1Z', '27ABCDE1234F!Z5', '']) {
      await assert.rejects(verifyGstin({ gstin: bad, request: provider.request }), { statusCode: 422, code: 'INVALID_GSTIN_FORMAT' });
    }
    assert.equal(provider.calls.length, 0);
    const lower = await verifyGstin({ gstin: '24abcde1234f1z5', request: provider.request });
    assert.equal(lower.gstin, GSTIN);
  });
});

describe('GST test mode', () => {
  beforeEach(() => clearVerificationCache());
  afterEach(() => { delete process.env.GST_TEST_MODE; });

  it('treats an unreachable provider as verified for testing, clearly labelled, without inventing a name', async () => {
    process.env.GST_TEST_MODE = 'true';
    const result = await verifyGstin({ gstin: GSTIN, request: stubProvider(404, '').request });
    assert.equal(result.verified, true);
    assert.equal(result.testMode, true);
    assert.match(result.message, /TEST MODE/);
    assert.equal(result.legalName, null);
    assert.ok(result.verificationToken);
  });

  it('never overrides a real "not active" or "not found" answer', async () => {
    process.env.GST_TEST_MODE = 'true';
    const result = await verifyGstin({ gstin: GSTIN, request: stubProvider(200, activeReply({ status: 'Suspended' })).request });
    assert.equal(result.verified, false);
    assert.equal(result.verificationToken, undefined);
  });

  it('is ignored in production', async () => {
    const savedEnv = process.env.NODE_ENV;
    process.env.GST_TEST_MODE = 'true';
    process.env.NODE_ENV = 'production';
    try {
      const result = await verifyGstin({ gstin: GSTIN, request: stubProvider(404, '').request });
      assert.equal(result.verified, false);
      assert.equal(result.status, 'UNABLE_TO_VERIFY');
    } finally {
      if (savedEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = savedEnv;
    }
  });
});

describe('Supplier signup accepts a GSTIN only with a matching verification token', () => {
  beforeEach(() => clearVerificationCache());

  it('accepts the token for the same GSTIN', async () => {
    const { verificationToken } = await verifyGstin({ gstin: GSTIN, request: stubProvider(200, activeReply()).request });
    const resolved = resolveSignupGstin({ token: verificationToken, gstin: GSTIN.toLowerCase() });
    assert.equal(resolved.legalName, 'RAMAN ENTERPRISES');
    assert.equal(resolved.testMode, false);
  });

  it('rejects a missing, forged or mismatched token', async () => {
    assert.throws(() => resolveSignupGstin({ token: null, gstin: GSTIN }), { statusCode: 400, code: 'GSTIN_NOT_VERIFIED' });
    assert.throws(() => resolveSignupGstin({ token: 'not-a-token', gstin: GSTIN }), { statusCode: 400, code: 'GSTIN_VERIFICATION_EXPIRED' });
    const { verificationToken } = await verifyGstin({ gstin: GSTIN, request: stubProvider(200, activeReply()).request });
    assert.throws(() => resolveSignupGstin({ token: verificationToken, gstin: '27ABCDE1234F1Z5' }), { statusCode: 400, code: 'GSTIN_MISMATCH' });
  });
});

describe('GST reference data', () => {
  it('maps state codes and entity types', () => {
    assert.equal(GST_STATE_CODES['27'], 'Maharashtra');
    assert.equal(GST_STATE_CODES['24'], 'Gujarat');
    assert.ok(GST_ENTITY_TYPES['C'].includes('Company'));
  });
});
