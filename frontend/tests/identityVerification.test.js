import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiErrorCode, identityReverifyScope, IDENTITY_PROOF_LIFETIME_MS } from '../src/utils/identityVerification.js';

describe('Signup identity re-verification rules', () => {
  it('reads the error code from both API reply shapes', () => {
    assert.equal(apiErrorCode({ code: 'AADHAAR_MISMATCH' }), 'AADHAAR_MISMATCH');
    assert.equal(apiErrorCode({ error: { code: 'PAN_CHECK_LIMIT' } }), 'PAN_CHECK_LIMIT');
    assert.equal(apiErrorCode({}), null);
    assert.equal(apiErrorCode(null), null);
  });

  it('an expired, used or mismatched Aadhaar proof means verifying Aadhaar again', () => {
    for (const code of ['AADHAAR_NOT_VERIFIED', 'AADHAAR_VERIFICATION_EXPIRED', 'AADHAAR_VERIFICATION_USED', 'AADHAAR_MISMATCH', 'PAN_CHECK_LIMIT']) {
      assert.equal(identityReverifyScope(code), 'aadhaar', code);
    }
  });

  it('an expired or mismatched PAN proof means verifying the PAN again', () => {
    for (const code of ['PAN_AADHAAR_NOT_VERIFIED', 'PAN_AADHAAR_VERIFICATION_EXPIRED', 'PAN_AADHAAR_MISMATCH']) {
      assert.equal(identityReverifyScope(code), 'pan', code);
    }
  });

  it('duplicates and other errors only show their message', () => {
    for (const code of ['PAN_ALREADY_REGISTERED', 'AADHAAR_ALREADY_REGISTERED', 'EMAIL_VERIFICATION_EXPIRED', null]) {
      assert.equal(identityReverifyScope(code), null, String(code));
    }
  });

  it('the form expires proofs before the server does (30 minutes)', () => {
    assert.ok(IDENTITY_PROOF_LIFETIME_MS < 30 * 60 * 1000);
  });
});
