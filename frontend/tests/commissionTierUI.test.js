import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Declining Commission Tier Policy UI & Frontend Logic Test Suite
 *
 * Policy Specification:
 * - Order eligible product subtotal <= ₹50,000: 8% commission (Tier 1)
 * - Order eligible product subtotal > ₹50,000 and <= ₹2,00,000: 6% commission (Tier 2)
 * - Order eligible product subtotal > ₹2,00,000: 4% commission (Tier 3)
 *
 * Rules:
 * - Single rate applied to entire eligible product subtotal (subtotal - discount).
 * - Excludes shipping charges and taxes from commission base.
 * - Rounding: Half-up to 2 decimal places (paise precision).
 */

// Frontend mirror / client-side simulator function for commission tier calculation
function calculateClientTierCommission(eligibleSubtotal, policy = null) {
  const p = policy || {
    tier1Max: 50000,
    tier1Rate: 8.0,
    tier2Max: 200000,
    tier2Rate: 6.0,
    tier3Rate: 4.0,
  };

  const amount = Number(eligibleSubtotal) || 0;
  if (amount <= 0) {
    return { tier: 1, rate: p.tier1Rate, fee: 0, eligibleSubtotal: 0 };
  }

  let rate = p.tier1Rate;
  let tier = 1;

  if (amount <= p.tier1Max) {
    rate = p.tier1Rate;
    tier = 1;
  } else if (amount <= p.tier2Max) {
    rate = p.tier2Rate;
    tier = 2;
  } else {
    rate = p.tier3Rate;
    tier = 3;
  }

  // Safe decimal half-up rounding to 2 decimal places
  const fee = Math.round((amount * (rate / 100) + Number.EPSILON) * 100) / 100;

  return {
    tier,
    rate,
    fee,
    eligibleSubtotal: amount,
  };
}

// Validation function for Super Admin Commission Setting Form
function validateCommissionSettingsForm({ tier1Max, tier1Rate, tier2Max, tier2Rate, tier3Rate, reason }) {
  const errors = [];

  const t1Max = Number(tier1Max);
  const t2Max = Number(tier2Max);
  const r1 = Number(tier1Rate);
  const r2 = Number(tier2Rate);
  const r3 = Number(tier3Rate);

  if (isNaN(t1Max) || t1Max <= 0) {
    errors.push('Tier 1 maximum threshold must be greater than 0');
  }
  if (isNaN(t2Max) || t2Max <= t1Max) {
    errors.push('Tier 2 maximum threshold must be strictly greater than Tier 1 threshold');
  }

  [
    { name: 'Tier 1', val: r1 },
    { name: 'Tier 2', val: r2 },
    { name: 'Tier 3', val: r3 },
  ].forEach((item) => {
    if (isNaN(item.val) || item.val < 0 || item.val > 100) {
      errors.push(`${item.name} commission rate must be between 0% and 100%`);
    }
  });

  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    errors.push('A valid reason for change (at least 5 characters) is required for audit compliance');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Supplier Net Settlement Calculation
function calculateSupplierNetPayable(order) {
  const gross = Number(order.totalAmount || order.total || 0);
  const commission = Number(order.commissionFee || 0);
  const refunded = Number(order.refundAmount || 0);
  return Math.max(0, Math.round((gross - commission - refunded + Number.EPSILON) * 100) / 100);
}

// Buyer Checkout Payable Calculation
function calculateBuyerCheckoutPayable(cart) {
  const subtotal = Number(cart.subtotal || 0);
  const discount = Number(cart.discount || 0);
  const shipping = Number(cart.shippingFee || 0);
  const tax = Number(cart.taxAmount || 0);

  const eligibleBase = Math.max(0, subtotal - discount);
  const totalBuyerPayable = Math.max(0, eligibleBase + shipping + tax);

  return {
    eligibleBase,
    totalBuyerPayable,
  };
}

describe('Declining Commission Tier Frontend & UI Verification Suite', () => {
  describe('1. Commission Tier Calculation & Exact Boundary Tests', () => {
    it('applies Tier 1 (8%) for orders <= ₹50,000', () => {
      const calc1 = calculateClientTierCommission(40000);
      assert.equal(calc1.tier, 1);
      assert.equal(calc1.rate, 8.0);
      assert.equal(calc1.fee, 3200);

      const boundary50k = calculateClientTierCommission(50000);
      assert.equal(boundary50k.tier, 1);
      assert.equal(boundary50k.rate, 8.0);
      assert.equal(boundary50k.fee, 4000);
    });

    it('applies Tier 2 (6%) for orders > ₹50,000 and <= ₹2,00,000', () => {
      const boundary50k1 = calculateClientTierCommission(50001);
      assert.equal(boundary50k1.tier, 2);
      assert.equal(boundary50k1.rate, 6.0);
      assert.equal(boundary50k1.fee, 3000.06);

      const calc100k = calculateClientTierCommission(100000);
      assert.equal(calc100k.tier, 2);
      assert.equal(calc100k.rate, 6.0);
      assert.equal(calc100k.fee, 6000);

      const boundary200k = calculateClientTierCommission(200000);
      assert.equal(boundary200k.tier, 2);
      assert.equal(boundary200k.rate, 6.0);
      assert.equal(boundary200k.fee, 12000);
    });

    it('applies Tier 3 (4%) for orders > ₹2,00,000', () => {
      const boundary200k1 = calculateClientTierCommission(200001);
      assert.equal(boundary200k1.tier, 3);
      assert.equal(boundary200k1.rate, 4.0);
      assert.equal(boundary200k1.fee, 8000.04);

      const calc250k = calculateClientTierCommission(250000);
      assert.equal(calc250k.tier, 3);
      assert.equal(calc250k.rate, 4.0);
      assert.equal(calc250k.fee, 10000);
    });
  });

  describe('2. Order-Level Single Rate Invariant (No Marginal Slabs)', () => {
    it('applies a single rate across the entire eligible subtotal, avoiding progressive slabs', () => {
      const subtotal = 250000;
      const res = calculateClientTierCommission(subtotal);

      // Single rate at 4%: 250,000 * 0.04 = ₹10,000
      assert.equal(res.fee, 10000);

      // Verify that it is NOT calculated with progressive marginal slabs:
      // (50,000 * 8% = 4,000) + (150,000 * 6% = 9,000) + (50,000 * 4% = 2,000) = ₹15,000
      const progressiveSlabFee = 50000 * 0.08 + 150000 * 0.06 + 50000 * 0.04;
      assert.notEqual(res.fee, progressiveSlabFee);
      assert.equal(res.fee, 10000);
    });
  });

  describe('3. Commission Base Definition & Buyer Exclusions', () => {
    it('calculates commission strictly on (subtotal - discount) and excludes shipping and tax', () => {
      const cart = {
        subtotal: 100000,
        discount: 10000,
        shippingFee: 5000,
        taxAmount: 16200,
      };

      const { eligibleBase, totalBuyerPayable } = calculateBuyerCheckoutPayable(cart);

      // Eligible base = 100,000 - 10,000 = ₹90,000
      assert.equal(eligibleBase, 90000);

      // Buyer pays = 90,000 + 5,000 (shipping) + 16,200 (tax) = ₹1,11,200
      assert.equal(totalBuyerPayable, 111200);

      // Commission is evaluated strictly on ₹90,000 (Tier 2, 6%) = ₹5,400
      const comm = calculateClientTierCommission(eligibleBase);
      assert.equal(comm.rate, 6.0);
      assert.equal(comm.fee, 5400);

      // Verify that shipping and tax are never in the commission calculation base
      const badBaseWithShippingAndTax = totalBuyerPayable;
      const badComm = calculateClientTierCommission(badBaseWithShippingAndTax);
      assert.notEqual(comm.fee, badComm.fee);
    });
  });

  describe('4. Super Admin Tier Policy Form Validation & Audit Requirement', () => {
    it('accepts valid tiered configuration with non-overlapping bounds and audit reason', () => {
      const validForm = {
        tier1Max: 50000,
        tier1Rate: 8.0,
        tier2Max: 200000,
        tier2Rate: 6.0,
        tier3Rate: 4.0,
        reason: 'Q4 2026 Festive promotional commission adjustment approved by CFO',
      };

      const result = validateCommissionSettingsForm(validForm);
      assert.equal(result.isValid, true);
      assert.equal(result.errors.length, 0);
    });

    it('rejects inverted or overlapping thresholds (Tier 2 <= Tier 1)', () => {
      const invalidOverlap = {
        tier1Max: 100000,
        tier1Rate: 8.0,
        tier2Max: 80000, // Invalid: less than Tier 1
        tier2Rate: 6.0,
        tier3Rate: 4.0,
        reason: 'Attempting invalid threshold inversion',
      };

      const result = validateCommissionSettingsForm(invalidOverlap);
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('strictly greater than Tier 1')));
    });

    it('rejects invalid commission rates (negative or > 100%)', () => {
      const invalidRates = {
        tier1Max: 50000,
        tier1Rate: -5, // Invalid: negative
        tier2Max: 200000,
        tier2Rate: 120, // Invalid: > 100%
        tier3Rate: 4.0,
        reason: 'Testing boundary rejection',
      };

      const result = validateCommissionSettingsForm(invalidRates);
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('Tier 1 commission rate')));
      assert.ok(result.errors.some((e) => e.includes('Tier 2 commission rate')));
    });

    it('mandates audit reason for Super Admin changes to ensure compliance', () => {
      const missingReason = {
        tier1Max: 50000,
        tier1Rate: 8.0,
        tier2Max: 200000,
        tier2Rate: 6.0,
        tier3Rate: 4.0,
        reason: '', // Missing
      };

      const result = validateCommissionSettingsForm(missingReason);
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('valid reason')));
    });
  });

  describe('5. Supplier Financial Isolation & Escrow vs Settled Display', () => {
    it('computes supplier estimated net payable after commission deduction and partial refund', () => {
      const order = {
        totalAmount: 118000, // Product subtotal ₹100,000 + GST ₹18,000
        commissionFee: 6000, // 6% of ₹100,000
        refundAmount: 0,
      };

      const net = calculateSupplierNetPayable(order);
      // Net payable = 118,000 - 6,000 = ₹112,000
      assert.equal(net, 112000);

      // If buyer returned ₹20,000 of goods:
      const refundedOrder = {
        ...order,
        refundAmount: 20000,
      };
      const refundedNet = calculateSupplierNetPayable(refundedOrder);
      // Net payable = 118,000 - 6,000 - 20,000 = ₹92,000
      assert.equal(refundedNet, 92000);
    });

    it('clearly differentiates Escrow Held funds from Transferred / Settled payouts', () => {
      const transactions = [
        { id: 'TX-1', status: 'CONFIRMED', escrowStatus: 'HELD_IN_ESCROW', netAmount: 46000 },
        { id: 'TX-2', status: 'SHIPPED', escrowStatus: 'HELD_IN_ESCROW', netAmount: 94000 },
        { id: 'TX-3', status: 'DELIVERED', escrowStatus: 'SETTLED', netAmount: 240000 },
      ];

      const escrowHeldTotal = transactions
        .filter((t) => t.escrowStatus === 'HELD_IN_ESCROW')
        .reduce((sum, t) => sum + t.netAmount, 0);

      const settledTotal = transactions
        .filter((t) => t.escrowStatus === 'SETTLED')
        .reduce((sum, t) => sum + t.netAmount, 0);

      assert.equal(escrowHeldTotal, 140000); // 46,000 + 94,000
      assert.equal(settledTotal, 240000);
    });
  });
});

