import prisma from '../config/db.js';

/**
 * Standard TradeExpress Declining Commission Policy Defaults
 * - Tier 1: Subtotal <= ₹50,000      -> 8.0%
 * - Tier 2: ₹50,001 to ₹2,00,000      -> 6.0%
 * - Tier 3: Subtotal > ₹2,00,000     -> 4.0%
 * Base: Order eligible product subtotal after product discounts.
 * Strictly excludes shipping charges and taxes.
 */
export const DEFAULT_COMMISSION_POLICY = Object.freeze({
  policyVersion: 'TIERED_V1',
  threshold1: 50000,
  threshold2: 200000,
  rate1: 8.0,
  rate2: 6.0,
  rate3: 4.0,
  currency: 'INR',
});

/**
 * Safe currency arithmetic helper.
 * Rounds to 2 decimal places using half-up arithmetic to avoid floating-point errors.
 */
export function roundINR(amount) {
  const num = Number(amount);
  if (isNaN(num)) return 0;
  return Number((Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2));
}

/**
 * Retrieves the currently active declining commission policy from the database,
 * falling back to statutory defaults if unconfigured.
 */
export async function getActiveCommissionPolicy() {
  try {
    const record = await prisma.platformSetting.findUnique({
      where: { key: 'commission_tier_policy' },
    });

    if (record?.value && typeof record.value === 'object') {
      const val = record.value;
      const t1 = Number(val.threshold1);
      const t2 = Number(val.threshold2);
      const r1 = Number(val.rate1);
      const r2 = Number(val.rate2);
      const r3 = Number(val.rate3);

      if (!isNaN(t1) && !isNaN(t2) && !isNaN(r1) && !isNaN(r2) && !isNaN(r3) && t1 > 0 && t2 > t1) {
        return {
          policyVersion: val.policyVersion || 'TIERED_V1',
          threshold1: t1,
          threshold2: t2,
          rate1: r1,
          rate2: r2,
          rate3: r3,
          currency: 'INR',
          updatedAt: record.updatedAt,
          updatedBy: record.updatedBy,
        };
      }
    }
  } catch (err) {
    console.warn('[CommissionTierService] Failed to load policy setting from DB:', err.message);
  }

  return { ...DEFAULT_COMMISSION_POLICY };
}

/**
 * Calculates order commission using the declining tier formula.
 * Base = final eligible product subtotal after discounts (excluding taxes & shipping).
 * Order-level tier: ONE rate selected and applied to the entire eligible subtotal.
 *
 * @param {Object} params
 * @param {number|string} params.subtotal - Product subtotal
 * @param {number|string} [params.discount=0] - Product discount
 * @param {Object} [params.policy=null] - Optional override policy (defaults to active policy)
 * @returns {Object} Commission calculation breakdown snapshot
 */
export function calculateOrderCommission({ subtotal, discount = 0, policy = DEFAULT_COMMISSION_POLICY }) {
  const rawSubtotal = Number(subtotal || 0);
  const rawDiscount = Number(discount || 0);
  const activePolicy = policy || DEFAULT_COMMISSION_POLICY;

  // Final eligible product subtotal after discounts
  const eligibleSubtotal = roundINR(Math.max(0, rawSubtotal - rawDiscount));

  let commissionRate = Number(activePolicy.rate1);
  let tierIndex = 1;
  let tierLabel = `Tier 1 (≤ ₹${Number(activePolicy.threshold1).toLocaleString('en-IN')})`;

  const t1 = Number(activePolicy.threshold1);
  const t2 = Number(activePolicy.threshold2);

  if (eligibleSubtotal <= t1) {
    commissionRate = Number(activePolicy.rate1);
    tierIndex = 1;
    tierLabel = `Tier 1 (≤ ₹${t1.toLocaleString('en-IN')})`;
  } else if (eligibleSubtotal <= t2) {
    commissionRate = Number(activePolicy.rate2);
    tierIndex = 2;
    tierLabel = `Tier 2 (> ₹${t1.toLocaleString('en-IN')} & ≤ ₹${t2.toLocaleString('en-IN')})`;
  } else {
    commissionRate = Number(activePolicy.rate3);
    tierIndex = 3;
    tierLabel = `Tier 3 (> ₹${t2.toLocaleString('en-IN')})`;
  }

  const commissionFee = roundINR(eligibleSubtotal * (commissionRate / 100));

  return {
    eligibleSubtotal,
    commissionRate,
    commissionFee,
    tierIndex,
    tierLabel,
    policyVersion: activePolicy.policyVersion || 'TIERED_V1',
    currency: 'INR',
    calculatedAt: new Date(),
  };
}

/**
 * Updates the global declining commission tier settings with validation and audit logging.
 * Only Super Admins are authorized.
 */
export async function updateCommissionPolicy({
  threshold1,
  threshold2,
  rate1,
  rate2,
  rate3,
  reason = '',
  actor = null,
  req = null,
}) {
  const t1 = Number(threshold1);
  const t2 = Number(threshold2);
  const r1 = Number(rate1);
  const r2 = Number(rate2);
  const r3 = Number(rate3);

  // 1. Validation: Thresholds must be positive and non-overlapping
  if (isNaN(t1) || isNaN(t2) || t1 <= 0 || t2 <= t1) {
    const error = new Error('Invalid thresholds: Threshold 1 must be greater than 0 and strictly less than Threshold 2.');
    error.statusCode = 400;
    throw error;
  }

  // 2. Validation: Rates must be valid non-negative percentages
  if (isNaN(r1) || isNaN(r2) || isNaN(r3) || r1 < 0 || r1 > 100 || r2 < 0 || r2 > 100 || r3 < 0 || r3 > 100) {
    const error = new Error('Invalid commission rates: All tier rates must be numbers between 0% and 100%.');
    error.statusCode = 400;
    throw error;
  }

  const previousPolicy = await getActiveCommissionPolicy();

  const newPolicyValue = {
    policyVersion: `TIERED_${Date.now()}`,
    threshold1: t1,
    threshold2: t2,
    rate1: roundINR(r1),
    rate2: roundINR(r2),
    rate3: roundINR(r3),
    currency: 'INR',
    updatedAt: new Date().toISOString(),
    updatedBy: actor?.email || 'Super Admin',
  };

  // Upsert in platformSetting
  const setting = await prisma.platformSetting.upsert({
    where: { key: 'commission_tier_policy' },
    update: {
      value: newPolicyValue,
      description: 'TradeExpress declining order-level commission tier policy',
      category: 'POLICY',
      updatedBy: actor?.email || 'Super Admin',
    },
    create: {
      key: 'commission_tier_policy',
      value: newPolicyValue,
      description: 'TradeExpress declining order-level commission tier policy',
      category: 'POLICY',
      updatedBy: actor?.email || 'Super Admin',
    },
  });

  // Record immutable statutory audit trail
  try {
    await prisma.auditLog.create({
      data: {
        action: 'COMMISSION_TIER_UPDATE',
        resource: 'COMMISSION_POLICY',
        targetId: 'commission_tier_policy',
        actorId: actor?.id || null,
        actorEmail: actor?.email || 'superadmin@tradesphere.com',
        actorRole: actor?.role || 'SUPER_ADMIN',
        ipAddress: req?.ip || req?.socket?.remoteAddress || '127.0.0.1',
        userAgent: req?.headers?.['user-agent'] || null,
        details: {
          previousPolicy,
          newPolicy: newPolicyValue,
          reason: reason?.trim() || 'Super Admin commission policy adjustment',
        },
      },
    });
  } catch (auditErr) {
    console.warn('[CommissionTierService] Audit logging warning:', auditErr.message);
  }

  return {
    success: true,
    message: 'Declining commission tier policy updated and audited successfully.',
    policy: newPolicyValue,
  };
}

/**
 * Gathers aggregate platform commission metrics including gross eligible subtotal,
 * earned commission, pending escrow commission, settled commission, and reversed commission.
 */
export async function getCommissionMetrics({ startDate = null, endDate = null } = {}) {
  const whereOrder = {};
  if (startDate || endDate) {
    whereOrder.createdAt = {};
    if (startDate) whereOrder.createdAt.gte = new Date(startDate);
    if (endDate) whereOrder.createdAt.lte = new Date(endDate);
  }

  const [orders, escrowLedgers] = await Promise.all([
    prisma.order.findMany({
      where: {
        ...whereOrder,
        orderStatus: { notIn: ['CANCELLED'] },
      },
      select: {
        id: true,
        orderNumber: true,
        subtotal: true,
        discount: true,
        shippingFee: true,
        tax: true,
        total: true,
        paymentStatus: true,
        orderStatus: true,
        commissionEligibleSubtotal: true,
        commissionRate: true,
        commissionFee: true,
        commissionPolicy: true,
        commissionCalculatedAt: true,
        createdAt: true,
      },
    }),
    prisma.escrowLedger.findMany({
      where: whereOrder.createdAt ? { createdAt: whereOrder.createdAt } : {},
      select: {
        id: true,
        orderId: true,
        amountHeld: true,
        commissionFee: true,
        refundedCommission: true,
        payoutAmount: true,
        status: true,
        releasedAt: true,
      },
    }),
  ]);

  let grossEligibleSubtotal = 0;
  let totalCommissionEarned = 0;
  let pendingCommission = 0;
  let settledCommission = 0;
  let refundedCommission = 0;

  for (const o of orders) {
    const eligible = o.commissionEligibleSubtotal !== null && o.commissionEligibleSubtotal !== undefined
      ? Number(o.commissionEligibleSubtotal)
      : Math.max(0, Number(o.subtotal || 0) - Number(o.discount || 0));
    grossEligibleSubtotal += eligible;
  }

  for (const e of escrowLedgers) {
    const fee = Number(e.commissionFee || 0);
    const ref = Number(e.refundedCommission || 0);
    refundedCommission += ref;

    if (e.status === 'RELEASED') {
      settledCommission += Math.max(0, fee - ref);
      totalCommissionEarned += Math.max(0, fee - ref);
    } else if (e.status === 'HELD' || e.status === 'FROZEN_DISPUTED') {
      pendingCommission += fee;
    }
  }

  return {
    grossEligibleSubtotal: roundINR(grossEligibleSubtotal),
    totalCommissionEarned: roundINR(totalCommissionEarned),
    pendingCommission: roundINR(pendingCommission),
    settledCommission: roundINR(settledCommission),
    refundedCommission: roundINR(refundedCommission),
    ordersCount: orders.length,
    escrowRecordsCount: escrowLedgers.length,
  };
}

