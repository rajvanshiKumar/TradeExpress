import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  availabilityOf, countryCodeFor, priceRange, productPhoto, productUnit, supplierOf, validMoq, validPrice,
} from '../src/utils/productDisplay.js';

const complete = {
  id: 'p1', name: 'Torque Wrench', slug: 'torque-wrench', supplierId: 'u1', companyId: 'c1', price: 1450, currency: 'INR',
  unit: 'piece', moq: 50, stock: 6100, status: 'Active', readyToShip: false, photo: 'photo-123',
  supplier: { company: 'Mumbai Industrial Solutions', country: 'India', kycStatus: 'VERIFIED' },
};

describe('Dynamic product card: what a card may show', () => {
  it('1. complete product: price, MOQ, unit, supplier, country and verified badge', () => {
    assert.deepEqual(priceRange(complete), { min: 1450, max: 1450 });
    assert.equal(validMoq(complete.moq), 50);
    assert.equal(productUnit(complete), 'piece');
    assert.equal(availabilityOf(complete), 'in');
    assert.deepEqual(supplierOf(complete), {
      name: 'Mumbai Industrial Solutions', slug: 'mumbai-industrial-solutions', country: 'India', countryCode: 'IN', verified: true,
    });
  });

  it('links a supplier without a profile record using the site slug rule', () => {
    assert.equal(supplierOf({ supplier: { company: 'Milan Living & Furniture' } }).slug, 'milan-living-and-furniture');
  });

  it('2 and 15. without an image, or only an uploaded image, the real photo is used and never a stand-in', () => {
    assert.equal(productPhoto({ ...complete, photo: null }), null);
    assert.equal(productPhoto({ ...complete, photo: '   ' }), null);
    assert.equal(productPhoto({ photo: '', images: [{ url: '/uploads/a.jpg' }, { url: '/uploads/b.jpg', isPrimary: true }] }), '/uploads/b.jpg');
    assert.equal(productPhoto({ images: [{ url: '' }] }), null);
  });

  it('3, 9 and 10. a missing, zero or invalid price is "Price on request", never 0', () => {
    for (const price of [null, undefined, '', 0, '0', -5, 'abc', Number.NaN, Infinity, true]) {
      assert.equal(validPrice(price), null, `price ${String(price)}`);
      assert.equal(priceRange({ ...complete, price, priceTiers: [] }), null, `range for ${String(price)}`);
    }
    assert.equal(validPrice('1450.00'), 1450, 'Prisma decimals arrive as strings');
  });

  it('uses quantity tiers when they have prices, ignoring broken tiers', () => {
    const tiers = [{ minQty: 50, price: 1450 }, { minQty: 200, price: 1334 }, { minQty: 500, price: null }, { minQty: 1000, price: 0 }];
    assert.deepEqual(priceRange({ ...complete, priceTiers: tiers }), { min: 1334, max: 1450 });
    assert.equal(priceRange({ price: null, priceTiers: [{ minQty: 1, price: 0 }] }), null);
  });

  it('4. a missing or invalid MOQ is "MOQ not specified"', () => {
    for (const moq of [null, undefined, '', 0, -1, 2.5, 'ten']) assert.equal(validMoq(moq), null, `moq ${String(moq)}`);
    assert.equal(validMoq('25'), 25);
    assert.equal(productUnit({ unit: '  ' }), null);
  });

  it('6. pending, rejected or unverified suppliers get no badge; a confirmed email alone is not verification', () => {
    for (const kycStatus of ['PENDING', 'REJECTED', 'NOT_SUBMITTED', 'RESUBMISSION_REQUESTED', undefined]) {
      assert.equal(supplierOf({ ...complete, supplier: { ...complete.supplier, kycStatus, isVerified: true } }).verified, false, String(kycStatus));
    }
    const profileOnly = supplierOf({ ...complete, supplier: null }, { name: 'Sample Co', slug: 'sample-co', country: 'China', verification: { status: 'reviewed' } });
    assert.equal(profileOnly.verified, false, 'only the real supplier KYC record can verify');
  });

  it('7. no supplier country means no country and no flag, never an assumed "India"', () => {
    const s = supplierOf({ ...complete, supplier: { company: 'ABC Electronics', country: null } });
    assert.equal(s.country, null);
    assert.equal(s.countryCode, null);
    assert.equal(countryCodeFor('United Kingdom'), 'GB');
    assert.equal(countryCodeFor('USA'), 'US');
    assert.equal(countryCodeFor('Atlantis'), null);
  });

  it('13 and 14. no supplier relationship, or an incomplete response, hides supplier details without failing', () => {
    assert.equal(supplierOf({ id: 'p2', name: 'Basic item' }), null);
    assert.equal(supplierOf({ supplier: { company: '  ' } }), null);
    assert.equal(supplierOf(undefined), null);
    assert.equal(priceRange(undefined), null);
    assert.equal(availabilityOf(undefined), null);
    assert.equal(productPhoto(undefined), null);
  });

  it('11. availability comes only from real stock figures', () => {
    assert.equal(availabilityOf({ ...complete, stock: 0 }), 'out');
    assert.equal(availabilityOf({ ...complete, stock: -3 }), 'out');
    assert.equal(availabilityOf({ ...complete, status: 'Inactive' }), 'out');
    assert.equal(availabilityOf({ ...complete, readyToShip: true }), 'ready');
    assert.equal(availabilityOf({ ...complete, stock: undefined, readyToShip: true }), null, 'no stock figure, no badge');
    assert.equal(availabilityOf({ ...complete, stock: 'n/a' }), null);
  });
});
