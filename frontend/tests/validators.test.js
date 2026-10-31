import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isEmail, normalizeEmail, parseMobile, rules } from '../src/utils/validators.js';

describe('Frontend Form Validators Test Suite', () => {
  describe('Email Normalization & Validation', () => {
    it('normalizes and validates standard email addresses', () => {
      assert.equal(normalizeEmail('  Test.User@Example.COM '), 'test.user@example.com');
      assert.equal(isEmail('buyer@tradesphere.com'), true);
      assert.equal(isEmail('admin'), true, 'admin alias supported');
      assert.equal(isEmail('invalid-email-address'), false);
      assert.equal(isEmail('user@'), false);
      assert.equal(isEmail(''), false);
    });
  });

  describe('Indian GSTIN & PAN Validators', () => {
    it('validates correct 15-character GSTIN format', () => {
      const gstinRule = rules.gstin();
      assert.equal(gstinRule('27ABCDE1234F1Z5'), '');
      assert.ok(gstinRule('INVALID_GSTIN').length > 0);
      assert.ok(gstinRule('').length > 0);
    });

    it('validates standard 10-character PAN format', () => {
      const panRule = rules.pan();
      assert.equal(panRule('ABCDE1234F'), '');
      assert.ok(panRule('12345ABCDE').length > 0);
    });
  });

  describe('Password Security Rule', () => {
    it('enforces comprehensive password security rules', () => {
      const pwRule = rules.password();
      assert.equal(pwRule('StrongPass123@'), '');
      assert.ok(pwRule('weak').includes('at least 8 characters'));
      assert.ok(pwRule('alllowercase123@').includes('uppercase letter'));
      assert.ok(pwRule('ALLUPPERCASE123@').includes('lowercase letter'));
      assert.ok(pwRule('NoNumbersHere@!').includes('numeric digit'));
      assert.ok(pwRule('NoSpecialChars123').includes('special character'));
      assert.ok(pwRule('ValidPass 123@').includes('spaces'));
      assert.ok(pwRule('ValidPass<123>@').includes('unsupported characters'));
    });
  });

  describe('Indian PIN Code Validator', () => {
    it('validates 6-digit Indian PIN code', () => {
      const pinRule = rules.pinCode();
      assert.equal(pinRule('400001', { country: 'India' }), '');
      assert.ok(pinRule('000123', { country: 'India' }).length > 0, 'PIN cannot start with 0');
      assert.ok(pinRule('12345', { country: 'India' }).length > 0, 'Must be 6 digits');
      assert.ok(pinRule('4000019', { country: 'India' }).length > 0, 'Must not exceed 6 digits');
    });
  });
});

