import prisma from '../config/db.js';
import { createNotification } from './notificationService.js';

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
    },
  });

  if (!order) {
    const error = new Error(`Order ${orderId} not found.`);
    error.statusCode = 404;
    throw error;
  }

  // Determine applicable commission rate
  let commissionRate = 5.0; // Global default

  // Check category override if products exist
  const firstCategory = order.items?.[0]?.product?.categorySlug;
  if (firstCategory) {
    const catSetting = await prisma.commissionSetting.findFirst({
      where: { type: 'CATEGORY', targetId: firstCategory },
    });
    if (catSetting) {
      commissionRate = Number(catSetting.percentage);
    } else {
      const globalSetting = await prisma.commissionSetting.findFirst({
        where: { type: 'GLOBAL' },
      });
      if (globalSetting) commissionRate = Number(globalSetting.percentage);
    }
  } else {
    const globalSetting = await prisma.commissionSetting.findFirst({
      where: { type: 'GLOBAL' },
    });
    if (globalSetting) commissionRate = Number(globalSetting.percentage);
  }

  const amountHeld = order.isPartialPayment && Number(order.advanceAmount) > 0
    ? Number(order.advanceAmount)
    : Number(order.total);

  const commissionFee = Math.round((amountHeld * (commissionRate / 100)) * 100) / 100;
  const payoutAmount = Math.max(0, Math.round((amountHeld - commissionFee) * 100) / 100);

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

  return prisma.escrowLedger.update({
    where: { orderId },
    data: {
      status: 'REFUNDED',
      payoutAmount: 0,
      releasedAt: new Date(),
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
