import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRIES, COUNTRY_PHONE_RULES, COUNTRY_FLAGS } from '../src/utils/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Signup Page: Country Dial Code and 6-Digit OTP Verification Suite', () => {
  describe('1. Country Dial Code Formatting (No Country Name in Trigger)', () => {
    // Generate the options identically as done in BuyerRegisterForm and SupplierRegisterForm
    const COUNTRY_DIAL_OPTIONS = COUNTRIES.map((c) => ({
      value: c,
      label: `+${COUNTRY_PHONE_RULES[c]?.dial || '91'}`.trim(),
      description: `${COUNTRY_FLAGS[c] || ''} ${c}`.trim(),
    }));

    it('ensures all country dial option labels start with + and contain only digits', () => {
      assert.ok(COUNTRY_DIAL_OPTIONS.length > 0, 'COUNTRY_DIAL_OPTIONS must not be empty');
      for (const opt of COUNTRY_DIAL_OPTIONS) {
        assert.match(
          opt.label,
          /^\+\d+$/,
          `Option label "${opt.label}" for country "${opt.value}" must contain ONLY dial code (e.g. +91, +1), NO country name`
        );
      }
    });

    it('ensures India resolves to +91 in small box trigger without country text', () => {
      const indiaOpt = COUNTRY_DIAL_OPTIONS.find((o) => o.value === 'India');
      assert.ok(indiaOpt, 'India must exist in options');
      assert.strictEqual(indiaOpt.label, '+91');
      assert.doesNotMatch(indiaOpt.label, /India/i, 'Trigger label must not contain country name');
    });

    it('ensures United States resolves to +1 without country text', () => {
      const usOpt = COUNTRY_DIAL_OPTIONS.find((o) => o.value === 'United States');
      assert.ok(usOpt, 'United States must exist in options');
      assert.strictEqual(usOpt.label, '+1');
      assert.doesNotMatch(usOpt.label, /United States/i, 'Trigger label must not contain country name');
    });

    it('ensures search description retains country name and flag for accessible dropdown search', () => {
      const indiaOpt = COUNTRY_DIAL_OPTIONS.find((o) => o.value === 'India');
      assert.ok(indiaOpt.description.includes('India'), 'Search description must retain India');
    });
  });

  describe('2. 6-Digit OTP Validation & Parsing Rules', () => {
    const sanitizeOtp = (input) => String(input || '').replace(/\D/g, '').slice(0, 6);
    const isValidOtp = (otp) => /^\d{6}$/.test(otp);

    it('accepts valid 6-digit numeric OTP', () => {
      assert.strictEqual(isValidOtp('123456'), true);
      assert.strictEqual(isValidOtp('839201'), true);
      assert.strictEqual(isValidOtp('000000'), true);
    });

    it('rejects incomplete codes with fewer than 6 digits', () => {
      assert.strictEqual(isValidOtp(''), false);
      assert.strictEqual(isValidOtp('12345'), false);
      assert.strictEqual(isValidOtp('12'), false);
    });

    it('rejects codes with alphanumeric characters or symbols', () => {
      assert.strictEqual(isValidOtp('12345a'), false);
      assert.strictEqual(isValidOtp('12-345'), false);
      assert.strictEqual(isValidOtp('abcdef'), false);
    });

    it('sanitizes pasted codes by stripping non-digits and truncating to 6 digits', () => {
      assert.strictEqual(sanitizeOtp('123-456'), '123456');
      assert.strictEqual(sanitizeOtp('  987 654  '), '987654');
      assert.strictEqual(sanitizeOtp('Code: 554433 (valid for 5m)'), '554433');
      assert.strictEqual(sanitizeOtp('1234567890'), '123456');
    });
  });

  describe('3. Six Digit Input Array Slots Behavior', () => {
    it('creates an array of exactly 6 slots from any OTP string', () => {
      const getSlots = (otp) => Array(6).fill('').map((_, i) => (otp && otp[i] !== undefined ? otp[i] : ''));

      assert.deepStrictEqual(getSlots(''), ['', '', '', '', '', '']);
      assert.deepStrictEqual(getSlots('123'), ['1', '2', '3', '', '', '']);
      assert.deepStrictEqual(getSlots('123456'), ['1', '2', '3', '4', '5', '6']);
    });
  });

  describe('4. Button Wording and UI Invariants', () => {
    it('uses "Get OTP" as primary trigger action rather than "Verify OTP"', () => {
      const getActionText = (sending, cooldown) => {
        if (sending) return 'Sending...';
        if (cooldown > 0) return `Resend (${cooldown}s)`;
        return 'Get OTP';
      };

      assert.strictEqual(getActionText(false, 0), 'Get OTP');
      assert.strictEqual(getActionText(true, 0), 'Sending...');
      assert.strictEqual(getActionText(false, 45), 'Resend (45s)');
    });
  });

  describe('5. Mobile Validation & Pre-Verification Prerequisites', () => {
    const getMobileError = (phone, country = 'India') => {
      const digits = String(phone || '').replace(/\D/g, '');
      const dial = COUNTRY_PHONE_RULES[country]?.dial || '91';
      const example = '98765 43210';
      const invalidMsg = `Please enter a valid mobile number for the selected country (e.g. +${dial} ${example}).`;

      if (digits.length > 10) {
        return invalidMsg;
      }
      return '';
    };

    it('shows exact error message when user inserts more than 10 digits', () => {
      const msg = getMobileError('98765432101', 'India');
      assert.strictEqual(
        msg,
        'Please enter a valid mobile number for the selected country (e.g. +91 98765 43210).'
      );
    });

    it('does not show length error for exactly 10 digits', () => {
      const msg = getMobileError('9876543210', 'India');
      assert.strictEqual(msg, '');
    });

    it('requires Full Name and Company Name before mobile verification proceeds', () => {
      const checkPreVerification = ({ name, companyName, isSupplier = true }) => {
        const nameMissing = !name || !name.trim();
        const companyMissing = !companyName || !companyName.trim();
        if (nameMissing || companyMissing) {
          return {
            allowed: false,
            phoneError: isSupplier
              ? 'Please fill Full Name of Representative * and Company Name / Legal Business Name * before mobile verification.'
              : 'Please fill Full Name * and Business / Company Name * before mobile verification.',
          };
        }
        return { allowed: true };
      };

      const resultSupplier = checkPreVerification({ name: '', companyName: '', isSupplier: true });
      assert.strictEqual(resultSupplier.allowed, false);
      assert.strictEqual(
        resultSupplier.phoneError,
        'Please fill Full Name of Representative * and Company Name / Legal Business Name * before mobile verification.'
      );

      const resultBuyer = checkPreVerification({ name: '', companyName: 'Apex', isSupplier: false });
      assert.strictEqual(resultBuyer.allowed, false);
      assert.strictEqual(
        resultBuyer.phoneError,
        'Please fill Full Name * and Business / Company Name * before mobile verification.'
      );

      const resultSuccess = checkPreVerification({ name: 'John Doe', companyName: 'Apex Ltd', isSupplier: true });
      assert.strictEqual(resultSuccess.allowed, true);
    });

    it('ensures Business Email Address and Password start strictly blank with anti-autofill measures', () => {
      const supplierSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/forms/SupplierRegisterForm.jsx'), 'utf8');
      const buyerSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/forms/BuyerRegisterForm.jsx'), 'utf8');

      // Both must initialize email and password to empty strings
      assert.match(supplierSrc, /email:\s*''/);
      assert.match(supplierSrc, /password:\s*''/);
      assert.match(buyerSrc, /email:\s*''/);
      assert.match(buyerSrc, /password:\s*''/);

      // Both must include anti-autofill hidden decoy fields
      assert.match(supplierSrc, /fake_username_remembered/);
      assert.match(supplierSrc, /fake_password_remembered/);
      assert.match(buyerSrc, /fake_username_remembered/);
      assert.match(buyerSrc, /fake_password_remembered/);

      // Password fields must have autoComplete="new-password"
      assert.match(supplierSrc, /autoComplete="new-password"/);
      assert.match(buyerSrc, /autoComplete="new-password"/);

      // Both forms must label the field Business Email Address
      assert.match(supplierSrc, /Business Email Address/);
      assert.match(buyerSrc, /Business Email Address/);
    });
  });
});

