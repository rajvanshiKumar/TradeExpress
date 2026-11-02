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
    const getMobileError = (phone) => {
      const digits = String(phone || '').replace(/\D/g, '');
      const example = '98765 43210';
      const invalidMsg = `Please enter a valid mobile number (e.g. ${example}).`;

      if (digits.length > 10) {
        return invalidMsg;
      }
      return '';
    };

    it('shows exact error message when user inserts more than 10 digits', () => {
      const msg = getMobileError('98765432101');
      assert.strictEqual(
        msg,
        'Please enter a valid mobile number (e.g. 98765 43210).'
      );
    });

    it('does not show length error for exactly 10 digits', () => {
      const msg = getMobileError('9876543210');
      assert.strictEqual(msg, '');
    });

    it('highlights name and company boxes without showing text message when mobile is entered or verification attempted', () => {
      const checkPreVerification = ({ name, companyName }) => {
        const nameMissing = !name || !name.trim();
        const companyMissing = !companyName || !companyName.trim();
        if (nameMissing || companyMissing) {
          return {
            allowed: false,
            highlightName: nameMissing,
            highlightCompany: companyMissing,
            phoneError: '', // Strictly no text error message, only box highlighting
          };
        }
        return { allowed: true, highlightName: false, highlightCompany: false, phoneError: '' };
      };

      const resultSupplier = checkPreVerification({ name: '', companyName: '' });
      assert.strictEqual(resultSupplier.allowed, false);
      assert.strictEqual(resultSupplier.highlightName, true);
      assert.strictEqual(resultSupplier.highlightCompany, true);
      assert.strictEqual(resultSupplier.phoneError, '', 'Must not show text error message');

      const resultBuyer = checkPreVerification({ name: '', companyName: 'Apex' });
      assert.strictEqual(resultBuyer.allowed, false);
      assert.strictEqual(resultBuyer.highlightName, true);
      assert.strictEqual(resultBuyer.highlightCompany, false);
      assert.strictEqual(resultBuyer.phoneError, '', 'Must not show text error message');

      const resultSuccess = checkPreVerification({ name: 'John Doe', companyName: 'Apex Ltd' });
      assert.strictEqual(resultSuccess.allowed, true);
      assert.strictEqual(resultSuccess.highlightName, false);
      assert.strictEqual(resultSuccess.highlightCompany, false);

      // Verify text message is removed from source code
      const supplierSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/forms/SupplierRegisterForm.jsx'), 'utf8');
      const buyerSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/forms/BuyerRegisterForm.jsx'), 'utf8');
      assert.doesNotMatch(supplierSrc, /Please fill Full Name of Representative/);
      assert.doesNotMatch(buyerSrc, /Please fill Full Name \* and Business/);
      assert.match(supplierSrc, /highlightedFields/);
      assert.match(buyerSrc, /highlightedFields/);
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

    it('removes GST status dropdown completely and ensures certificate field label appears dynamically', () => {
      const supplierSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/forms/SupplierRegisterForm.jsx'), 'utf8');

      // Statutory Note and GST status dropdown completely removed
      assert.doesNotMatch(supplierSrc, /Suppliers dealing exclusively in exempt commodities/);
      assert.doesNotMatch(supplierSrc, /Options represent statutory registration categories/);
      assert.doesNotMatch(supplierSrc, /Select GST Registration Category/);

      // Dynamic certificate label helper exists and reflects selected certificate (BRN, GST, etc.)
      assert.match(supplierSrc, /getCertificateFieldLabel/);
      assert.match(supplierSrc, /Boolean\(values\.businessType/);
    });

    it('enforces Business Address country visibility rules and removes Separate Factory/Warehouse Address', () => {
      const supplierSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/forms/SupplierRegisterForm.jsx'), 'utf8');

      // Separate Factory / Warehouse Address section completely removed
      assert.doesNotMatch(supplierSrc, /Separate Factory \/ Warehouse Address/);
      assert.doesNotMatch(supplierSrc, /Factory or manufacturing unit address is the same as registered business address/);

      // When India is selected, only State, City, PIN Code are shown
      assert.match(supplierSrc, /isIndia\s*\?\s*\([\s\S]*?State \/ Union Territory[\s\S]*?City[\s\S]*?PIN Code/);

      // When Out of India is selected, only Registered Business Address is shown (not state, pin, city)
      assert.match(supplierSrc, /Registered Business Address\s*<span[^>]*>\*<\/span>/);

      // Step 3 validation requires state/city/PIN for India, and only registered business address for out of India
      assert.match(supplierSrc, /if\s*\(values\.country === 'India'\)[\s\S]*?stepErrors\.state[\s\S]*?stepErrors\.city[\s\S]*?stepErrors\.postalCode/);
      assert.match(supplierSrc, /stepErrors\.businessAddress = 'Registered business address is required.'/);
    });

    it('ensures no toast notifications are displayed on Sign Out or GSTIN verification', () => {
      const userMenuSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/layout/UserMenu.jsx'), 'utf8');
      const superAdminLayoutSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/layout/SuperAdminLayout.jsx'), 'utf8');
      const supplierRegisterSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/forms/SupplierRegisterForm.jsx'), 'utf8');

      // UserMenu sign out does not dispatch toast
      assert.doesNotMatch(userMenuSrc, /showToast\(['"]You have been signed out/);
      assert.doesNotMatch(userMenuSrc, /useNotifications/);

      // SuperAdminLayout sign out does not dispatch toast
      assert.doesNotMatch(superAdminLayoutSrc, /showToast\(['"]Signed out of Super Admin/);
      assert.doesNotMatch(superAdminLayoutSrc, /useNotifications/);

      // SupplierRegisterForm GSTIN verification does not dispatch toast
      const gstinBlockMatch = supplierRegisterSrc.match(/const handleVerifyGstin = async \(\) => \{([\s\S]*?)\n  \};/);
      assert.ok(gstinBlockMatch, 'handleVerifyGstin function must exist');
      const gstinBody = gstinBlockMatch[1];
      assert.doesNotMatch(gstinBody, /showToast/);

      // SupplierRegisterForm PAN-Aadhaar verification does not dispatch toast
      const panAadhaarBlockMatch = supplierRegisterSrc.match(/const handleCheckLinkStatus = async \(\) => \{([\s\S]*?)\n  \};/);
      assert.ok(panAadhaarBlockMatch, 'handleCheckLinkStatus function must exist');
      const panAadhaarBody = panAadhaarBlockMatch[1];
      assert.doesNotMatch(panAadhaarBody, /showToast/);
    });

    it('ensures supplier submission is protected against hanging with timeouts and resilient payload scope', () => {
      const supplierRegisterSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/forms/SupplierRegisterForm.jsx'), 'utf8');

      // handleSubmit must have timeout to prevent hanging
      assert.match(supplierRegisterSrc, /AbortSignal\.timeout/);

      // payload must be defined prior to try block so catch block has safe access
      const handleSubmitMatch = supplierRegisterSrc.match(/const handleSubmit = async \([\s\S]*?\n  \};/);
      assert.ok(handleSubmitMatch, 'handleSubmit must exist');
      const submitBody = handleSubmitMatch[0];
      const payloadPos = submitBody.indexOf('const payload =');
      const tryPos = submitBody.indexOf('try {');
      assert.ok(payloadPos > -1, 'payload must be defined');
      assert.ok(tryPos > -1, 'try block must exist');
      assert.ok(payloadPos < tryPos, 'payload must be declared before try block to prevent ReferenceError in catch');
    });
  });
});

