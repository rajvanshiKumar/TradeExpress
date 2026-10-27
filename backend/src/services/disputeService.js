import prisma from '../config/db.js';
import * as escrowService from './escrowService.js';
import { createNotification, notifyUsersByRole } from './notificationService.js';

export async function createDispute({
  orderId,
  buyerId = null,
  reason,
  description,
  photoProof = null,
  requestedResolution = 'FULL_REFUND',
}) {
  const order = await prisma.order.findFirst({
    where: {
      OR: [{ id: orderId }, { orderNumber: orderId }],
    },
    include: { dispute: true },
  });

  if (!order) {
    const error = new Error(`Order ${orderId} not found.`);
    error.statusCode = 404;
    throw error;
  }

  if (order.dispute) {
    const error = new Error('A dispute has already been filed for this order.');
    error.statusCode = 400;
    throw error;
  }

  // Ensure order is at least confirmed, shipped or delivered
  if (['CANCELLED'].includes(order.orderStatus)) {
    const error = new Error(`Cannot file dispute on an order that is already ${order.orderStatus}.`);
    error.statusCode = 400;
    throw error;
  }

  // Freeze escrow so payout is held while dispute is investigated
  await escrowService.freezeEscrowForDispute(order.id);

  // Create dispute record
  const dispute = await prisma.dispute.create({
    data: {
      orderId: order.id,
      buyerId: buyerId || order.userId || 'guest-buyer',
      reason: reason || 'QUALITY_MISMATCH',
      description: description?.trim() || 'Goods inspection failed.',
      photoProof: photoProof || null,
      status: 'OPEN',
      resolution: `Requested: ${requestedResolution}`,
      messages: {
        create: {
          senderRole: 'BUYER',
          message: `Dispute opened for reason: ${reason}. ${description}`,
          fileUrl: photoProof || null,
        },
      },
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          buyerName: true,
          buyerEmail: true,
          total: true,
          orderStatus: true,
        },
      },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  notifyUsersByRole('ADMIN', {
    title: `Inspection Dispute: #${dispute.order?.orderNumber}`,
    message: `Buyer opened a dispute: "${reason}". Evidence submitted.`,
    type: 'DISPUTE',
    link: `/admin/reports?tab=disputes`,
  }).catch(() => {});

  return dispute;
}

export async function getDispute(idOrOrderId) {
  const dispute = await prisma.dispute.findFirst({
    where: {
      OR: [{ id: idOrOrderId }, { orderId: idOrOrderId }],
    },
    include: {
      order: {
        include: {
          items: true,
          supplier: { select: { id: true, name: true, company: true, email: true } },
          escrowLedger: true,
        },
      },
      buyer: { select: { id: true, name: true, email: true, phone: true } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!dispute) {
    const error = new Error(`Dispute not found.`);
    error.statusCode = 404;
    throw error;
  }

  return dispute;
}

export async function listDisputes({ status = '', role = '', userId = '' } = {}) {
  const where = {};
  if (status && status !== 'ALL') where.status = status;

  if (role === 'BUYER' && userId) where.buyerId = userId;
  if (role === 'SUPPLIER' && userId) where.order = { supplierId: userId };

  const disputes = await prisma.dispute.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          buyerName: true,
          buyerCompany: true,
          total: true,
          orderStatus: true,
          carrierName: true,
          trackingNumber: true,
          supplier: { select: { id: true, name: true, company: true } },
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  return disputes;
}

export async function addDisputeMessage(disputeId, { senderRole = 'BUYER', message, fileUrl = null }) {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) {
    const error = new Error('Dispute not found.');
    error.statusCode = 404;
    throw error;
  }

  const msg = await prisma.disputeMessage.create({
    data: {
      disputeId,
      senderRole,
      message: message.trim(),
      fileUrl: fileUrl || null,
    },
  });

  return msg;
}

export async function resolveDispute(disputeId, { action, resolutionNote = '', refundAmount = 0 }) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { order: true },
  });

  if (!dispute) {
    const error = new Error('Dispute not found.');
    error.statusCode = 404;
    throw error;
  }

  const notifyParties = () => {
    if (dispute.buyerId) {
      createNotification({
        userId: dispute.buyerId,
        title: `Dispute Ruling: #${dispute.order?.orderNumber}`,
        message: `Admin issued ruling on order #${dispute.order?.orderNumber}: ${action}.`,
        type: 'DISPUTE',
        link: `/track/${dispute.order?.orderNumber}`,
      }).catch(() => {});
    }
    if (dispute.order?.supplierId) {
      createNotification({
        userId: dispute.order.supplierId,
        title: `Dispute Ruling: #${dispute.order?.orderNumber}`,
        message: `Admin issued ruling on order #${dispute.order?.orderNumber}: ${action}.`,
        type: 'DISPUTE',
        link: `/supplier/orders`,
      }).catch(() => {});
    }
  };

  if (action === 'APPROVE_FULL_REFUND') {
    // Refund escrow to buyer
    await escrowService.refundEscrow(dispute.orderId);

    const updated = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: 'RESOLVED_REFUND',
        resolution: `Full refund approved by Admin: ${resolutionNote || 'Inspection claim accepted.'}`,
        refundAmount: dispute.order.total,
        messages: {
          create: {
            senderRole: 'ADMIN',
            message: `Dispute RESOLVED: Full refund of ₹${dispute.order.total} approved. ${resolutionNote}`,
          },
        },
      },
      include: { messages: true },
    });

    notifyParties();
    return updated;
  }

  if (action === 'APPROVE_PARTIAL_REFUND') {
    const amt = Number(refundAmount) || 0;
    const ledger = await prisma.escrowLedger.findUnique({ where: { orderId: dispute.orderId } });

    if (ledger) {
      const remainingPayout = Math.max(0, Number(ledger.payoutAmount) - amt);
      await prisma.escrowLedger.update({
        where: { orderId: dispute.orderId },
        data: {
          payoutAmount: remainingPayout,
          status: 'HELD', // Unfreezes for payout of remaining portion
        },
      });
    }

    const updated = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: 'RESOLVED_REFUND',
        resolution: `Partial refund of ₹${amt} approved. ${resolutionNote}`,
        refundAmount: amt,
        messages: {
          create: {
            senderRole: 'ADMIN',
            message: `Dispute RESOLVED: Partial refund of ₹${amt} approved. Remaining escrow will be settled with supplier.`,
          },
        },
      },
      include: { messages: true },
    });

    notifyParties();
    return updated;
  }

  if (action === 'REJECT') {
    // Unfreeze escrow back to HELD for normal supplier release
    await prisma.escrowLedger.updateMany({
      where: { orderId: dispute.orderId },
      data: { status: 'HELD' },
    });

    const updated = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: 'RESOLVED_REJECTED',
        resolution: `Dispute rejected by Admin: ${resolutionNote || 'Evidence insufficient or goods met agreed specs.'}`,
        messages: {
          create: {
            senderRole: 'ADMIN',
            message: `Dispute REJECTED: Inspection claim denied. Escrow funds unfrozen for normal supplier payout. Note: ${resolutionNote}`,
          },
        },
      },
      include: { messages: true },
    });

    notifyParties();
    return updated;
  }

  const error = new Error(`Unknown dispute resolution action '${action}'.`);
  error.statusCode = 400;
  throw error;
}
