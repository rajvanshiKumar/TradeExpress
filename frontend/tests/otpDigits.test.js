import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { enterOtpDigits, isCompleteOtp, otpBoxProps, otpSlots, pastedOtp } from '../src/utils/otpDigits.js';

// Types a sequence of [boxIndex, keyValue] into the six boxes, starting from `start`
const type = (steps, start = '') => steps.reduce((code, [i, v]) => enterOtpDigits(code, i, v).value, start);

// The previous logic, kept here only to show the bug it caused
function oldEnter(current, index, value) {
  const cleaned = value.replace(/\D/g, '');
  const digits = Array(6).fill('').map((_, i) => current[i] || '');
  if (!cleaned) { digits[index] = ''; return digits.join(''); }
  digits[index] = cleaned[0];
  return digits.join('');
}

describe('Six-box OTP entry keeps every digit in its box', () => {
  // Genuine code 482913. The user types 483913, clears box 3 and types 2.
  const typo = [[0, '4'], [1, '8'], [2, '3'], [3, '9'], [4, '1'], [5, '3']];

  it('old logic: correcting a typo shifted later digits and produced a wrong code (the "Invalid OTP" bug)', () => {
    let code = typo.reduce((c, [i, v]) => oldEnter(c, i, v), '');
    code = oldEnter(code, 2, ''); // clear box 3
    assert.equal(code, '48913', 'digits after the cleared box moved one place left');
    code = oldEnter(code, 2, '2'); // retype box 3 (which now shows 9)
    code = oldEnter(code, 5, '3'); // fill the now-empty last box
    assert.notEqual(code, '482913');
  });

  it('new logic: the corrected code is exactly the genuine code', () => {
    let code = type(typo);
    code = enterOtpDigits(code, 2, '').value;
    assert.deepEqual(otpSlots(code), ['4', '8', '', '9', '1', '3'], 'the other boxes keep their digits');
    assert.equal(isCompleteOtp(code), false, 'cannot be sent while a box is empty');
    code = enterOtpDigits(code, 2, '2').value;
    assert.equal(code, '482913');
    assert.equal(isCompleteOtp(code), true);
  });

  it('a partly typed code is never complete; typing in order and pasting still work', () => {
    assert.equal(isCompleteOtp(type([[0, '1'], [1, '2'], [2, '3']])), false);
    assert.equal(type([[0, '1'], [1, '2'], [2, '3'], [3, '4'], [4, '5'], [5, '6']]), '123456');
    assert.equal(enterOtpDigits('', 0, '654321').value, '654321', 'autofill into the first box fills all six');
    assert.equal(pastedOtp(' 65-43 21 '), '654321');
    assert.equal(enterOtpDigits('12', 1, 'x').value, '1', 'non-digits are ignored (clears the box)');
  });

  it('moves focus to the next box, and stays on the last box', () => {
    assert.equal(enterOtpDigits('', 0, '7').focusIndex, 1);
    assert.equal(enterOtpDigits('12345', 5, '6').focusIndex, null);
    assert.equal(enterOtpDigits('123456', 3, '').focusIndex, null);
  });
});

describe('OTP boxes are never filled by the browser while another field is autofilled', () => {
  it('every box is a one-time-code box with its own name, apart from the other code on the page', () => {
    const mobile = [0, 1, 2, 3, 4, 5].map((i) => otpBoxProps('signup-mobile', i));
    const email = [0, 1, 2, 3, 4, 5].map((i) => otpBoxProps('signup-email', i));
    assert.ok([...mobile, ...email].every((p) => p.autoComplete === 'one-time-code'));
    const names = [...mobile, ...email].map((p) => p.name);
    assert.equal(new Set(names).size, 12, 'no two boxes share a name');
    assert.equal(mobile[0]['data-lpignore'], 'true', 'password managers leave the boxes alone');
  });

  it('every OTP box in the signup and login forms uses these attributes', async () => {
    const { readFileSync } = await import('node:fs');
    const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
    assert.ok(read('../src/components/common/SixDigitOtpRow.jsx').includes('otpBoxProps(group, index)'));
    const buyer = read('../src/components/forms/BuyerRegisterForm.jsx');
    for (const g of ['buyer-email', 'buyer-mobile', 'buyer-aadhaar']) assert.ok(buyer.includes(`otpBoxProps('${g}'`), g);
    const login = read('../src/components/forms/LoginForm.jsx');
    for (const g of ['login-email', 'login-mobile']) assert.ok(login.includes(`otpBoxProps("${g}"`), g);
    const supplier = read('../src/components/forms/SupplierRegisterForm.jsx');
    assert.ok(supplier.includes('readOnly={phoneOtpSent && !phoneVerified}'), 'the mobile number is locked while its code is open');
    assert.ok(supplier.includes('readOnly={emailOtpSent && !emailVerified}'), 'the email is locked while its code is open');
  });
});
