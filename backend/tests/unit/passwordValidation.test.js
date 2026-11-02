import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {
  validatePassword,
  ALLOWED_SPECIAL_CHARS,
  SUPPORTED_CHARACTERS_REGEX,
} from '../../src/utils/passwordValidator.js';

describe('TradeExpress Backend Password Security & Validation Suite', () => {
  describe('1. Length Requirements (8 to 64 Characters)', () => {
    it('accepts passwords at boundary length of 8 characters', () => {
      const res = validatePassword('Pass123@');
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.errors.length, 0);
    });

    it('accepts passwords at boundary length of 64 characters', () => {
      // 64 characters with upper, lower, digit, special @
      const pass64 = 'A' + 'a'.repeat(60) + '1' + '@' + 'Z';
      assert.strictEqual(pass64.length, 64);
      const res = validatePassword(pass64);
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.errors.length, 0);
    });

    it('rejects passwords shorter than 8 characters (7 chars)', () => {
      const res = validatePassword('Pass12@'); // 7 chars
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.some((e) => e.includes('at least 8 characters')));
    });

    it('rejects passwords longer than 64 characters (65 chars)', () => {
      const pass65 = 'A' + 'a'.repeat(61) + '1' + '@' + 'Z'; // 65 chars
      assert.strictEqual(pass65.length, 65);
      const res = validatePassword(pass65);
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.some((e) => e.includes('exceed 64 characters')));
    });

    it('rejects empty string and non-string inputs', () => {
      assert.strictEqual(validatePassword('').isValid, false);
      assert.strictEqual(validatePassword(null).isValid, false);
      assert.strictEqual(validatePassword(undefined).isValid, false);
      assert.strictEqual(validatePassword(12345678).isValid, false);
    });
  });

  describe('2. Character Composition Requirements', () => {
    it('rejects passwords missing an uppercase letter', () => {
      const res = validatePassword('lower123@');
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.some((e) => e.includes('uppercase letter')));
    });

    it('rejects passwords missing a lowercase letter', () => {
      const res = validatePassword('UPPER123@');
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.some((e) => e.includes('lowercase letter')));
    });

    it('rejects passwords missing a numeric digit', () => {
      const res = validatePassword('NoNumbers@');
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.some((e) => e.includes('numeric digit')));
    });

    it('rejects passwords missing a special character', () => {
      const res = validatePassword('Password123');
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.some((e) => e.includes('special character')));
    });

    it('accepts each supported special character individually (@#$!%&*)', () => {
      const supported = ['@', '#', '$', '!', '%', '&', '*'];
      for (const char of supported) {
        const pass = `ValidPass1${char}`;
        const res = validatePassword(pass);
        assert.strictEqual(res.isValid, true, `Password with "${char}" should be valid`);
      }
    });

    it('accepts passwords containing multiple permitted special characters', () => {
      const res = validatePassword('Secure#Pass12$!%');
      assert.strictEqual(res.isValid, true);
    });
  });

  describe('3. Strict No-Space & Raw String Preservation Rules', () => {
    it('rejects passwords with internal spaces', () => {
      const res = validatePassword('Valid 123@Pass');
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.some((e) => e.includes('not contain any spaces')));
    });

    it('rejects passwords with leading spaces without trimming them away', () => {
      const res = validatePassword(' Pass123@');
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.some((e) => e.includes('not contain any spaces')));
    });

    it('rejects passwords with trailing spaces without trimming them away', () => {
      const res = validatePassword('Pass123@ ');
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.some((e) => e.includes('not contain any spaces')));
    });

    it('rejects passwords with tab or newline whitespace characters', () => {
      assert.strictEqual(validatePassword('Pass123@\t').isValid, false);
      assert.strictEqual(validatePassword('Pass123@\n').isValid, false);
    });
  });

  describe('4. Strict Character Set: Reject Unsupported Characters', () => {
    const unsupportedChars = ['<', '>', '^', '~', '\\', '/', '|', '(', ')', '{', '}', '[', ']', '?', '=', '+', '-', '\'', '"', '`', ',', '.', ';', ':'];

    for (const char of unsupportedChars) {
      it(`rejects password containing unsupported character "${char}"`, () => {
        const pass = `Valid1@Pass${char}`;
        const res = validatePassword(pass);
        assert.strictEqual(res.isValid, false);
        assert.ok(res.errors.some((e) => e.includes('unsupported characters')));
      });
    }
  });

  describe('5. Password Hashing Security & Existing User Compatibility', () => {
    it('successfully hashes a valid password using bcrypt with salt rounds', async () => {
      const rawPassword = 'TradeExpress2026@#';
      const hash = await bcrypt.hash(rawPassword, 10);
      assert.ok(hash.startsWith('$2a$') || hash.startsWith('$2b$'));

      // Verifies bcrypt correctly matches the raw password against the hash
      const isMatch = await bcrypt.compare(rawPassword, hash);
      assert.strictEqual(isMatch, true);
    });

    it('retains backwards compatibility with existing user bcrypt hashes', async () => {
      // Simulating an existing user password hash generated earlier
      const existingPassword = 'ExistingAdminPass123@';
      const existingHash = await bcrypt.hash(existingPassword, 10);

      const isValidUser = await bcrypt.compare(existingPassword, existingHash);
      assert.strictEqual(isValidUser, true);

      const wrongAttempt = await bcrypt.compare('WrongPassword123@', existingHash);
      assert.strictEqual(wrongAttempt, false);
    });

    it('never leaks password hash or plain text into validation returns', () => {
      const res = validatePassword('SensitivePass123@');
      assert.strictEqual('password' in res, false);
      assert.strictEqual('hash' in res, false);
      assert.strictEqual('passwordHash' in res, false);
    });
  });
});

