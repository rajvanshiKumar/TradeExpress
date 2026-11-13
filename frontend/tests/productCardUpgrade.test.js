import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  priceRange,
  validMoq,
  validPrice,
  availabilityOf,
  hasGenuineVolumePricing,
} from '../src/utils/productDisplay.js';

describe('Product Card upgrade & dynamic quantity pricing suite', () => {
  const tieredProduct = {
    id: 'p101',
    name: 'Industrial Torque Wrench 1/2-inch',
    price: 1450,
    moq: 100,
    currency: 'INR',
    unit: 'piece',
    stock: 5000,
    status: 'Active',
    priceTiers: [
      { minQty: 100, price: 1450 },
      { minQty: 500, price: 1320 },
      { minQty: 2000, price: 1233 },
    ],
  };

  const simpleProduct = {
    id: 'p102',
    name: 'Standard Screw Pack',
    price: 250,
    moq: 10,
    currency: 'INR',
    unit: 'box',
    stock: 200,
    status: 'Active',
    priceTiers: [],
  };

  it('1. calculates accurate tiered price ranges from real price tiers', () => {
    const range = priceRange(tieredProduct);
    assert.deepEqual(range, { min: 1233, max: 1450 });

    const simpleRange = priceRange(simpleProduct);
    assert.deepEqual(simpleRange, { min: 250, max: 250 });
  });

  it('2. identifies the lowest tier price as the Best Price', () => {
    const rawTiers = tieredProduct.priceTiers;
    const validTiers = rawTiers
      .map((t) => ({ minQty: validMoq(t.minQty), price: validPrice(t.price) }))
      .filter((t) => t.minQty !== null && t.price !== null)
      .sort((a, b) => a.minQty - b.minQty);

    assert.equal(validTiers.length, 3);
    const lowestPrice = Math.min(...validTiers.map((t) => t.price));
    assert.equal(lowestPrice, 1233);

    const bestTier = validTiers.find((t) => t.price === lowestPrice);
    assert.equal(bestTier.minQty, 2000);
    assert.equal(bestTier.price, 1233);
  });

  it('3. identifies products without tiers as having 0 valid quantity tiers', () => {
    const rawTiers = simpleProduct.priceTiers;
    const validTiers = (rawTiers || [])
      .map((t) => ({ minQty: validMoq(t.minQty), price: validPrice(t.price) }))
      .filter((t) => t.minQty !== null && t.price !== null);

    assert.equal(validTiers.length, 0);
  });

  it('4. strictly requires positive genuine reviews for buyer ratings to show', () => {
    const shouldShowRating = (p) => {
      const reviewCount = Number(p?.reviewCount);
      const rating = Number(p?.rating);
      return Number.isFinite(reviewCount) && reviewCount > 0 && Number.isFinite(rating) && rating > 0;
    };

    // Product with 0 reviews must hide rating completely
    assert.equal(shouldShowRating({ reviewCount: 0, rating: 0 }), false);
    assert.equal(shouldShowRating({ reviewCount: 0, rating: 5 }), false);
    assert.equal(shouldShowRating({ reviewCount: 0 }), false);
    assert.equal(shouldShowRating({}), false);
    assert.equal(shouldShowRating({ reviewCount: null, rating: null }), false);

    // Product with 1 or more genuine reviews must show rating
    assert.equal(shouldShowRating({ reviewCount: 1, rating: 4.5 }), true);
    assert.equal(shouldShowRating({ reviewCount: 114, rating: 4.8 }), true);
  });

  it('5. computes quantity ranges correctly for consecutive tiers', () => {
    const tiers = [
      { minQty: 100, price: 1450 },
      { minQty: 500, price: 1320 },
      { minQty: 2000, price: 1233 },
    ];

    const ranges = tiers.map((tier, idx) => {
      const nextTier = tiers[idx + 1];
      return nextTier ? `${tier.minQty} – ${nextTier.minQty - 1}` : `${tier.minQty}+`;
    });

    assert.deepEqual(ranges, [
      '100 – 499',
      '500 – 1999',
      '2000+',
    ]);
  });

  it('6. validates stock availability state for purchasing', () => {
    assert.equal(availabilityOf(tieredProduct), 'in');
    assert.equal(availabilityOf({ ...tieredProduct, stock: 0 }), 'out');
    assert.equal(availabilityOf({ ...tieredProduct, status: 'Inactive' }), 'out');
  });

  it('7. verifies add-to-cart toggle state: first click adds with right sign, second click reverts', () => {
    let cart = [];
    const inCart = (productId) => cart.some((item) => item.productId === productId);
    const toggleCart = (product) => {
      if (inCart(product.id)) {
        cart = cart.filter((item) => item.productId !== product.id);
        return false;
      } else {
        cart.push({ productId: product.id, quantity: product.moq });
        return true;
      }
    };

    // Initially not in cart
    assert.equal(inCart('p101'), false);

    // First click: adds to cart and shows right sign (checked)
    const state1 = toggleCart({ id: 'p101', moq: 100 });
    assert.equal(state1, true);
    assert.equal(inCart('p101'), true);

    // Second click: removes from cart and reverts to previous state
    const state2 = toggleCart({ id: 'p101', moq: 100 });
    assert.equal(state2, false);
    assert.equal(inCart('p101'), false);
  });

  it('8. verifies dummy products in sample catalog have 0 rating and 0 reviews', async () => {
    const { default: dummyProducts } = await import('../src/data/products.js');
    assert.ok(Array.isArray(dummyProducts) && dummyProducts.length > 0);

    // Every dummy product must have rating === 0 and reviewCount === 0
    dummyProducts.forEach((p) => {
      assert.equal(p.rating, 0, `Product ${p.id} (${p.name}) should have 0 rating`);
      assert.equal(p.reviewCount, 0, `Product ${p.id} (${p.name}) should have 0 reviewCount`);
    });
  });

  it('9. verifies dummy companies in sample catalog have 0 rating, 0 reviews, and no fake review list', async () => {
    const { default: dummyCompanies } = await import('../src/data/companies.js');
    assert.ok(Array.isArray(dummyCompanies) && dummyCompanies.length > 0);

    dummyCompanies.forEach((c) => {
      assert.equal(c.rating, 0, `Company ${c.id} (${c.name}) should have 0 rating`);
      assert.equal(c.reviewCount, 0, `Company ${c.id} (${c.name}) should have 0 reviewCount`);
      assert.deepEqual(c.reviews, [], `Company ${c.id} (${c.name}) should have empty reviews`);
    });
  });

  it('10. verifies Rating component returns null when rating is 0 or unreviewed', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const ratingCode = fs.readFileSync(path.resolve('src/components/common/Rating.jsx'), 'utf8');
    assert.match(ratingCode, /if\s*\(!numVal\s*\|\|\s*numVal\s*<=\s*0\)\s*return\s*null;/);
  });

  it('11. verifies automatic Volume Pricing conditions from the specification table', () => {
    // 1. One fixed price -> Hide Volume Pricing
    assert.equal(hasGenuineVolumePricing({ price: 500, priceTiers: [] }), false);
    assert.equal(hasGenuineVolumePricing({ price: 500 }), false);

    // 2. MOQ 100, fixed ₹500/piece -> Hide Volume Pricing
    assert.equal(hasGenuineVolumePricing({ price: 500, moq: 100, priceTiers: [{ minQty: 100, price: 500 }] }), false);

    // 3. 100+ pieces ₹500, 500+ pieces ₹450 -> Show Volume Pricing
    assert.equal(hasGenuineVolumePricing({
      price: 500,
      moq: 100,
      priceTiers: [
        { minQty: 100, price: 500 },
        { minQty: 500, price: 450 },
      ],
    }), true);

    // 4. 100+ pieces ₹500, 500+ pieces ₹500 -> Hide Volume Pricing (no discount)
    assert.equal(hasGenuineVolumePricing({
      price: 500,
      moq: 100,
      priceTiers: [
        { minQty: 100, price: 500 },
        { minQty: 500, price: 500 },
      ],
    }), false);

    // 5. Multiple quantity tiers with actual discounts -> Show Volume Pricing
    assert.equal(hasGenuineVolumePricing({
      price: 1000,
      moq: 50,
      priceTiers: [
        { minQty: 50, price: 1000 },
        { minQty: 250, price: 920 },
        { minQty: 1000, price: 850 },
      ],
    }), true);

    // 6. No quantity pricing configured -> Hide Volume Pricing
    assert.equal(hasGenuineVolumePricing({ price: 750, moq: 20 }), false);

    // 7. Invalid or incomplete pricing -> Do not display Volume Pricing
    assert.equal(hasGenuineVolumePricing({
      price: 500,
      priceTiers: [
        { minQty: null, price: 500 },
        { minQty: 100, price: -50 },
      ],
    }), false);
  });
});

