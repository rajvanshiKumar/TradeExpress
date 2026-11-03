import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { maskEmail, maskIdentifier, maskPhone, memberIdFor } from '../../src/services/accountService.js';

describe('Account Settings masking and member ids', () => {
  it('masks email addresses but keeps the domain', () => {
    assert.equal(maskEmail('rajesh.kumar@example.com'), 'ra**********@example.com');
    assert.equal(maskEmail('ab@x.in'), 'a***@x.in');
    assert.equal(maskEmail(''), '');
  });

  it('shows only the last 4 digits of a phone number', () => {
    assert.equal(maskPhone('+91 9876543210'), '+91 ******3210');
    assert.equal(maskPhone('9876543210'), '******3210');
    assert.equal(maskPhone(null), '');
  });

  it('masks GSTIN and PAN, keeping only the first 2 and last 3 characters', () => {
    assert.equal(maskIdentifier('24ABCDE1234F1Z5'), '24**********1Z5');
    assert.equal(maskIdentifier('abcde1234f'), 'AB*****34F');
    assert.equal(maskIdentifier(''), '');
  });

  it('uses the supplier code as member id, and a stable id-derived code otherwise', () => {
    assert.equal(memberIdFor({ id: 'x', role: 'SUPPLIER', supplierCode: 'SUP-781040' }), 'SUP-781040');
    assert.equal(memberIdFor({ id: '216083d3-1111-2222-3333-444455556666', role: 'BUYER' }), 'TB-216083D3');
    assert.equal(memberIdFor({ id: 'abcdef12-0000', role: 'SUPER_ADMIN' }), 'TA-ABCDEF12');
  });
});
