import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { listingSupplier } from '../../src/services/productService.js';

describe('Supplier details sent with listed products', () => {
  const base = { id: 'u1', name: 'Asha', company: 'ABC Electronics', city: 'Pune', country: 'India', isVerified: true, kycStatus: 'VERIFIED' };

  it('marks a supplier verified only when KYC was approved', () => {
    assert.equal(listingSupplier(base).isVerified, true);
    for (const kycStatus of ['PENDING', 'REJECTED', 'NOT_SUBMITTED', 'RESUBMISSION_REQUESTED', null]) {
      // isVerified on a user is a confirmed email address, not a verified business
      assert.equal(listingSupplier({ ...base, kycStatus, isVerified: true }).isVerified, false, String(kycStatus));
    }
  });

  it('never assumes a country or city', () => {
    const s = listingSupplier({ ...base, country: null, city: '' });
    assert.equal(s.country, null);
    assert.equal(s.city, null);
  });

  it('returns null without a supplier record, and never exposes private fields', () => {
    assert.equal(listingSupplier(null), null);
    const s = listingSupplier({ ...base, email: 'a@b.c', phone: '9', passwordHash: 'x' });
    assert.deepEqual(Object.keys(s).sort(), ['city', 'company', 'country', 'id', 'isVerified', 'kycStatus', 'name']);
  });
});
