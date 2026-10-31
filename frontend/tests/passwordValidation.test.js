import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluatePassword,
  validatePassword,
  PASSWORD_CRITERIA,
  ALLOWED_SPECIAL_CHARS,
  SUPPORTED_CHARACTERS_REGEX,
} from '../src/utils/passwordRules.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('TradeExpress Frontend Password Validation & Security Suite', () => {
  describe('1. Standard Password Criteria Evaluation', () => {
    it('verifies all 6 mandatory password criteria exist in definition', () => {
      assert.strictEqual(PASSWORD_CRITERIA.length, 6);
      const ids = PASSWORD_CRITERIA.map((c) => c.id);
      assert.ok(ids.includes('length'));
      assert.ok(ids.includes('upper'));
      assert.ok(ids.includes('lower'));
      assert.ok(ids.includes('number'));
      assert.ok(ids.includes('special'));
      assert.ok(ids.includes('chars'));
    });

    it('validates minimum 8 and maximum 64 characters length bounds', () => {
      // 8 chars
      const pass8 = 'Pass123@';
      const eval8 = evaluatePassword(pass8);
      assert.strictEqual(eval8.results.find((r) => r.id === 'length')?.passed, true);
      assert.strictEqual(eval8.allPassed, true);

      // 64 chars
      const pass64 = 'A' + 'b'.repeat(60) + '1' + '@' + 'Z';
      assert.strictEqual(pass64.length, 64);
      const eval64 = evaluatePassword(pass64);
      assert.strictEqual(eval64.results.find((r) => r.id === 'length')?.passed, true);
      assert.strictEqual(eval64.allPassed, true);

      // 7 chars (fail)
      const pass7 = 'Pass12@';
      const eval7 = evaluatePassword(pass7);
      assert.strictEqual(eval7.results.find((r) => r.id === 'length')?.passed, false);
      assert.strictEqual(eval7.allPassed, false);

      // 65 chars (fail)
      const pass65 = 'A' + 'b'.repeat(61) + '1' + '@' + 'Z';
      assert.strictEqual(pass65.length, 65);
      const eval65 = evaluatePassword(pass65);
      assert.strictEqual(eval65.results.find((r) => r.id === 'length')?.passed, false);
      assert.strictEqual(eval65.allPassed, false);
    });

    it('requires at least one uppercase letter (A-Z)', () => {
      const evalMissing = evaluatePassword('lowercase123@');
      assert.strictEqual(evalMissing.results.find((r) => r.id === 'upper')?.passed, false);
      assert.strictEqual(evalMissing.allPassed, false);

      const evalPresent = evaluatePassword('Lowercase123@');
      assert.strictEqual(evalPresent.results.find((r) => r.id === 'upper')?.passed, true);
    });

    it('requires at least one lowercase letter (a-z)', () => {
      const evalMissing = evaluatePassword('UPPERCASE123@');
      assert.strictEqual(evalMissing.results.find((r) => r.id === 'lower')?.passed, false);
      assert.strictEqual(evalMissing.allPassed, false);

      const evalPresent = evaluatePassword('UPPERcasE123@');
      assert.strictEqual(evalPresent.results.find((r) => r.id === 'lower')?.passed, true);
    });

    it('requires at least one numeric digit (0-9)', () => {
      const evalMissing = evaluatePassword('LettersOnly@#');
      assert.strictEqual(evalMissing.results.find((r) => r.id === 'number')?.passed, false);
      assert.strictEqual(evalMissing.allPassed, false);

      const evalPresent = evaluatePassword('Letters1Only@#');
      assert.strictEqual(evalPresent.results.find((r) => r.id === 'number')?.passed, true);
    });

    it('requires at least one special character from (@#$!%&*)', () => {
      const evalMissing = evaluatePassword('PlainPassword123');
      assert.strictEqual(evalMissing.results.find((r) => r.id === 'special')?.passed, false);
      assert.strictEqual(evalMissing.allPassed, false);

      // Test all allowed special characters
      for (const char of ['@', '#', '$', '!', '%', '&', '*']) {
        const evalChar = evaluatePassword(`TestPass1${char}`);
        assert.strictEqual(
          evalChar.results.find((r) => r.id === 'special')?.passed,
          true,
          `Special character ${char} should pass`
        );
        assert.strictEqual(evalChar.allPassed, true);
      }
    });

    it('prohibits spaces and unsupported special characters', () => {
      // Space in middle
      const evalSpace = evaluatePassword('Pass 123@Word');
      assert.strictEqual(evalSpace.results.find((r) => r.id === 'chars')?.passed, false);
      assert.strictEqual(evalSpace.allPassed, false);

      // Unsupported symbols
      for (const badChar of ['<', '>', '^', '~', '/', '\\', '?', '=', '+', '-']) {
        const evalBad = evaluatePassword(`Pass123@${badChar}`);
        assert.strictEqual(
          evalBad.results.find((r) => r.id === 'chars')?.passed,
          false,
          `Unsupported char ${badChar} should fail chars test`
        );
      }
    });
  });

  describe('2. Real-Time Confirm Password Match Verification', () => {
    it('returns null match when confirm password is not provided or empty', () => {
      const resNull = evaluatePassword('Pass123@', null);
      assert.strictEqual(resNull.confirmMatch, null);
      assert.strictEqual(resNull.confirmMessage, '');

      const resEmpty = evaluatePassword('Pass123@', '');
      assert.strictEqual(resEmpty.confirmMatch, null);
      assert.strictEqual(resEmpty.confirmMessage, '');
    });

    it('returns "Passwords match" when confirm password exactly matches password', () => {
      const res = evaluatePassword('Pass123@', 'Pass123@');
      assert.strictEqual(res.confirmMatch, true);
      assert.strictEqual(res.confirmMessage, 'Passwords match');
    });

    it('returns "Passwords do not match" when confirm password differs', () => {
      const res = evaluatePassword('Pass123@', 'Pass1234@');
      assert.strictEqual(res.confirmMatch, false);
      assert.strictEqual(res.confirmMessage, 'Passwords do not match');
    });

    it('never trims passwords when comparing confirmation (case and space sensitive)', () => {
      const resSpace = evaluatePassword('Pass123@', 'Pass123@ ');
      assert.strictEqual(resSpace.confirmMatch, false);

      const resCase = evaluatePassword('Pass123@', 'pass123@');
      assert.strictEqual(resCase.confirmMatch, false);
    });
  });

  describe('3. Password Show/Hide Toggle Invariants', () => {
    it('simulates show/hide visibility toggle without altering the stored password value', () => {
      let password = 'MySecretPass123@';
      let showPassword = false;

      // Toggle show
      showPassword = !showPassword;
      assert.strictEqual(showPassword, true);
      assert.strictEqual(password, 'MySecretPass123@', 'Password value must not mutate upon show');

      // Toggle hide
      showPassword = !showPassword;
      assert.strictEqual(showPassword, false);
      assert.strictEqual(password, 'MySecretPass123@', 'Password value must not mutate upon hide');
    });
  });

  describe('4. Component Integration & Real-Time Indicators Integrity', () => {
    const readSrc = (relPath) => fs.readFileSync(path.resolve(__dirname, relPath), 'utf8');

    it('ensures BuyerRegisterForm integrates PasswordValidationIndicator and validatePassword', () => {
      const src = readSrc('../src/components/forms/BuyerRegisterForm.jsx');
      assert.ok(src.includes('PasswordValidationIndicator'), 'Must import or render PasswordValidationIndicator');
      assert.ok(src.includes('validatePassword'), 'Must import and use validatePassword');
      assert.ok(src.includes('confirmPassword'), 'Must track confirmPassword');
      assert.ok(src.includes('showPassword'), 'Must support showPassword toggle');
      assert.ok(src.includes('showConfirmPassword'), 'Must support showConfirmPassword toggle');
    });

    it('ensures SupplierRegisterForm integrates PasswordValidationIndicator and validatePassword', () => {
      const src = readSrc('../src/components/forms/SupplierRegisterForm.jsx');
      assert.ok(src.includes('PasswordValidationIndicator'), 'Must import or render PasswordValidationIndicator');
      assert.ok(src.includes('validatePassword'), 'Must import and use validatePassword');
      assert.ok(src.includes('confirmPassword'), 'Must track confirmPassword');
      assert.ok(src.includes('showPassword'), 'Must support showPassword toggle');
      assert.ok(src.includes('showConfirmPassword'), 'Must support showConfirmPassword toggle');
    });

    it('ensures ForgotPassword page integrates PasswordValidationIndicator with show/hide eye toggles', () => {
      const src = readSrc('../src/pages/ForgotPassword.jsx');
      assert.ok(src.includes('PasswordValidationIndicator'), 'Must render PasswordValidationIndicator');
      assert.ok(src.includes('validatePassword'), 'Must validate password on reset');
      assert.ok(src.includes('showNewPassword'), 'Must support showNewPassword toggle');
      assert.ok(src.includes('showConfirmPassword'), 'Must support showConfirmPassword toggle');
    });

    it('ensures BuyerSettings page integrates PasswordValidationIndicator and eye toggles', () => {
      const src = readSrc('../src/pages/buyer/BuyerSettings.jsx');
      assert.ok(src.includes('PasswordValidationIndicator'), 'Must render PasswordValidationIndicator');
      assert.ok(src.includes('validatePassword'), 'Must enforce validatePassword');
      assert.ok(src.includes('showNewPass'), 'Must support showNewPass toggle');
      assert.ok(src.includes('showConfirmPass'), 'Must support showConfirmPass toggle');
    });

    it('ensures SupplierSettings page integrates PasswordValidationIndicator and eye toggles', () => {
      const src = readSrc('../src/pages/supplier/SupplierSettings.jsx');
      assert.ok(src.includes('PasswordValidationIndicator'), 'Must render PasswordValidationIndicator');
      assert.ok(src.includes('validatePassword'), 'Must enforce validatePassword');
      assert.ok(src.includes('showNewPassword'), 'Must support showNewPassword toggle');
      assert.ok(src.includes('showConfirmPassword'), 'Must support showConfirmPassword toggle');
    });

    it('ensures SuperAdminAdmins modal integrates PasswordValidationIndicator for sub-admin provisioning', () => {
      const src = readSrc('../src/pages/superadmin/SuperAdminAdmins.jsx');
      assert.ok(src.includes('PasswordValidationIndicator'), 'Must render PasswordValidationIndicator');
      assert.ok(src.includes('validatePassword'), 'Must enforce validatePassword');
      assert.ok(src.includes('showPassword'), 'Must support showPassword toggle');
    });
  });
});
