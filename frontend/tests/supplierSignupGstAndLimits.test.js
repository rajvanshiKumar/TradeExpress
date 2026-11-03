import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const supplierForm = fs.readFileSync(path.resolve('src/components/forms/SupplierRegisterForm.jsx'), 'utf8');
const loginForm = fs.readFileSync(path.resolve('src/components/forms/LoginForm.jsx'), 'utf8');

describe('Supplier signup: GSTIN must be verified for the exact GSTIN entered', () => {
  it('derives "verified" from the last check of the GSTIN currently in the box', () => {
    assert.match(supplierForm, /const gstResult = gstCheck && gstCheck\.gstin === normalizedTaxId \? gstCheck : null;/);
    assert.match(supplierForm, /const gstVerified = Boolean\(gstResult\?\.verified && gstResult\.verificationToken\);/);
    assert.doesNotMatch(supplierForm, /setGstVerified|gstVerificationData/, 'no separate verified flag that can go stale');
  });

  it('never marks a GSTIN verified without a server answer, and never sends the typed company name as the legal name', () => {
    assert.doesNotMatch(supplierForm, /Client-side fallback/);
    assert.doesNotMatch(supplierForm, /legalName: values\.companyName/);
    assert.match(supplierForm, /Never mark a GSTIN as verified without an answer from the server/);
  });

  it('blocks step 2 (and final submit) until the GSTIN is verified', () => {
    assert.match(supplierForm, /else if \(!gstVerified\) \{/);
    assert.match(supplierForm, /Please verify your GSTIN by clicking “Verify” before continuing\./);
  });

  it('sends the server-issued GST verification token with the signup', () => {
    assert.match(supplierForm, /gstVerificationToken: requiresGstVerification && gstVerified \? gstResult\.verificationToken : null/);
  });

  it('shows provider details only for a real verified GSTIN; test mode shows just the Verified badge', () => {
    assert.match(supplierForm, /\{gstVerified && values\.businessType === 'GST Certificate' && !gstResult\.testMode && gstResult\.legalName && \(/);
    assert.doesNotMatch(supplierForm, /\{gstResult\.message\}/, 'the TEST MODE message is not rendered');
  });

  it('verifies automatically once a complete GSTIN is entered, once per GSTIN', () => {
    assert.match(supplierForm, /const autoCheckedGstin = useRef\(''\);/);
    assert.match(supplierForm, /if \(autoCheckedGstin\.current === normalizedTaxId\) return undefined;/);
    assert.match(supplierForm, /autoCheckedGstin\.current = normalizedTaxId;\s*handleVerifyGstin\(\);/);
  });
});

describe('Number inputs stop at their limits', () => {
  it('supplier mobile stops at the country mobile length (10 for India)', () => {
    assert.match(supplierForm, /replace\(\/\\D\/g, ''\)\.slice\(0, mobileMaxDigits\)/);
    assert.match(supplierForm, /maxLength=\{mobileMaxDigits\}/);
  });

  it('office phone accepts digits only, at most 10, and must be exactly 10 when given', () => {
    assert.match(supplierForm, /field === 'businessPhone'\) \{\s*val = String\(val \|\| ''\)\.replace\(\/\\D\/g, ''\)\.slice\(0, 10\);/);
    assert.match(supplierForm, /Office phone number must be exactly 10 digits\./);
  });

  it('year established is chosen from real years only (1900 to this year)', () => {
    assert.match(supplierForm, /const YEAR_ESTABLISHED_MIN = 1900;/);
    assert.match(supplierForm, /options=\{YEAR_ESTABLISHED_OPTIONS\}/);
    assert.match(supplierForm, /Choose a year between \$\{YEAR_ESTABLISHED_MIN\} and \$\{curr\}\./);
  });

  it('login mobile stops at the country mobile length instead of 15 digits', () => {
    assert.match(loginForm, /\.slice\(0, mobileMaxDigits\)/);
    assert.match(loginForm, /maxLength=\{mobileMaxDigits\}/);
    assert.doesNotMatch(loginForm, /maxLength=\{15\}/);
  });
});
