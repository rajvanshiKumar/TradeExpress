import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseMobile } from '../src/utils/validators.js';
import { validatePassword } from '../src/utils/passwordRules.js';

describe('Buyer signup and sign-in fast-path checks', () => {
  const signup = fs.readFileSync(path.resolve('src/components/forms/BuyerRegisterForm.jsx'), 'utf8');
  const signin = fs.readFileSync(path.resolve('src/components/forms/LoginForm.jsx'), 'utf8');
  const auth = fs.readFileSync(path.resolve('src/contexts/AuthContext.jsx'), 'utf8');

  it('validates Indian mobile numbers and password strength locally', () => {
    assert.equal(parseMobile('9876543210', 'India').ok, true);
    assert.equal(parseMobile('1234567890', 'India').ok, false);
    assert.equal(validatePassword('weak').isValid, false);
    assert.equal(validatePassword('Strong@Pass123').isValid, true);
  });

  it('asks for no password at signup and blocks duplicate signup requests', () => {
    // Buyers sign in with an email / mobile code or Google, and can set a password later in Account Settings
    assert.doesNotMatch(signup, /handleChange\('password'\)/);
    assert.doesNotMatch(signup, /handleChange\('confirmPassword'\)/);
    assert.match(signup, /if \(busy \|\| submitLockRef\.current\) return/);
    assert.match(signup, /if \(!validateStep1\(\)\)/);
  });

  it('signs members in with Email OTP or Mobile OTP only and prevents duplicate auth requests', () => {
    assert.doesNotMatch(signin, /loginMethod === "password"/);
    assert.doesNotMatch(signin, /setLoginMethod\("password"\)/);
    assert.match(signin, /setLoginMethod\("email"\)/);
    assert.match(signin, /setLoginMethod\("mobile"\)/);
    assert.match(signin, /emailOtpRequestLockRef/);
    assert.match(signin, /mobileOtpRequestLockRef/);
    assert.match(signin, /if \(busy \|\| submitLockRef\.current\) return/);
    assert.match(signin, /finally\s*\{\s*emailOtpVerifyLockRef\.current = false/);
  });

  it('does not make a second profile request after signin', () => {
    const loginBlock = auth.slice(auth.indexOf('const login = useCallback'), auth.indexOf('const loginMobile = useCallback'));
    assert.match(loginBlock, /\/auth\/login/);
    assert.doesNotMatch(loginBlock, /\/auth\/me/);
  });
});
