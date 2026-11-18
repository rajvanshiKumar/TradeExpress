import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDevOtpAllowed, isTestOtpEnvironment } from '../../src/services/otpService.js';

/** Runs fn with temporary environment values, then restores them. */
function withEnv(values, fn) {
  const saved = Object.fromEntries(Object.keys(values).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(values)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  try { return fn(); } finally { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
}

describe('Test code 123456 (local testing only)', () => {
  it('is accepted on a local development server', () => {
    withEnv({ NODE_ENV: 'development', RENDER: undefined, DEV_OTP_ENABLED: 'true' }, () => {
      assert.equal(isTestOtpEnvironment(), true);
      assert.equal(isDevOtpAllowed('123456'), true);
      assert.equal(isDevOtpAllowed('654321'), false, 'only the fixed test code');
    });
  });

  it('is NEVER accepted on Render, even if NODE_ENV is not set to production', () => {
    withEnv({ NODE_ENV: undefined, RENDER: 'true', DEV_OTP_ENABLED: 'true' }, () => {
      assert.equal(isTestOtpEnvironment(), false);
      assert.equal(isDevOtpAllowed('123456'), false);
    });
  });

  it('is never accepted in production, or when switched off', () => {
    withEnv({ NODE_ENV: 'production', RENDER: undefined, DEV_OTP_ENABLED: 'true' }, () => assert.equal(isDevOtpAllowed('123456'), false));
    withEnv({ NODE_ENV: 'development', RENDER: undefined, DEV_OTP_ENABLED: 'false' }, () => assert.equal(isDevOtpAllowed('123456'), false));
  });
});
