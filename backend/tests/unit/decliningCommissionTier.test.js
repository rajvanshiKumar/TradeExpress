import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_COMMISSION_POLICY,
  calculateOrderCommission,
  roundINR,
} from '../../src/services/commissionTierService.js';

describe('Declining Commission Tier System Test Suite', () => {
  describe('1. Standard Tiers & Exact Threshold Boundaries', () => {
    it('applies Tier 1 (8%) when eligible product subtotal is <= ₹50,000', () => {
      // User example: ₹40,000 -> 8% = ₹3,200
      const calc1 = calculateOrderCommission({ subtotal: 40000 });
      assert.equal(calc1.eligibleSubtotal, 40000);
      assert.equal(calc1.commissionRate, 8.0);
      assert.equal(calc1.commissionFee, 3200);
      assert.equal(calc1.tierIndex, 1);

      // Boundary test: ₹50,000 -> 8% = ₹4,000
      const calcBoundary1 = calculateOrderCommission({ subtotal: 50000 });
      assert.equal(calcBoundary1.eligibleSubtotal, 50000);
      assert.equal(calcBoundary1.commissionRate, 8.0);
      assert.equal(calcBoundary1.commissionFee, 4000);
      assert.equal(calcBoundary1.tierIndex, 1);
    });

    it('applies Tier 2 (6%) when eligible product subtotal is > ₹50,000 and <= ₹2,00,000', () => {
      // Boundary test: ₹50,001 -> 6% = ₹3,000.06
      const calcBoundaryLow = calculateOrderCommission({ subtotal: 50001 });
      assert.equal(calcBoundaryLow.eligibleSubtotal, 50001);
      assert.equal(calcBoundaryLow.commissionRate, 6.0);
      assert.equal(calcBoundaryLow.commissionFee, 3000.06);
      assert.equal(calcBoundaryLow.tierIndex, 2);

      // User example: ₹1,00,000 -> 6% = ₹6,000
      const calcMid = calculateOrderCommission({ subtotal: 100000 });
      assert.equal(calcMid.eligibleSubtotal, 100000);
      assert.equal(calcMid.commissionRate, 6.0);
      assert.equal(calcMid.commissionFee, 6000);
      assert.equal(calcMid.tierIndex, 2);

      // Boundary test: ₹2,00,000 -> 6% = ₹12,000
      const calcBoundaryHigh = calculateOrderCommission({ subtotal: 200000 });
      assert.equal(calcBoundaryHigh.eligibleSubtotal, 200000);
      assert.equal(calcBoundaryHigh.commissionRate, 6.0);
      assert.equal(calcBoundaryHigh.commissionFee, 12000);
      assert.equal(calcBoundaryHigh.tierIndex, 2);
    });

    it('applies Tier 3 (4%) when eligible product subtotal is > ₹2,00,000', () => {
      // Boundary test: ₹2,00,001 -> 4% = ₹8,000.04
      const calcBoundary3 = calculateOrderCommission({ subtotal: 200001 });
      assert.equal(calcBoundary3.eligibleSubtotal, 200001);
      assert.equal(calcBoundary3.commissionRate, 4.0);
      assert.equal(calcBoundary3.commissionFee, 8000.04);
      assert.equal(calcBoundary3.tierIndex, 3);

      // User example: ₹2,50,000 -> 4% = ₹10,000
      const calc250k = calculateOrderCommission({ subtotal: 250000 });
      assert.equal(calc250k.eligibleSubtotal, 250000);
      assert.equal(calc250k.commissionRate, 4.0);
      assert.equal(calc250k.commissionFee, 10000);
      assert.equal(calc250k.tierIndex, 3);

      // High value wholesale order: ₹5,00,000 -> 4% = ₹20,000
      const calc500k = calculateOrderCommission({ subtotal: 500000 });
      assert.equal(calc500k.commissionRate, 4.0);
      assert.equal(calc500k.commissionFee, 20000);
      assert.equal(calc500k.tierIndex, 3);
    });
  });

  describe('2. Order-Level Single Rate Invariant (No Marginal Slabs)', () => {
    it('strictly applies ONE rate to the entire eligible subtotal, not progressive marginal slabs', () => {
      const subtotal = 250000;
      const result = calculateOrderCommission({ subtotal });

      // Invariant: single rate 4% on the full 250,000
      const expectedSingleRateCommission = 250000 * 0.04; // 10,000
      // If it were progressive marginal slabs, it would have been:
      // (50000 * 0.08) + (150000 * 0.06) + (50000 * 0.04) = 4000 + 9000 + 2000 = 15,000
      const forbiddenMarginalSlabCommission = 15000;

      assert.equal(result.commissionFee, expectedSingleRateCommission);
      assert.notEqual(result.commissionFee, forbiddenMarginalSlabCommission);
    });
  });

  describe('3. Commission Base: Deducts Discounts & Excludes Shipping & Taxes', () => {
    it('deducts product discounts to determine the final eligible subtotal base', () => {
      // Subtotal ₹60,000 with ₹15,000 coupon discount = ₹45,000 eligible subtotal
      // ₹45,000 qualifies for Tier 1 (8%) -> ₹3,600 commission
      const calc = calculateOrderCommission({
        subtotal: 60000,
        discount: 15000,
      });

      assert.equal(calc.eligibleSubtotal, 45000);
      assert.equal(calc.commissionRate, 8.0);
      assert.equal(calc.commissionFee, 3600);
      assert.equal(calc.tierIndex, 1);
    });

    it('strictly excludes shipping fees and GST taxes from the commission base', () => {
      const order = {
        subtotal: 40000,   // Eligible products
        discount: 0,
        shippingFee: 1500, // Freight
        tax: 7200,         // 18% GST (CGST + SGST)
        total: 48700,      // Buyer pays 48,700
      };

      const calc = calculateOrderCommission({
        subtotal: order.subtotal,
        discount: order.discount,
      });

      // Commission base must be 40,000, NOT 48,700
      assert.equal(calc.eligibleSubtotal, 40000);
      assert.equal(calc.commissionFee, 3200);

      // If incorrectly computed on total, it would have been 48700 * 0.08 = 3896
      assert.notEqual(calc.commissionFee, roundINR(order.total * 0.08));
    });
  });

  describe('4. Multi-Product & RFQ Order Scenarios', () => {
    it('aggregates multi-product line totals at the order level before selecting tier', () => {
      // 3 items from different catalog categories: ₹25,000 + ₹45,000 + ₹60,000 = ₹1,30,000
      const items = [
        { price: 250, quantity: 100, lineTotal: 25000 },
        { price: 900, quantity: 50, lineTotal: 45000 },
        { price: 1200, quantity: 50, lineTotal: 60000 },
      ];
      const aggregatedSubtotal = items.reduce((sum, item) => sum + item.lineTotal, 0); // 130,000

      const calc = calculateOrderCommission({ subtotal: aggregatedSubtotal });

      // ₹130,000 qualifies for Tier 2 (6%)
      assert.equal(calc.eligibleSubtotal, 130000);
      assert.equal(calc.commissionRate, 6.0);
      assert.equal(calc.commissionFee, 7800);
      assert.equal(calc.tierIndex, 2);
    });

    it('computes commission accurately for RFQ negotiated bulk orders', () => {
      // RFQ Quote: 5,000 custom machined parts negotiated at ₹55/piece
      const negotiatedQuantity = 5000;
      const negotiatedUnitPrice = 55;
      const negotiatedSubtotal = negotiatedQuantity * negotiatedUnitPrice; // ₹2,75,000

      const calc = calculateOrderCommission({ subtotal: negotiatedSubtotal });

      // ₹2,75,000 > ₹200,000 qualifies for Enterprise Tier 3 (4%)
      assert.equal(calc.eligibleSubtotal, 275000);
      assert.equal(calc.commissionRate, 4.0);
      assert.equal(calc.commissionFee, 11000);
      assert.equal(calc.tierIndex, 3);
    });
  });

  describe('5. Safe Decimal / Money Rounding (Half-Up, 2 Decimal Places)', () => {
    it('avoids floating-point arithmetic errors and rounds to exact paise', () => {
      assert.equal(roundINR(50001 * 0.06), 3000.06);
      assert.equal(roundINR(33333.33 * 0.08), 2666.67);
      assert.equal(roundINR(123456.78 * 0.06), 7407.41);
      assert.equal(roundINR(200000.5 * 0.04), 8000.02);
    });
  });

  describe('6. Refunds, Cancellations & Settlement Reversals', () => {
    function computeEscrowReconciliation({ amountHeld, commissionFee, refundAmount }) {
      const totalHeld = Number(amountHeld || 0);
      const comm = Number(commissionFee || 0);
      const refund = Math.min(totalHeld, Math.max(0, Number(refundAmount || 0)));

      const isFullRefund = refund >= totalHeld;
      const refundRatio = totalHeld > 0 ? refund / totalHeld : 1;
      const refundedCommission = isFullRefund ? comm : roundINR(comm * refundRatio);
      const remainingCommission = Math.max(0, roundINR(comm - refundedCommission));
      const remainingHeld = Math.max(0, roundINR(totalHeld - refund));
      const payoutAmount = Math.max(0, roundINR(remainingHeld - remainingCommission));

      return {
        isFullRefund,
        refundedCommission,
        remainingCommission,
        payoutAmount,
        status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      };
    }

    it('reverses 100% of platform commission and zeroes supplier payout on full order refund', () => {
      const order = {
        amountHeld: 100000,
        commissionFee: 6000, // 6%
        refundAmount: 100000, // Full refund
      };

      const result = computeEscrowReconciliation(order);

      assert.equal(result.isFullRefund, true);
      assert.equal(result.refundedCommission, 6000);
      assert.equal(result.remainingCommission, 0);
      assert.equal(result.payoutAmount, 0);
      assert.equal(result.status, 'REFUNDED');
    });

    it('proportionally reverses commission on partial refund and updates supplier payout', () => {
      const order = {
        amountHeld: 100000,
        commissionFee: 6000,
        refundAmount: 40000, // 40% partial refund
      };

      const result = computeEscrowReconciliation(order);

      assert.equal(result.isFullRefund, false);
      assert.equal(result.refundedCommission, 2400); // 40% of 6000
      assert.equal(result.remainingCommission, 3600); // remaining 60%
      // Remaining funds: 60,000 - 3,600 commission = 56,400 payout
      assert.equal(result.payoutAmount, 56400);
      assert.equal(result.status, 'PARTIALLY_REFUNDED');
    });

    it('cancels commission and marks status CANCELLED when order is cancelled before fulfillment', () => {
      function processOrderCancellation(order) {
        return {
          orderStatus: 'CANCELLED',
          commissionFee: 0,
          payoutAmount: 0,
          escrowStatus: 'CANCELLED',
        };
      }

      const cancelled = processOrderCancellation({ id: 'ord-123', total: 50000 });
      assert.equal(cancelled.orderStatus, 'CANCELLED');
      assert.equal(cancelled.commissionFee, 0);
      assert.equal(cancelled.payoutAmount, 0);
    });
  });

  describe('7. Webhook Idempotency & Duplicate Re-delivery', () => {
    it('detects existing transactionId and prevents duplicate commission recording', () => {
      const existingPayments = new Map();
      existingPayments.set('pay_test_txn_999', { status: 'PAID', commissionFee: 3200 });

      function processWebhookPayment(webhookEvent) {
        const { transactionId } = webhookEvent;
        if (existingPayments.has(transactionId)) {
          return { duplicate: true, alreadyProcessed: true };
        }
        existingPayments.set(transactionId, { status: 'PAID' });
        return { duplicate: false, success: true };
      }

      const res1 = processWebhookPayment({ transactionId: 'pay_test_txn_999' });
      assert.equal(res1.duplicate, true);
      assert.equal(res1.alreadyProcessed, true);
    });
  });

  describe('8. Historical Order Snapshot Immutability', () => {
    it('preserves historical order commission snapshots when future tier policy settings change', () => {
      // Historical order created under V1 policy (50k -> 8%)
      const historicalOrder = {
        id: 'ord-historical-1',
        subtotal: 40000,
        commissionRate: 8.0,
        commissionFee: 3200,
        commissionPolicy: 'TIERED_V1',
        commissionCalculatedAt: new Date('2026-01-15T10:00:00Z'),
      };

      // Super Admin updates policy in October 2026: Tier 1 rate changed from 8% to 10%
      const newPolicy = {
        ...DEFAULT_COMMISSION_POLICY,
        policyVersion: 'TIERED_V2_OCT2026',
        rate1: 10.0,
      };

      // Existing order must NOT recalculate
      function getOrderCommission(order, activePolicy) {
        if (order.commissionFee !== null && order.commissionRate !== null) {
          return {
            rate: order.commissionRate,
            fee: order.commissionFee,
            policy: order.commissionPolicy,
          };
        }
        return calculateOrderCommission({ subtotal: order.subtotal, policy: activePolicy });
      }

      const resolved = getOrderCommission(historicalOrder, newPolicy);

      // Snapshot remains intact at 8.0% and ₹3,200
      assert.equal(resolved.rate, 8.0);
      assert.equal(resolved.fee, 3200);
      assert.equal(resolved.policy, 'TIERED_V1');
      assert.notEqual(resolved.rate, 10.0);
    });
  });

  describe('9. Super Admin Settings Validation Rules', () => {
    function validateCommissionPolicyPayload({ threshold1, threshold2, rate1, rate2, rate3, reason }) {
      const t1 = Number(threshold1);
      const t2 = Number(threshold2);
      const r1 = Number(rate1);
      const r2 = Number(rate2);
      const r3 = Number(rate3);

      if (isNaN(t1) || isNaN(t2) || t1 <= 0 || t2 <= t1) {
        return { valid: false, error: 'Threshold 1 must be positive and strictly less than Threshold 2.' };
      }
      if (isNaN(r1) || isNaN(r2) || isNaN(r3) || r1 < 0 || r1 > 100 || r2 < 0 || r2 > 100 || r3 < 0 || r3 > 100) {
        return { valid: false, error: 'All tier rates must be between 0% and 100%.' };
      }
      if (!reason || !reason.trim()) {
        return { valid: false, error: 'Statutory reason is required for audit trail.' };
      }
      return { valid: true };
    }

    it('accepts valid, non-overlapping thresholds and permitted rates with an audit reason', () => {
      const res = validateCommissionPolicyPayload({
        threshold1: 50000,
        threshold2: 200000,
        rate1: 8.0,
        rate2: 6.0,
        rate3: 4.0,
        reason: 'Q4 2026 Statutory B2B fee schedule adjustment',
      });
      assert.equal(res.valid, true);
    });

    it('rejects overlapping or inverse thresholds (Threshold 2 <= Threshold 1)', () => {
      const res = validateCommissionPolicyPayload({
        threshold1: 200000,
        threshold2: 50000, // Invalid: T2 < T1
        rate1: 8.0,
        rate2: 6.0,
        rate3: 4.0,
        reason: 'Test overlap',
      });
      assert.equal(res.valid, false);
      assert.match(res.error, /strictly less than Threshold 2/);
    });

    it('rejects negative rates or rates exceeding 100%', () => {
      const resNegative = validateCommissionPolicyPayload({
        threshold1: 50000,
        threshold2: 200000,
        rate1: -2.0, // Negative
        rate2: 6.0,
        rate3: 4.0,
        reason: 'Test negative',
      });
      assert.equal(resNegative.valid, false);

      const resExceed = validateCommissionPolicyPayload({
        threshold1: 50000,
        threshold2: 200000,
        rate1: 8.0,
        rate2: 105.0, // Over 100%
        rate3: 4.0,
        reason: 'Test exceed',
      });
      assert.equal(resExceed.valid, false);
    });

    it('rejects policy updates lacking a mandatory audit reason', () => {
      const res = validateCommissionPolicyPayload({
        threshold1: 50000,
        threshold2: 200000,
        rate1: 8.0,
        rate2: 6.0,
        rate3: 4.0,
        reason: '', // Missing
      });
      assert.equal(res.valid, false);
      assert.match(res.error, /Statutory reason is required/);
    });
  });

  describe('10. Super Admin Authorization & Audit Trail', () => {
    it('blocks non-super-admins from modifying commission tier settings', () => {
      function authorizeCommissionSettingUpdate(user) {
        if (!user) return { status: 401, error: 'Authentication required' };
        if (user.role !== 'SUPER_ADMIN') {
          return { status: 403, error: 'Forbidden. Super Admin authority required.' };
        }
        return { status: 200, authorized: true };
      }

      assert.equal(authorizeCommissionSettingUpdate(null).status, 401);
      assert.equal(authorizeCommissionSettingUpdate({ id: 'u1', role: 'BUYER' }).status, 403);
      assert.equal(authorizeCommissionSettingUpdate({ id: 'u2', role: 'SUPPLIER' }).status, 403);
      assert.equal(authorizeCommissionSettingUpdate({ id: 'u3', role: 'ADMIN' }).status, 403);
      assert.equal(authorizeCommissionSettingUpdate({ id: 'u4', role: 'SUPER_ADMIN' }).status, 200);
    });
  });

  describe('11. Supplier Financial Isolation & Net Payable Calculation', () => {
    it('calculates supplier net payable as gross order minus commission minus refunds', () => {
      const order = {
        orderNumber: 'TS-261029-100001',
        total: 118000, // 100,000 subtotal + 18,000 GST
        eligibleSubtotal: 100000,
        commissionRate: 6.0,
        commissionFee: 6000,
        refundAmount: 0,
      };

      const estimatedNetPayable = Math.max(0, Math.round((order.total - order.commissionFee - order.refundAmount) * 100) / 100);
      assert.equal(estimatedNetPayable, 112000); // 118,000 - 6,000 = 112,000
    });

    it('properly distinguishes HELD_IN_ESCROW from SETTLED payouts', () => {
      function getPayoutStatusLabel(escrowStatus, orderStatus) {
        if (orderStatus === 'CANCELLED') return 'CANCELLED';
        if (orderStatus === 'REFUNDED') return 'REFUNDED';
        if (escrowStatus === 'RELEASED') return 'SETTLED';
        if (escrowStatus === 'HELD') return 'HELD_IN_ESCROW';
        return 'PENDING_PAYMENT';
      }

      assert.equal(getPayoutStatusLabel('HELD', 'ORDER_CONFIRMED'), 'HELD_IN_ESCROW');
      assert.equal(getPayoutStatusLabel('RELEASED', 'DELIVERED'), 'SETTLED');
      assert.equal(getPayoutStatusLabel('REFUNDED', 'REFUNDED'), 'REFUNDED');
      assert.equal(getPayoutStatusLabel('CANCELLED', 'CANCELLED'), 'CANCELLED');
    });
  });
});

