import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { smtpTimeoutMs } from '../../src/config/mailer.js';

describe('SMTP timeout (SMTP_TIMEOUT_MS)', () => {
  it('defaults to 8 s, below the sign-in page 12 s request limit', () => {
    assert.equal(smtpTimeoutMs(undefined), 8000);
    assert.equal(smtpTimeoutMs('not a number'), 8000);
    assert.ok(smtpTimeoutMs(undefined) < 12000);
  });

  it('accepts a configured value and keeps it between 3 s and 30 s', () => {
    assert.equal(smtpTimeoutMs('10000'), 10000);
    assert.equal(smtpTimeoutMs('500'), 3000);
    assert.equal(smtpTimeoutMs('120000'), 30000);
  });
});
