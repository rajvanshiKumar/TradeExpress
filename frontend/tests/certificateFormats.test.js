import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isValidCertificateFormat, normalizeCertificateNumber } from '../src/utils/certificateFormats.js';
import { SUPPLIER_BUSINESS_TYPES } from '../src/utils/constants.js';

describe('Business certificate number formats', () => {
  it('has a rule for every non-GST business type in the dropdown', () => {
    for (const type of SUPPLIER_BUSINESS_TYPES.filter((t) => t !== 'GST Certificate')) {
      assert.equal(typeof isValidCertificateFormat(type, 'X'), 'boolean', type);
      assert.equal(isValidCertificateFormat(type, ''), false, `${type} rejects empty`);
    }
  });

  it('checks Udyam, Udyog Aadhaar and MSME numbers against their published formats', () => {
    assert.equal(isValidCertificateFormat('Udyam Certificate', 'UDYAM-GJ-01-1234567'), true);
    assert.equal(isValidCertificateFormat('Udyam Certificate', 'udyam-gj-01-1234567'), true);
    assert.equal(isValidCertificateFormat('Udyam Certificate', 'UDYAM-GJ-1-1234567'), false);
    assert.equal(isValidCertificateFormat('Udyog Aadhaar', 'GJ01A1234567'), true);
    assert.equal(isValidCertificateFormat('Udyog Aadhaar', 'GJ01A123456'), false);
    assert.equal(isValidCertificateFormat('MSME Certificate', 'UDYAM-MH-19-0001234'), true);
    assert.equal(isValidCertificateFormat('MSME Certificate', 'MH19A0001234'), true);
    assert.equal(isValidCertificateFormat('MSME Certificate', '12345'), false);
  });

  it('accepts reasonable BRN, Gumasta and other numbers and rejects junk', () => {
    assert.equal(isValidCertificateFormat('Gumasta Licence', '760/2019/12345'), true);
    assert.equal(isValidCertificateFormat('BRN Certificate', 'BRN-2020-55'), true);
    assert.equal(isValidCertificateFormat('Other', 'AB1'), false, 'too short');
    assert.equal(isValidCertificateFormat('Other', '-ABCD'), false, 'cannot start with a symbol');
  });

  it('keeps hyphens for Udyam numbers but strips them from GSTINs', () => {
    assert.equal(normalizeCertificateNumber('Udyam Certificate', 'udyam-gj-01-1234567'), 'UDYAM-GJ-01-1234567');
    assert.equal(normalizeCertificateNumber('GST Certificate', '24abc-de1234f1z5'), '24ABCDE1234F1Z5');
  });
});

describe('Supplier form: every certificate type has a Verify step', () => {
  const form = fs.readFileSync(path.resolve('src/components/forms/SupplierRegisterForm.jsx'), 'utf8');

  it('checks non-GST numbers after a 2 second delay and labels them "Valid format", not "Verified"', () => {
    assert.match(form, /certCheckTimer\.current = setTimeout\([\s\S]*?\}, 2000\);/);
    assert.match(form, /<span>Valid format<\/span>/);
  });

  it('blocks step 2 until the certificate number has been checked', () => {
    assert.match(form, /Please click “Verify” to check your certificate number before continuing\./);
  });
});
