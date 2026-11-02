import { normalizeMobile, validateVerifiedMobile } from '../src/services/otpService.js';
import { registerUser } from '../src/services/authService.js';
import dotenv from 'dotenv';
dotenv.config();

console.log('========================================================');
console.log(' TradeSphere - Mobile OTP Verification Integrity Test');
console.log('========================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(description, condition) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${description}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${description}`);
  }
}

// 1. Phone Number Normalization Tests
console.log('1. Phone Number Normalization Tests:');
try {
  const normIndia1 = normalizeMobile('9876543210', 'India');
  assert('Normalizes 10-digit India number to MSG91 format (919876543210)', normIndia1.ok && normIndia1.msg91Mobile === '919876543210');

  const normIndia2 = normalizeMobile('+91 98765 43210', 'India');
  assert('Strips spaces, handles +91 prefix for India', normIndia2.ok && normIndia2.msg91Mobile === '919876543210');

  const normIndia3 = normalizeMobile('09876543210', 'India');
  assert('Strips leading zero for India number', normIndia3.ok && normIndia3.msg91Mobile === '919876543210');

  const normUS = normalizeMobile('(212) 555-0147', 'United States');
  assert('Normalizes US number with area code to 12125550147', normUS.ok && normUS.msg91Mobile === '12125550147');

  const normUAE = normalizeMobile('501234567', 'United Arab Emirates');
  assert('Normalizes UAE number to 971501234567', normUAE.ok && normUAE.msg91Mobile === '971501234567');
} catch (err) {
  assert(`Normalization should not throw for valid inputs: ${err.message}`, false);
}

// 2. Invalid Phone Number Rejection Tests
console.log('\n2. Invalid Phone Number Rejections:');
const shortIndia = normalizeMobile('123', 'India');
assert('Correctly flags short phone number as not ok', !shortIndia.ok);

const alphaIndia = normalizeMobile('9876543210abc', 'India');
assert('Correctly flags non-numeric phone number as not ok', !alphaIndia.ok);

const emptyPhone = normalizeMobile('', 'India');
assert('Correctly flags empty phone number as not ok', !emptyPhone.ok);

const invalidStartingDigit = normalizeMobile('2876543210', 'India');
assert('Correctly flags India number not starting with 6-9 as not ok', !invalidStartingDigit.ok);

// 3. SMS Configuration Check
console.log('\n3. SMS Gateway Configuration Check:');
const authKeyConfigured = Boolean(process.env.SMS_AUTH_KEY || process.env.MSG91_AUTH_KEY);
const templateIdConfigured = Boolean(process.env.SMS_TEMPLATE_ID || process.env.MSG91_TEMPLATE_ID);
console.log(`  * SMS Auth Key configured: ${authKeyConfigured ? 'Yes' : 'No'}`);
console.log(`  * SMS Template ID configured: ${templateIdConfigured ? 'Yes' : 'No'}`);
assert('SMS authentication key is present in environment', authKeyConfigured);
assert('SMS template ID is present in environment', templateIdConfigured);

// 4. Admin Registration Protection
console.log('\n4. Admin Registration Protection:');
let adminBlocked = false;
try {
  await registerUser({
    name: 'Hacker',
    email: 'hacker@test.com',
    password: 'password123',
    role: 'ADMIN',
    phone: '+91 9876543210',
    companyName: 'Evil Corp',
    verificationToken: 'dummy'
  });
} catch (err) {
  if (err.statusCode === 400 && err.message.includes('Only Buyer and Supplier accounts can be created')) {
    adminBlocked = true;
  }
}
assert('Strictly prohibits ADMIN role registration via public signup', adminBlocked);

// 5. Unverified Mobile Number Protection
console.log('\n5. Unverified Mobile Number Protection:');
let tokenCheckPassed = false;
try {
  await validateVerifiedMobile({
    phone: '+91 9876543210',
    country: 'India',
    verificationToken: ''
  });
} catch (err) {
  if (err.statusCode === 400 && err.message.includes('verification token is required')) {
    tokenCheckPassed = true;
  }
}
assert('Rejects verification when verification token is missing or empty', tokenCheckPassed);

console.log('\n========================================================');
console.log(` Test Summary: ${passedTests}/${totalTests} Passed`);
console.log('========================================================\n');
process.exit(passedTests === totalTests ? 0 : 1);
