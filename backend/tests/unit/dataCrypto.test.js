import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ENV } from '../../src/config/env.js';
import { decryptField, encryptField, encryptIfConfigured, encryptionAvailable, isEncrypted, readEncryptedField } from '../../src/utils/dataCrypto.js';

describe('Field encryption (bank account numbers)', () => {
  it('without DATA_ENCRYPTION_KEY nothing is encrypted (no fallback key) and unreadable values are hidden', () => {
    const saved = ENV.DATA_ENCRYPTION_KEY;
    ENV.DATA_ENCRYPTION_KEY = '';
    try {
      assert.equal(encryptionAvailable(), false);
      assert.equal(encryptIfConfigured('123456789012'), '123456789012', 'stored as before');
      assert.throws(() => encryptField('x'), (e) => e.errorCode === 'ENCRYPTION_NOT_CONFIGURED');
      assert.equal(readEncryptedField('enc:v1:AAAA'), null);
    } finally {
      ENV.DATA_ENCRYPTION_KEY = saved;
    }
  });

  it('with the key: AES-GCM with a random IV, round trip, tamper detection, legacy plaintext readable', () => {
    const saved = ENV.DATA_ENCRYPTION_KEY;
    ENV.DATA_ENCRYPTION_KEY = '11'.repeat(32); // test-only key
    try {
      const enc = encryptIfConfigured('123456789012');
      assert.ok(isEncrypted(enc));
      assert.notEqual(enc, encryptField('123456789012'));
      assert.equal(readEncryptedField(enc), '123456789012');
      assert.equal(decryptField('123456789012'), '123456789012');
      const tampered = enc.slice(0, -4) + (enc.endsWith('AAAA') ? 'BBBB' : 'AAAA');
      assert.throws(() => decryptField(tampered));
    } finally {
      ENV.DATA_ENCRYPTION_KEY = saved;
    }
  });
});
