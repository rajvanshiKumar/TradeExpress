import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { isDevOtpAllowed } from '../../src/services/otpService.js';

// Connection strings for testing
const LOCAL = 'mysql://tradeexpress_test_user:x@127.0.0.1:3306/tradeexpress_test';
const HOSTED = 'mysql://avnadmin:x@mysql-example.aivencloud.com:12345/defaultdb';
const KEYS = ['NODE_ENV', 'DEV_OTP_ENABLED', 'DATABASE_URL'];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
const setEnv = (values) => {
  for (const k of KEYS) {
    if (values[k] === undefined) delete process.env[k];
    else process.env[k] = values[k];
  }
};
afterEach(() => setEnv(saved));

describe('Development test code 123456', () => {
  it('is accepted in development mode with local or hosted databases', () => {
    setEnv({ NODE_ENV: 'development', DEV_OTP_ENABLED: 'true', DATABASE_URL: LOCAL });
    assert.equal(isDevOtpAllowed('123456'), true);
    assert.equal(isDevOtpAllowed(' 123456 '), true);

    setEnv({ NODE_ENV: 'development', DEV_OTP_ENABLED: 'true', DATABASE_URL: HOSTED });
    assert.equal(isDevOtpAllowed('123456'), true);
    assert.equal(isDevOtpAllowed('654321'), false, 'only the fixed test code 123456');
  });

  it('is accepted in development by default unless explicitly disabled', () => {
    setEnv({ NODE_ENV: 'development', DATABASE_URL: HOSTED });
    assert.equal(isDevOtpAllowed('123456'), true);
  });

  it('is never accepted in production or when DEV_OTP_ENABLED is false', () => {
    setEnv({ NODE_ENV: 'production', DEV_OTP_ENABLED: 'true', DATABASE_URL: LOCAL });
    assert.equal(isDevOtpAllowed('123456'), false);

    setEnv({ NODE_ENV: 'production', DATABASE_URL: HOSTED });
    assert.equal(isDevOtpAllowed('123456'), false);

    setEnv({ NODE_ENV: 'development', DEV_OTP_ENABLED: 'false', DATABASE_URL: LOCAL });
    assert.equal(isDevOtpAllowed('123456'), false);
  });
});
