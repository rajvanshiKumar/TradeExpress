import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('PAN-Aadhaar Frontend Validation & Linkage Rules', () => {
  it('validates 10-character PAN format correctly', () => {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    assert.equal(panRegex.test('ABCDE1234F'), true);
    assert.equal(panRegex.test('abcde1234f'.toUpperCase()), true);
    assert.equal(panRegex.test('12345ABCDE'), false);
    assert.equal(panRegex.test('ABCDE12345'), false);
    assert.equal(panRegex.test('ABCDE123'), false);
  });

  it('validates 12-digit Aadhaar number and extracts last 4 digits (data minimization)', () => {
    const rawAadhaar = '1234 5678 9012';
    const cleanDigits = rawAadhaar.replace(/\D/g, '');
    assert.equal(cleanDigits.length, 12);
    assert.equal(cleanDigits, '123456789012');

    const last4 = cleanDigits.slice(-4);
    assert.equal(last4, '9012');
  });

  it('formats masked PAN correctly for privacy compliance', () => {
    const cleanPan = 'ABCDE1234F';
    const maskedPan = `${cleanPan.slice(0, 2)}XXXXXX${cleanPan.slice(-2)}`;
    assert.equal(maskedPan, 'ABXXXXXX4F');
    assert.equal(maskedPan.length, 10);
  });

  it('determines link status progression from NOT_STARTED to LINKED', () => {
    let panAadhaarStatus = 'NOT_STARTED';
    let panAadhaarLinked = false;

    // Trigger verification
    panAadhaarStatus = 'PENDING';
    assert.equal(panAadhaarStatus, 'PENDING');

    // Successful response
    const mockApiResponse = {
      status: 'LINKED',
      linked: true,
      maskedPan: 'ABXXXXXX4F',
    };

    panAadhaarStatus = mockApiResponse.status;
    panAadhaarLinked = mockApiResponse.linked;

    assert.equal(panAadhaarStatus, 'LINKED');
    assert.equal(panAadhaarLinked, true);
    assert.equal(mockApiResponse.maskedPan, 'ABXXXXXX4F');
  });
});



