import prisma from '../config/db.js';
import { getActiveCommissionPolicy } from './commissionTierService.js';

export async function listPendingKyc() {
  const users = await prisma.user.findMany({
    where: {
      kycStatus: { in: ['PENDING', 'VERIFIED', 'REJECTED'] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      company: true,
      gstin: true,
      pan: true,
      bankAccountNumber: true,
      bankIfsc: true,
      bankName: true,
      warehouseAddress: true,
      warehouseState: true,
      warehousePincode: true,
      kycStatus: true,
      kycRejectionReason: true,
      isVerified: true,
      createdAt: true,
      kycDocuments: {
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return users;
}

export async function reviewKyc(userId, { status, rejectionReason = '', notes = '' }) {
  const isApproved = status === 'APPROVED' || status === 'VERIFIED';
  const finalStatus = isApproved ? 'VERIFIED' : 'REJECTED';

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      kycStatus: finalStatus,
      isVerified: isApproved,
      kycRejectionReason: isApproved ? null : (rejectionReason || notes || 'Documentation did not satisfy verification criteria.'),
    },
    select: {
      id: true,
      email: true,
      name: true,
      company: true,
      kycStatus: true,
      isVerified: true,
    },
  });

  // Also update documents status
  await prisma.kycDocument.updateMany({
    where: { userId },
    data: { status: isApproved ? 'APPROVED' : 'REJECTED', notes: notes || null },
  });

  return user;
}

export async function listProductsForModeration() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      category: { select: { name: true, slug: true } },
    },
  });

  return products.map((p) => ({
    ...p,
    price: Number(p.price),
    gstRate: Number(p.gstRate),
  }));
}

export async function moderateProduct(productId, { status, rejectionReason = '' }) {
  const isApproved = status === 'APPROVED';
  const finalStatus = isApproved ? 'APPROVED' : 'REJECTED';

  const product = await prisma.product.update({
    where: { id: productId },
    data: {
      moderationStatus: finalStatus,
      status: isApproved ? 'Active' : 'Hidden',
      rejectionReason: isApproved ? null : (rejectionReason || 'Violated marketplace listing guidelines.'),
    },
    include: { category: true },
  });

  return product;
}

export async function getCommissionSettings() {
  const settings = await prisma.commissionSetting.findMany({
    orderBy: [{ type: 'asc' }, { targetId: 'asc' }],
  });

  // Ensure default global commission exists (5%)
  let global = settings.find((s) => s.type === 'GLOBAL' && !s.targetId);
  if (!global) {
    global = await prisma.commissionSetting.create({
      data: {
        type: 'GLOBAL',
        targetId: null,
        percentage: 5.0,
      },
    });
    settings.unshift(global);
  }

  const policy = await getActiveCommissionPolicy();
  return {
    policy,
    settings: settings.map((s) => ({
      ...s,
      percentage: Number(s.percentage),
    })),
  };
}

export async function saveCommissionSetting({ type = 'GLOBAL', targetId = null, percentage }) {
  const pct = Number(percentage);
  if (isNaN(pct) || pct < 0 || pct > 100) {
    const error = new Error('Commission percentage must be between 0 and 100.');
    error.statusCode = 400;
    throw error;
  }

  const cleanTargetId = targetId ? String(targetId).trim() : null;

  const existing = await prisma.commissionSetting.findFirst({
    where: {
      type,
      targetId: cleanTargetId,
    },
  });

  let setting;
  if (existing) {
    setting = await prisma.commissionSetting.update({
      where: { id: existing.id },
      data: { percentage: pct },
    });
  } else {
    setting = await prisma.commissionSetting.create({
      data: {
        type,
        targetId: cleanTargetId,
        percentage: pct,
      },
    });
  }

  return {
    ...setting,
    percentage: Number(setting.percentage),
  };
}
