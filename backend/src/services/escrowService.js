import prisma from '../config/db.js';
import { createNotification } from './notificationService.js';
import {
  calculateOrderCommission,
  getActiveCommissionPolicy,
  roundINR,
} from './commissionTierService.js';

/**
 * Calculates and initiates an escrow ledger entry for an order once payment is confirmed.
 */
export async function initiateEscrowForOrder(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: { product: true },
      },
      escrowLedger: true,
    },
  });

  if (!order) {
    const error = new Error(`Order ${orderId} not found.`);
    error.statusCode = 404;
    throw error;
  }

  // 1. Resolve or compute immutable order-level commission snapshot
  let commissionRate = order.commissionRate !== null && order.commissionRate !== undefined
    ? Number(order.commissionRate)
    : null;
  let commissionFee = order.commissionFee !== null && order.commissionFee !== undefined
    ? Number(order.commissionFee)
    : null;
  let eligibleSubtotal = order.commissionEligibleSubtotal !== null && order.commissionEligibleSubtotal !== undefined
    ? Number(order.commissionEligibleSubtotal)
    : null;
  let commissionPolicy = order.commissionPolicy || 'TIERED_V1';

  if (commissionRate === null || commissionFee === null || eligibleSubtotal === null) {
    const policy = await getActiveCommissionPolicy();
    const subtotal = Number(order.subtotal || 0);
    const discount = Number(order.discount || 0);
    const calc = calculateOrderCommission({ subtotal, discount, policy });

    eligibleSubtotal = calc.eligibleSubtotal;
    commissionRate = calc.commissionRate;
    commissionFee = calc.commissionFee;
    commissionPolicy = calc.policyVersion;

    // Persist immutable snapshot back on the order
    await prisma.order.update({
      where: { id: orderId },
      data: {
        commissionEligibleSubtotal: eligibleSubtotal,
        commissionRate,
        commissionFee,
        commissionPolicy,
        commissionCalculatedAt: new Date(),
      },
    });
  }

  const amountHeld = order.isPartialPayment && Number(order.advanceAmount) > 0
    ? roundINR(Number(order.advanceAmount))
    : roundINR(Number(order.total));

  // Payout amount = amount held minus server-calculated platform commission
  const payoutAmount = Math.max(0, roundINR(amountHeld - commissionFee));

  const ledger = await prisma.escrowLedger.upsert({
    where: { orderId },
    update: {
      amountHeld,
      commissionRate,
      commissionFee,
      payoutAmount,
    },
    create: {
      orderId,
      amountHeld,
      commissionRate,
      commissionFee,
      refundedCommission: 0,
      payoutAmount,
      status: 'HELD',
    },
  });

  return ledger;
}

/**
 * Releases escrow funds to supplier after inspection period or manual admin approval.
 */
export async function releaseEscrow(orderId, { adminNote = '' } = {}) {
  const ledger = await prisma.escrowLedger.findUnique({
    where: { orderId },
    include: {
      order: {
        include: {
          supplier: true,
          dispute: true,
        },
      },
    },
  });

  if (!ledger) {
    const error = new Error(`Escrow ledger not found for order ${orderId}.`);
    error.statusCode = 404;
    throw error;
  }

  if (ledger.status === 'RELEASED') {
    return ledger;
  }

  if (ledger.status === 'FROZEN_DISPUTED' || ledger.order?.dispute?.status === 'OPEN') {
    const error = new Error('Cannot release payout while an active buyer dispute is open.');
    error.statusCode = 400;
    throw error;
  }

  // Update Escrow status to RELEASED
  const updatedLedger = await prisma.escrowLedger.update({
    where: { orderId },
    data: {
      status: 'RELEASED',
      releasedAt: new Date(),
    },
  });

  // Create Supplier Payout record if supplier is linked
  const supplierId = ledger.order.supplierId;
  let payout = null;

  if (supplierId) {
    const reference = `PAY-TS-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    payout = await prisma.supplierPayout.create({
      data: {
        supplierId,
        amount: ledger.payoutAmount,
        commission: ledger.commissionFee,
        status: 'PROCESSED',
        reference,
        processedAt: new Date(),
      },
    });
  }

  if (ledger.order?.supplierId) {
    createNotification({
      userId: ledger.order.supplierId,
      title: `Escrow Released: ₹${Number(ledger.payoutAmount).toLocaleString('en-IN')}`,
      message: `Escrow payout of ₹${Number(ledger.payoutAmount).toLocaleString('en-IN')} for order #${ledger.order.orderNumber} has been released.`,
      type: 'PAYOUT',
      link: `/supplier/orders`,
    }).catch(() => {});
  }

  return {
    ledger: updatedLedger,
    payout,
    message: `Escrow payout of ₹${ledger.payoutAmount} released to supplier successfully.`,
  };
}

/**
 * Freezes escrow when buyer reports a dispute during inspection.
 */
export async function freezeEscrowForDispute(orderId) {
  const existing = await prisma.escrowLedger.findUnique({
    where: { orderId },
    include: { order: true },
  });
  if (!existing) {
    await initiateEscrowForOrder(orderId);
  }

  const updated = await prisma.escrowLedger.update({
    where: { orderId },
    data: { status: 'FROZEN_DISPUTED' },
    include: { order: true },
  });

  if (updated.order?.supplierId) {
    createNotification({
      userId: updated.order.supplierId,
      title: `Payout Frozen: Dispute Raised`,
      message: `A buyer dispute has been reported on order #${updated.order.orderNumber}. Escrow funds are frozen pending review.`,
      type: 'DISPUTE',
      link: `/supplier/orders`,
    }).catch(() => {});
  }

  return updated;
}

/**
 * Refunds escrow to buyer upon dispute resolution or cancellation.
 */
export async function refundEscrow(orderId, { refundAmount = null } = {}) {
  const ledger = await prisma.escrowLedger.findUnique({ where: { orderId } });
  if (!ledger) return null;

  const totalHeld = Number(ledger.amountHeld || 0);
  const commFee = Number(ledger.commissionFee || 0);
  const requested = refundAmount !== null ? Number(refundAmount) : totalHeld;
  const actualRefund = Math.min(totalHeld, Math.max(0, requested));
  const isFullRefund = actualRefund >= totalHeld;

  const refundRatio = totalHeld > 0 ? actualRefund / totalHeld : 1;
  const refundedCommission = isFullRefund ? commFee : roundINR(commFee * refundRatio);
  const remainingCommission = Math.max(0, roundINR(commFee - refundedCommission));
  const remainingHeld = Math.max(0, roundINR(totalHeld - actualRefund));
  const payoutAmount = Math.max(0, roundINR(remainingHeld - remainingCommission));

  return prisma.escrowLedger.update({
    where: { orderId },
    data: {
      status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      refundedCommission,
      payoutAmount,
      releasedAt: isFullRefund ? new Date() : ledger.releasedAt,
    },
  });
}

/**
 * Lists all escrow ledger entries with filters.
 */
export async function listEscrowLedgers({ status = '', supplierId = '' } = {}) {
  const where = {};
  if (status && status !== 'ALL') where.status = status;
  if (supplierId) where.order = { supplierId };

  const ledgers = await prisma.escrowLedger.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          buyerName: true,
          buyerCompany: true,
          buyerEmail: true,
          orderStatus: true,
          paymentStatus: true,
          total: true,
          isPartialPayment: true,
          advanceAmount: true,
          balanceDue: true,
          createdAt: true,
          supplier: {
            select: { id: true, name: true, company: true, email: true },
          },
          dispute: {
            select: { id: true, status: true, reason: true },
          },
        },
      },
    },
  });

  return ledgers.map((l) => ({
    ...l,
    amountHeld: Number(l.amountHeld),
    commissionRate: Number(l.commissionRate),
    commissionFee: Number(l.commissionFee),
    payoutAmount: Number(l.payoutAmount),
  }));
}

/**
 * Summarizes total platform escrow volume, commissions, and payouts.
 */
export async function getEscrowSummary() {
  const all = await prisma.escrowLedger.findMany();

  let totalHeld = 0;
  let totalReleased = 0;
  let totalCommission = 0;
  let totalRefunded = 0;

  for (const item of all) {
    const held = Number(item.amountHeld);
    const comm = Number(item.commissionFee);
    const payout = Number(item.payoutAmount);

    if (item.status === 'HELD' || item.status === 'FROZEN_DISPUTED') {
      totalHeld += held;
    } else if (item.status === 'RELEASED') {
      totalReleased += payout;
      totalCommission += comm;
    } else if (item.status === 'REFUNDED') {
      totalRefunded += held;
    }
  }

  return {
    totalHeld: Math.round(totalHeld * 100) / 100,
    totalReleased: Math.round(totalReleased * 100) / 100,
    totalCommission: Math.round(totalCommission * 100) / 100,
    totalRefunded: Math.round(totalRefunded * 100) / 100,
    ledgerCount: all.length,
  };
}
