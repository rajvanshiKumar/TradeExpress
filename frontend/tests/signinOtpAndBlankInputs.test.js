import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('TradeExpress Sign-in Page OTP & Blank Input Invariants', () => {
  const loginFormPath = path.resolve('src/components/forms/LoginForm.jsx');
  const authContextPath = path.resolve('src/contexts/AuthContext.jsx');
  const loginFormSource = fs.readFileSync(loginFormPath, 'utf8');
  const authContextSource = fs.readFileSync(authContextPath, 'utf8');

  describe('1. Strictly Blank Input Boxes by Default', () => {
    it('ensures all visible inputs have placeholder="" with no pre-filled example values', () => {
      // Find all placeholder="..." attributes in LoginForm.jsx
      const placeholderMatches = [...loginFormSource.matchAll(/placeholder="([^"]*)"/g)];
      assert.ok(placeholderMatches.length > 0, 'LoginForm should contain placeholder attributes');

      for (const match of placeholderMatches) {
        assert.equal(
          match[1],
          '',
          `Found non-empty placeholder "${match[1]}" in LoginForm.jsx. All inputs must be completely blank.`
        );
      }
    });

    it('ensures form state initializes with empty strings for email, phone, and password', () => {
      assert.ok(
        loginFormSource.includes('email: ""'),
        'Initial state for email must be an empty string'
      );
      assert.ok(
        loginFormSource.includes('phone: ""'),
        'Initial state for phone must be an empty string'
      );
      assert.ok(
        loginFormSource.includes('password: ""'),
        'Initial state for password must be an empty string'
      );
    });

    it('includes decoy hidden inputs and autoComplete="off" to suppress aggressive browser autofill', () => {
      assert.ok(
        loginFormSource.includes('autoComplete="off"'),
        'LoginForm must specify autoComplete="off"'
      );
      assert.ok(
        loginFormSource.includes('decoy_user_field') && loginFormSource.includes('decoy_pass_field'),
        'LoginForm must include anti-autofill decoy fields to prevent browsers from dumping cached credentials'
      );
    });
  });

  describe('2. Fast Email OTP & Mobile OTP Verification for Buyer & Supplier', () => {
    it('provides Email OTP and Mobile OTP as primary public member login methods', () => {
      assert.ok(loginFormSource.includes('Email OTP'), 'LoginForm must offer Email OTP option');
      assert.ok(loginFormSource.includes('Mobile OTP'), 'LoginForm must offer Mobile OTP option');
      assert.ok(
        loginFormSource.includes('handleSendEmailOtp'),
        'LoginForm must implement handleSendEmailOtp'
      );
      assert.ok(
        loginFormSource.includes('handleVerifyEmailOtp'),
        'LoginForm must implement handleVerifyEmailOtp'
      );
      assert.ok(
        loginFormSource.includes('handleSendMobileOtp'),
        'LoginForm must implement handleSendMobileOtp'
      );
      assert.ok(
        loginFormSource.includes('handleVerifyMobileOtp'),
        'LoginForm must implement handleVerifyMobileOtp'
      );
    });

    it('calls existing /auth/send-email-otp and /auth/send-mobile-login-otp endpoints', () => {
      assert.ok(
        loginFormSource.includes('/auth/send-email-otp'),
        'Must call /auth/send-email-otp for email OTP dispatch'
      );
      assert.ok(
        loginFormSource.includes('/auth/send-mobile-login-otp'),
        'Must call /auth/send-mobile-login-otp for mobile OTP dispatch'
      );
    });

    it('integrates 6 separate OTP input boxes for smooth one-digit auto-advancing verification', () => {
      assert.ok(
        loginFormSource.includes('emailOtpDigits') && loginFormSource.includes('mobileOtpDigits'),
        'Must manage 6 discrete digits for OTP'
      );
      assert.ok(
        loginFormSource.includes('handleOtpBoxChange'),
        'Must support per-box auto-focusing on digit input'
      );
      assert.ok(
        loginFormSource.includes('handleOtpBoxPaste'),
        'Must support pasting 6-digit verification code'
      );
      assert.ok(
        loginFormSource.includes('handleOtpBoxKeyDown'),
        'Must support backspace and arrow navigation between boxes'
      );
    });

    it('strictly removes "Have a password? Sign in with password" and bottom Send OTP buttons', () => {
      assert.equal(
        loginFormSource.includes('Have a password? Sign in with password'),
        false,
        'LoginForm must NOT contain "Have a password? Sign in with password"'
      );
      assert.equal(
        loginFormSource.includes('"Send Email OTP"'),
        false,
        'LoginForm must NOT have bottom button labeled "Send Email OTP"'
      );
      assert.equal(
        loginFormSource.includes('"Send Mobile OTP"'),
        false,
        'LoginForm must NOT have bottom button labeled "Send Mobile OTP"'
      );
    });

    it('provides the "Connecting to Google" button for Google OAuth', () => {
      assert.ok(
        loginFormSource.includes('Connecting to Google'),
        'LoginForm must have button with Connecting to Google'
      );
      assert.ok(
        loginFormSource.includes('handleGoogleSignIn'),
        'LoginForm must implement handleGoogleSignIn'
      );
      assert.ok(
        loginFormSource.includes('/auth/google'),
        'LoginForm must connect to /auth/google endpoint'
      );
    });

    it('ensures mobile number field prevents alphabets and only accepts numeric digits', () => {
      assert.ok(
        loginFormSource.includes('handlePhoneKeyDown'),
        'LoginForm must implement handlePhoneKeyDown'
      );
      assert.ok(
        loginFormSource.includes('handlePhoneChange'),
        'LoginForm must implement handlePhoneChange'
      );
      assert.ok(
        loginFormSource.includes('replace(/\\D/g, "")'),
        'Must strip non-digit characters from phone input'
      );
      assert.ok(
        loginFormSource.includes('!/^\\d$/.test(e.key)'),
        'Must block alphabet keystrokes from phone input'
      );
    });

    it('ensures country selector displays only the country code and no country name string in mobile OTP', () => {
      // Must not render country name in the dropdown options
      assert.equal(
        loginFormSource.includes('<span className="truncate">{c}</span>'),
        false,
        'LoginForm must NOT render country name in mobile OTP dropdown'
      );
      assert.equal(
        loginFormSource.includes('COUNTRY_FLAGS[values.country]'),
        false,
        'LoginForm must NOT render flag / regional short indicator in mobile OTP trigger'
      );
      assert.ok(
        loginFormSource.includes('+{rule?.dial}'),
        'LoginForm must display dial code in options'
      );
    });
  });

  describe('3. AuthContext Email & Mobile OTP Authentication Contract', () => {
    it('defines and exports loginEmailOtp in AuthContext.jsx', () => {
      assert.ok(
        authContextSource.includes('const loginEmailOtp = useCallback'),
        'AuthContext must define loginEmailOtp'
      );
      assert.ok(
        authContextSource.includes('loginEmailOtp, loginAdmin') ||
          authContextSource.includes('loginEmailOtp'),
        'AuthContext value must export loginEmailOtp'
      );
    });

    it('defines and exports loginMobile in AuthContext.jsx', () => {
      assert.ok(
        authContextSource.includes('const loginMobile = useCallback'),
        'AuthContext must define loginMobile'
      );
    });
  });
});
