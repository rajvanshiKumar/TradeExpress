import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(__dirname, '../src/components/account/AccountVerificationFlows.jsx'), 'utf8');

// Use the exact patterns the Change Phone Number form runs, so a lost backslash is caught
const literal = (re) => {
  const found = source.match(re);
  assert.ok(found, `pattern not found: ${re}`);
  return new RegExp(found[1], found[2]);
};
const mobileRule = literal(/if \(!\/(\^\[6-9\][^/]*)\/()\.test\(digits\)\)/);
const inputCleaner = literal(/onChange=\{\(e\) => setDigits\(e\.target\.value\.replace\(\/([^/]+)\/(g)/);
const currentCleaner = literal(/settings\.profile\.phone\.replace\(\/([^/]+)\/(g)/);

describe('Change Phone Number — new number validation', () => {
  it('accepts valid 10-digit Indian mobile numbers', () => {
    for (const number of ['9812345234', '6000000000', '7012345678', '8123456789']) {
      assert.ok(mobileRule.test(number), `${number} should be valid`);
    }
  });

  it('rejects numbers with a wrong length or starting digit', () => {
    for (const number of ['981234523', '98123452345', '5812345234', '0812345234', '', '9ddddddddd']) {
      assert.equal(mobileRule.test(number), false, `${number} should be invalid`);
    }
  });

  it('keeps only digits while typing (spaces, +, dashes removed)', () => {
    assert.equal('98123 45234'.replace(inputCleaner, ''), '9812345234');
    assert.equal('981-234-5234'.replace(inputCleaner, ''), '9812345234');
    assert.equal('Dd9812345234'.replace(inputCleaner, ''), '9812345234');
  });

  it('detects when the new number is the current one', () => {
    assert.ok('+91 98123 45234'.replace(currentCleaner, '').endsWith('9812345234'));
  });
});

describe('Change Phone Number — SMS code expiry (5 minutes)', () => {
  const accountApi = fs.readFileSync(path.join(__dirname, '../src/services/accountApi.js'), 'utf8');

  it('asks the server for the account-settings expiry', () => {
    assert.match(accountApi, /sendPhoneCode = \(phone\) => authorizedRequest\('POST', 'auth\/send-mobile-otp', \{[^}]*purpose: 'PHONE_CHANGE'/);
  });

  it('shows the expiry the server returns (5 minutes), not a hardcoded 10 minutes', () => {
    assert.match(source, /expiresInSeconds: result\?\.expiresInSeconds \|\| 300/);
    assert.doesNotMatch(source, /expiresInSeconds: 600/);
  });
});
