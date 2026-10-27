import prisma from '../config/db.js';
import bcrypt from 'bcryptjs';
import { logAuditAction } from './auditService.js';

// ==========================================
// 1. DASHBOARD & ANALYTICS
// ==========================================
export async function getDashboardStats({ range = '30d' } = {}) {
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const [
    totalUsers,
    totalBuyers,
    totalSuppliers,
    verifiedSuppliers,
    pendingSuppliers,
    totalProducts,
    activeProducts,
    pendingProducts,
    totalCategories,
    totalRfqs,
    openRfqs,
    totalQuotes,
    totalOrders,
    completedOrders,
    pendingOrders,
    revenueAgg,
    escrowHeldAgg,
    commissionAgg,
    openDisputes,
    openTickets,
    recentOrders,
    recentAuditLogs,
    topCategories,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'BUYER' } }),
    prisma.user.count({ where: { role: 'SUPPLIER' } }),
    prisma.user.count({ where: { role: 'SUPPLIER', isVerified: true } }),
    prisma.user.count({ where: { role: 'SUPPLIER', kycStatus: 'PENDING' } }),
    prisma.product.count(),
    prisma.product.count({ where: { status: 'Active', moderationStatus: 'APPROVED' } }),
    prisma.product.count({ where: { moderationStatus: 'PENDING' } }),
    prisma.category.count(),
    prisma.rfq.count(),
    prisma.rfq.count({ where: { status: 'OPEN' } }),
    prisma.quotation.count(),
    prisma.order.count(),
    prisma.order.count({ where: { orderStatus: 'DELIVERED' } }),
    prisma.order.count({ where: { orderStatus: { in: ['ORDER_PLACED', 'ORDER_CONFIRMED', 'PROCESSING'] } } }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { paymentStatus: 'PAID' },
    }),
    prisma.escrowLedger.aggregate({
      _sum: { amountHeld: true },
      where: { status: 'HELD' },
    }),
    prisma.escrowLedger.aggregate({
      _sum: { commissionFee: true },
    }),
    prisma.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
    prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    prisma.order.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        buyerName: true,
        buyerCompany: true,
        total: true,
        currency: true,
        orderStatus: true,
        paymentStatus: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        actorEmail: true,
        actorRole: true,
        action: true,
        resource: true,
        targetId: true,
        details: true,
        result: true,
        createdAt: true,
      },
    }),
    prisma.category.findMany({
      take: 5,
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { products: true } },
      },
      orderBy: { products: { _count: 'desc' } },
    }),
  ]);

  // Aggregate daily order counts for chart
  const recentOrdersForChart = await prisma.order.findMany({
    where: { createdAt: { gte: cutoff } },
    select: { createdAt: true, total: true, paymentStatus: true },
    orderBy: { createdAt: 'asc' },
  });

  const chartDataMap = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    chartDataMap[key] = { date: key, orders: 0, revenue: 0 };
  }

  recentOrdersForChart.forEach((o) => {
    const key = o.createdAt.toISOString().split('T')[0];
    if (chartDataMap[key]) {
      chartDataMap[key].orders += 1;
      if (o.paymentStatus === 'PAID') {
        chartDataMap[key].revenue += Number(o.total || 0);
      }
    }
  });

  const chartTrends = Object.values(chartDataMap);

  return {
    kpis: {
      totalUsers,
      totalBuyers,
      totalSuppliers,
      verifiedSuppliers,
      pendingSuppliers,
      totalProducts,
      activeProducts,
      pendingProducts,
      totalCategories,
      totalRfqs,
      openRfqs,
      totalQuotes,
      totalOrders,
      completedOrders,
      pendingOrders,
      totalRevenue: Number(revenueAgg._sum.total || 0),
      totalEscrowHeld: Number(escrowHeldAgg._sum.amountHeld || 0),
      totalCommissionEarned: Number(commissionAgg._sum.commissionFee || 0),
      openDisputes,
      openTickets,
    },
    chartTrends,
    recentOrders,
    recentAuditLogs,
    topCategories: topCategories.map((c) => ({
      name: c.name,
      slug: c.slug,
      productCount: c._count.products,
    })),
  };
}

// ==========================================
// 2. USER MANAGEMENT
// ==========================================
export async function getUsers({
  page = 1,
  limit = 20,
  search = '',
  role = 'ALL',
  status = 'ALL',
  sortBy = 'createdAt',
  sortOrder = 'desc',
} = {}) {
  const take = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (Math.max(1, parseInt(page, 10)) - 1) * take;

  const where = {};
  if (role && role !== 'ALL') {
    where.role = role;
  }
  if (status && status !== 'ALL') {
    where.status = status;
  }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { company: { contains: search } },
      { phone: { contains: search } },
      { city: { contains: search } },
    ];
  }

  const orderBy = {};
  const validSortFields = ['createdAt', 'name', 'email', 'role', 'status', 'city'];
  const field = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
  orderBy[field] = sortOrder === 'asc' ? 'asc' : 'desc';

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        adminRole: true,
        isActive: true,
        status: true,
        statusReason: true,
        company: true,
        phone: true,
        city: true,
        country: true,
        gstin: true,
        pan: true,
        kycStatus: true,
        isVerified: true,
        isPhoneVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            orders: true,
            supplierOrders: true,
            rfqs: true,
            disputesRaised: true,
          },
        },
      },
    }),
  ]);

  return {
    users,
    pagination: {
      page: parseInt(page, 10),
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  };
}

export async function getUserDetails(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      adminRole: true,
      adminPermissions: true,
      isActive: true,
      status: true,
      statusReason: true,
      company: true,
      phone: true,
      city: true,
      country: true,
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
      isPhoneVerified: true,
      createdAt: true,
      updatedAt: true,
      addresses: true,
      kycDocuments: true,
      _count: {
        select: {
          orders: true,
          supplierOrders: true,
          rfqs: true,
          quotations: true,
          disputesRaised: true,
          supportTickets: true,
        },
      },
    },
  });

  if (!user) {
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  // Get recent 5 orders and recent 5 audit logs targeted at this user
  const [recentOrders, auditTrail] = await Promise.all([
    prisma.order.findMany({
      where: { OR: [{ userId }, { supplierId: userId }] },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        currency: true,
        orderStatus: true,
        paymentStatus: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { OR: [{ targetId: userId }, { actorId: userId }] },
      take: 10,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return { user, recentOrders, auditTrail };
}

export async function updateUserStatus({ userId, status, isActive, reason, req }) {
  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) {
    const error = new Error('Target user does not exist.');
    error.statusCode = 404;
    throw error;
  }

  // Protect Super Admin from being altered
  if (targetUser.role === 'SUPER_ADMIN' || targetUser.email === 'krajvanshi244@gmail.com') {
    const error = new Error('Super Admin privileges and status cannot be modified or suspended.');
    error.statusCode = 403;
    throw error;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      status: status || (isActive ? 'ACTIVE' : 'SUSPENDED'),
      isActive: typeof isActive === 'boolean' ? isActive : status === 'ACTIVE',
      statusReason: reason || null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      isActive: true,
      statusReason: true,
    },
  });

  await logAuditAction({
    req,
    action: 'USER_STATUS_CHANGE',
    resource: 'USERS',
    targetId: userId,
    details: {
      previousStatus: targetUser.status,
      newStatus: updatedUser.status,
      reason,
      targetEmail: targetUser.email,
    },
  });

  return updatedUser;
}

export async function resetUserPassword({ userId, newPassword, req }) {
  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) {
    const error = new Error('Target user does not exist.');
    error.statusCode = 404;
    throw error;
  }

  if (targetUser.role === 'SUPER_ADMIN' && req.user.id !== userId) {
    const error = new Error('Super Admin password cannot be reset by another user.');
    error.statusCode = 403;
    throw error;
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hash },
  });

  await logAuditAction({
    req,
    action: 'PASSWORD_RESET',
    resource: 'USERS',
    targetId: userId,
    details: { targetEmail: targetUser.email, note: 'Admin-initiated password reset' },
  });

  return { success: true, message: 'Password reset successfully.' };
}

// ==========================================
// 3. SUPPLIER & KYC VERIFICATION
// ==========================================
export async function getSuppliersKyc({ page = 1, limit = 20, status = 'ALL', search = '' } = {}) {
  const take = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (Math.max(1, parseInt(page, 10)) - 1) * take;

  const where = { role: 'SUPPLIER' };
  if (status && status !== 'ALL') {
    where.kycStatus = status;
  }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { company: { contains: search } },
      { gstin: { contains: search } },
      { pan: { contains: search } },
    ];
  }

  const [total, suppliers] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        company: true,
        phone: true,
        city: true,
        country: true,
        gstin: true,
        pan: true,
        supplierCode: true,
        businessType: true,
        businessTypeOther: true,
        gstStatus: true,
        taxId: true,
        businessPhone: true,
        yearEstablished: true,
        companyDescription: true,
        logoUrl: true,
        businessImages: true,
        state: true,
        postalCode: true,
        businessAddress: true,
        factoryAddress: true,
        factoryAddressSame: true,
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
        updatedAt: true,
        kycDocuments: true,
        _count: {
          select: {
            supplierOrders: true,
            quotations: true,
          },
        },
      },
    }),
  ]);

  return {
    suppliers,
    pagination: {
      page: parseInt(page, 10),
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  };
}

export async function reviewSupplierKyc({ supplierId, status, rejectionReason, notes, req }) {
  const validStatuses = ['VERIFIED', 'REJECTED', 'RESUBMISSION_REQUESTED', 'PENDING'];
  if (!validStatuses.includes(status)) {
    const error = new Error(`Invalid KYC status. Allowed: ${validStatuses.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  const supplier = await prisma.user.findUnique({ where: { id: supplierId } });
  if (!supplier) {
    const error = new Error('Supplier not found.');
    error.statusCode = 404;
    throw error;
  }

  const isVerified = status === 'VERIFIED';
  const updatedSupplier = await prisma.user.update({
    where: { id: supplierId },
    data: {
      kycStatus: status,
      isVerified,
      kycRejectionReason: status === 'REJECTED' || status === 'RESUBMISSION_REQUESTED' ? rejectionReason || notes : null,
    },
    select: {
      id: true,
      email: true,
      company: true,
      kycStatus: true,
      isVerified: true,
      kycRejectionReason: true,
    },
  });

  // Update associated KYC documents status accordingly
  const docStatus = status === 'VERIFIED' ? 'APPROVED' : status === 'REJECTED' ? 'REJECTED' : 'PENDING';
  await prisma.kycDocument.updateMany({
    where: { userId: supplierId },
    data: { status: docStatus, notes: notes || null },
  });

  await logAuditAction({
    req,
    action: 'KYC_REVIEW',
    resource: 'SUPPLIERS',
    targetId: supplierId,
    details: {
      status,
      isVerified,
      rejectionReason,
      supplierCompany: supplier.company,
      supplierEmail: supplier.email,
    },
  });

  return updatedSupplier;
}

// ==========================================
// 4. PRODUCT & CATEGORY MANAGEMENT
// ==========================================
export async function getProducts({
  page = 1,
  limit = 20,
  moderationStatus = 'ALL',
  categorySlug = 'ALL',
  search = '',
} = {}) {
  const take = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (Math.max(1, parseInt(page, 10)) - 1) * take;

  const where = {};
  if (moderationStatus && moderationStatus !== 'ALL') {
    where.moderationStatus = moderationStatus;
  }
  if (categorySlug && categorySlug !== 'ALL') {
    where.categorySlug = categorySlug;
  }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { sku: { contains: search } },
      { categorySlug: { contains: search } },
      { subcategory: { contains: search } },
    ];
  }

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { name: true, slug: true } },
        images: true,
        _count: { select: { orderItems: true, reviews: true } },
      },
    }),
  ]);

  return {
    products,
    pagination: {
      page: parseInt(page, 10),
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  };
}

export async function moderateProduct({
  productId,
  moderationStatus,
  rejectionReason,
  featured,
  trending,
  status,
  req,
}) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    const error = new Error('Product not found.');
    error.statusCode = 404;
    throw error;
  }

  const updateData = {};
  if (moderationStatus) updateData.moderationStatus = moderationStatus;
  if (rejectionReason !== undefined) updateData.rejectionReason = rejectionReason;
  if (typeof featured === 'boolean') updateData.featured = featured;
  if (typeof trending === 'boolean') updateData.trending = trending;
  if (status) updateData.status = status;

  const updatedProduct = await prisma.product.update({
    where: { id: productId },
    data: updateData,
    include: { category: true, images: true },
  });

  await logAuditAction({
    req,
    action: 'PRODUCT_MODERATE',
    resource: 'PRODUCTS',
    targetId: productId,
    details: {
      productName: product.name,
      sku: product.sku,
      moderationStatus: updatedProduct.moderationStatus,
      featured: updatedProduct.featured,
      trending: updatedProduct.trending,
      rejectionReason,
    },
  });

  return updatedProduct;
}

export async function getCategories() {
  return await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { products: true } },
    },
  });
}

export async function createCategory({ name, slug, description, photo, subcategories }, req) {
  const cleanSlug = (slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  const existing = await prisma.category.findUnique({ where: { slug: cleanSlug } });
  if (existing) {
    const error = new Error('Category slug already exists.');
    error.statusCode = 409;
    throw error;
  }

  const category = await prisma.category.create({
    data: {
      name,
      slug: cleanSlug,
      description: description || null,
      photo: photo || null,
      subcategories: subcategories || [],
    },
  });

  await logAuditAction({
    req,
    action: 'CATEGORY_CREATE',
    resource: 'CATEGORIES',
    targetId: category.id,
    details: { name, slug: cleanSlug },
  });

  return category;
}

export async function updateCategory(id, { name, description, photo, subcategories }, req) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    const error = new Error('Category not found.');
    error.statusCode = 404;
    throw error;
  }

  const updated = await prisma.category.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(photo !== undefined ? { photo } : {}),
      ...(subcategories !== undefined ? { subcategories } : {}),
    },
  });

  await logAuditAction({
    req,
    action: 'CATEGORY_UPDATE',
    resource: 'CATEGORIES',
    targetId: id,
    details: { name: updated.name, slug: updated.slug },
  });

  return updated;
}

export async function deleteCategory(id, req) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });

  if (!category) {
    const error = new Error('Category not found.');
    error.statusCode = 404;
    throw error;
  }

  if (category._count.products > 0) {
    const error = new Error(`Cannot delete category with ${category._count.products} associated products. Reassign products first.`);
    error.statusCode = 400;
    throw error;
  }

  await prisma.category.delete({ where: { id } });

  await logAuditAction({
    req,
    action: 'CATEGORY_DELETE',
    resource: 'CATEGORIES',
    targetId: id,
    details: { name: category.name, slug: category.slug },
  });

  return { success: true, message: 'Category deleted successfully.' };
}

// ==========================================
// 5. B2B RFQ & QUOTE MANAGEMENT
// ==========================================
export async function getRfqs({ page = 1, limit = 20, status = 'ALL', search = '' } = {}) {
  const take = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (Math.max(1, parseInt(page, 10)) - 1) * take;

  const where = {};
  if (status && status !== 'ALL') where.status = status;
  if (search) {
    where.OR = [
      { rfqNumber: { contains: search } },
      { title: { contains: search } },
      { buyerName: { contains: search } },
      { buyerCompany: { contains: search } },
      { buyerEmail: { contains: search } },
    ];
  }

  const [total, rfqs] = await Promise.all([
    prisma.rfq.count({ where }),
    prisma.rfq.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        _count: { select: { quotations: true } },
      },
    }),
  ]);

  return {
    rfqs,
    pagination: {
      page: parseInt(page, 10),
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  };
}

export async function getRfqDetails(rfqId) {
  const rfq = await prisma.rfq.findUnique({
    where: { id: rfqId },
    include: {
      items: true,
      buyer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          company: true,
          city: true,
          country: true,
        },
      },
      quotations: {
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              company: true,
              city: true,
              isVerified: true,
              kycStatus: true,
            },
          },
          items: true,
        },
        orderBy: { unitPrice: 'asc' },
      },
    },
  });

  if (!rfq) {
    const error = new Error('RFQ not found.');
    error.statusCode = 404;
    throw error;
  }

  return rfq;
}

export async function updateRfqStatus(rfqId, { status, req }) {
  const rfq = await prisma.rfq.findUnique({ where: { id: rfqId } });
  if (!rfq) {
    const error = new Error('RFQ not found.');
    error.statusCode = 404;
    throw error;
  }

  const updated = await prisma.rfq.update({
    where: { id: rfqId },
    data: { status },
  });

  await logAuditAction({
    req,
    action: 'RFQ_STATUS_UPDATE',
    resource: 'RFQS',
    targetId: rfqId,
    details: { previousStatus: rfq.status, newStatus: status, rfqNumber: rfq.rfqNumber },
  });

  return updated;
}

// ==========================================
// 6. ORDER & SHIPPING MANAGEMENT
// ==========================================
export async function getOrders({
  page = 1,
  limit = 20,
  orderStatus = 'ALL',
  paymentStatus = 'ALL',
  search = '',
} = {}) {
  const take = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (Math.max(1, parseInt(page, 10)) - 1) * take;

  const where = {};
  if (orderStatus && orderStatus !== 'ALL') where.orderStatus = orderStatus;
  if (paymentStatus && paymentStatus !== 'ALL') where.paymentStatus = paymentStatus;
  if (search) {
    where.OR = [
      { orderNumber: { contains: search } },
      { buyerName: { contains: search } },
      { buyerEmail: { contains: search } },
      { buyerCompany: { contains: search } },
      { trackingNumber: { contains: search } },
    ];
  }

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        supplier: { select: { id: true, name: true, company: true, email: true } },
        escrowLedger: true,
        _count: { select: { items: true } },
      },
    }),
  ]);

  return {
    orders,
    pagination: {
      page: parseInt(page, 10),
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  };
}

export async function getOrderDetails(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      payments: true,
      statusHistory: { orderBy: { createdAt: 'desc' } },
      escrowLedger: true,
      dispute: { include: { messages: true } },
      review: true,
      user: {
        select: { id: true, name: true, email: true, phone: true, company: true, city: true },
      },
      supplier: {
        select: { id: true, name: true, email: true, phone: true, company: true, city: true, isVerified: true },
      },
    },
  });

  if (!order) {
    const error = new Error('Order not found.');
    error.statusCode = 404;
    throw error;
  }

  return order;
}

export async function updateOrderAdmin({
  orderId,
  orderStatus,
  paymentStatus,
  trackingNumber,
  carrierName,
  notes,
  req,
}) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    const error = new Error('Order not found.');
    error.statusCode = 404;
    throw error;
  }

  const updateData = {};
  if (orderStatus) updateData.orderStatus = orderStatus;
  if (paymentStatus) updateData.paymentStatus = paymentStatus;
  if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
  if (carrierName !== undefined) updateData.carrierName = carrierName;
  if (notes) updateData.notes = notes;

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: updateData,
  });

  // Record OrderStatusHistory entry
  if (orderStatus && orderStatus !== order.orderStatus) {
    await prisma.orderStatusHistory.create({
      data: {
        orderId,
        status: orderStatus,
        notes: notes || `Super Admin updated status from ${order.orderStatus} to ${orderStatus}`,
        changedBy: req?.user?.email || 'Super Admin',
      },
    });
  }

  await logAuditAction({
    req,
    action: 'ORDER_ADMIN_OVERRIDE',
    resource: 'ORDERS',
    targetId: orderId,
    details: {
      orderNumber: order.orderNumber,
      previousStatus: order.orderStatus,
      newStatus: updatedOrder.orderStatus,
      paymentStatus: updatedOrder.paymentStatus,
      trackingNumber: updatedOrder.trackingNumber,
      notes,
    },
  });

  return updatedOrder;
}

// ==========================================
// 7. PAYMENTS, COMMISSIONS & REFUNDS
// ==========================================
export async function getPayments({ page = 1, limit = 20, status = 'ALL', search = '' } = {}) {
  const take = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (Math.max(1, parseInt(page, 10)) - 1) * take;

  const where = {};
  if (status && status !== 'ALL') where.status = status;
  if (search) {
    where.OR = [
      { transactionId: { contains: search } },
      { paymentOrderId: { contains: search } },
      { order: { orderNumber: { contains: search } } },
      { order: { buyerEmail: { contains: search } } },
    ];
  }

  const [total, payments, escrowHeldAgg, commissionAgg] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            buyerName: true,
            buyerEmail: true,
            total: true,
            escrowLedger: true,
          },
        },
      },
    }),
    prisma.escrowLedger.aggregate({
      _sum: { amountHeld: true },
      where: { status: 'HELD' },
    }),
    prisma.escrowLedger.aggregate({
      _sum: { commissionFee: true },
    }),
  ]);

  return {
    payments,
    summary: {
      totalEscrowHeld: Number(escrowHeldAgg._sum.amountHeld || 0),
      totalCommissionEarned: Number(commissionAgg._sum.commissionFee || 0),
    },
    pagination: {
      page: parseInt(page, 10),
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  };
}

export async function getCommissionSettings() {
  const settings = await prisma.commissionSetting.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return settings;
}

export async function updateCommissionSetting({ type = 'GLOBAL', targetId = null, percentage, req }) {
  const num = parseFloat(percentage);
  if (isNaN(num) || num < 0 || num > 100) {
    const error = new Error('Percentage must be a number between 0 and 100.');
    error.statusCode = 400;
    throw error;
  }

  const setting = await prisma.commissionSetting.upsert({
    where: {
      type_targetId: {
        type,
        targetId: targetId || '',
      },
    },
    update: { percentage: num },
    create: {
      type,
      targetId: targetId || '',
      percentage: num,
    },
  });

  await logAuditAction({
    req,
    action: 'COMMISSION_UPDATE',
    resource: 'PAYMENTS',
    targetId: setting.id,
    details: { type, targetId, percentage: num },
  });

  return setting;
}

export async function processRefund({ orderId, amount, reason, req }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { escrowLedger: true },
  });

  if (!order) {
    const error = new Error('Order not found.');
    error.statusCode = 404;
    throw error;
  }

  const refundAmount = amount ? parseFloat(amount) : Number(order.total);

  // Update order status & payment status
  const updated = await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: {
        orderStatus: 'REFUNDED',
        paymentStatus: 'REFUNDED',
        notes: (order.notes ? order.notes + '\n' : '') + `Refund processed: ₹${refundAmount}. Reason: ${reason}`,
      },
    }),
    ...(order.escrowLedger
      ? [
          prisma.escrowLedger.update({
            where: { id: order.escrowLedger.id },
            data: { status: 'REFUNDED' },
          }),
        ]
      : []),
    prisma.orderStatusHistory.create({
      data: {
        orderId,
        status: 'REFUNDED',
        notes: `Refund approved and issued for ₹${refundAmount}. Reason: ${reason}`,
        changedBy: req?.user?.email || 'Super Admin',
      },
    }),
  ]);

  await logAuditAction({
    req,
    action: 'REFUND_PROCESSED',
    resource: 'PAYMENTS',
    targetId: orderId,
    details: {
      orderNumber: order.orderNumber,
      refundAmount,
      reason,
      buyerEmail: order.buyerEmail,
    },
  });

  return { success: true, message: `Refund of ₹${refundAmount} recorded successfully.`, order: updated[0] };
}

// ==========================================
// 8. DISPUTES & SUPPORT TICKETS
// ==========================================
export async function getDisputes({ page = 1, limit = 20, status = 'ALL', search = '' } = {}) {
  const take = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (Math.max(1, parseInt(page, 10)) - 1) * take;

  const where = {};
  if (status && status !== 'ALL') where.status = status;
  if (search) {
    where.OR = [
      { order: { orderNumber: { contains: search } } },
      { reason: { contains: search } },
      { buyer: { name: { contains: search } } },
      { buyer: { email: { contains: search } } },
    ];
  }

  const [total, disputes] = await Promise.all([
    prisma.dispute.count({ where }),
    prisma.dispute.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        buyer: { select: { id: true, name: true, email: true, company: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            supplier: { select: { id: true, name: true, company: true, email: true } },
          },
        },
        _count: { select: { messages: true } },
      },
    }),
  ]);

  return {
    disputes,
    pagination: {
      page: parseInt(page, 10),
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  };
}

export async function getDisputeDetails(disputeId) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      buyer: { select: { id: true, name: true, email: true, phone: true, company: true } },
      order: {
        include: {
          items: true,
          supplier: { select: { id: true, name: true, email: true, company: true, phone: true } },
          escrowLedger: true,
        },
      },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!dispute) {
    const error = new Error('Dispute not found.');
    error.statusCode = 404;
    throw error;
  }

  return dispute;
}

export async function addDisputeMessage({ disputeId, message, fileUrl, req }) {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) {
    const error = new Error('Dispute not found.');
    error.statusCode = 404;
    throw error;
  }

  const newMsg = await prisma.disputeMessage.create({
    data: {
      disputeId,
      senderRole: req?.user?.role || 'SUPER_ADMIN',
      message,
      fileUrl: fileUrl || null,
    },
  });

  return newMsg;
}

export async function resolveDispute({ disputeId, resolution, action, refundAmount, req }) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { order: { include: { escrowLedger: true } } },
  });

  if (!dispute) {
    const error = new Error('Dispute not found.');
    error.statusCode = 404;
    throw error;
  }

  const status = action === 'REFUND_BUYER' ? 'RESOLVED_REFUND' : 'RESOLVED_REJECTED';
  const parsedRefund = action === 'REFUND_BUYER' ? parseFloat(refundAmount || dispute.order.total) : 0;

  await prisma.$transaction([
    prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status,
        resolution,
        refundAmount: parsedRefund,
      },
    }),
    prisma.disputeMessage.create({
      data: {
        disputeId,
        senderRole: 'SUPER_ADMIN',
        message: `Dispute resolved by Super Admin: ${resolution}. Outcome: ${action}.`,
      },
    }),
    ...(action === 'REFUND_BUYER'
      ? [
          prisma.order.update({
            where: { id: dispute.orderId },
            data: { orderStatus: 'REFUNDED', paymentStatus: 'REFUNDED' },
          }),
          ...(dispute.order.escrowLedger
            ? [
                prisma.escrowLedger.update({
                  where: { id: dispute.order.escrowLedger.id },
                  data: { status: 'REFUNDED' },
                }),
              ]
            : []),
        ]
      : action === 'RELEASE_SUPPLIER' && dispute.order.escrowLedger
      ? [
          prisma.escrowLedger.update({
            where: { id: dispute.order.escrowLedger.id },
            data: { status: 'RELEASED', releasedAt: new Date() },
          }),
        ]
      : []),
  ]);

  await logAuditAction({
    req,
    action: 'DISPUTE_RESOLVED',
    resource: 'DISPUTES',
    targetId: disputeId,
    details: {
      orderId: dispute.orderId,
      action,
      status,
      resolution,
      refundAmount: parsedRefund,
    },
  });

  return { success: true, message: 'Dispute resolved successfully.' };
}

export async function getSupportTickets({ page = 1, limit = 20, status = 'ALL', search = '' } = {}) {
  const take = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (Math.max(1, parseInt(page, 10)) - 1) * take;

  const where = {};
  if (status && status !== 'ALL') where.status = status;
  if (search) {
    where.OR = [
      { subject: { contains: search } },
      { user: { name: { contains: search } } },
      { user: { email: { contains: search } } },
    ];
  }

  const [total, tickets] = await Promise.all([
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.findMany({
      where,
      skip,
      take,
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        _count: { select: { messages: true } },
      },
    }),
  ]);

  return {
    tickets,
    pagination: {
      page: parseInt(page, 10),
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  };
}

export async function getTicketDetails(ticketId) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, role: true, company: true } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!ticket) {
    const error = new Error('Support ticket not found.');
    error.statusCode = 404;
    throw error;
  }

  return ticket;
}

export async function replySupportTicket({ ticketId, message, status, req }) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    const error = new Error('Ticket not found.');
    error.statusCode = 404;
    throw error;
  }

  const [newMsg] = await prisma.$transaction([
    prisma.ticketMessage.create({
      data: {
        ticketId,
        senderRole: 'SUPER_ADMIN',
        message,
      },
    }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: status || 'IN_PROGRESS',
        updatedAt: new Date(),
      },
    }),
  ]);

  return newMsg;
}

// ==========================================
// 9. SUB-ADMIN MANAGEMENT
// ==========================================
export async function getAdminUsers() {
  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      adminRole: true,
      adminPermissions: true,
      isActive: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { role: 'desc' },
  });

  return admins;
}

export async function createSubAdmin({ name, email, password, adminRole, adminPermissions, phone, req }) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    const error = new Error('An account with this email already exists.');
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newAdmin = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash,
      role: 'ADMIN',
      adminRole: adminRole || 'CUSTOM',
      adminPermissions: Array.isArray(adminPermissions) ? adminPermissions : [],
      phone: phone || null,
      isActive: true,
      status: 'ACTIVE',
      company: 'TradeExpress Administration',
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      adminRole: true,
      adminPermissions: true,
      isActive: true,
      status: true,
      createdAt: true,
    },
  });

  await logAuditAction({
    req,
    action: 'ADMIN_CREATE',
    resource: 'ADMINS',
    targetId: newAdmin.id,
    details: {
      createdEmail: newAdmin.email,
      adminRole: newAdmin.adminRole,
      permissions: newAdmin.adminPermissions,
    },
  });

  return newAdmin;
}

export async function updateSubAdmin({ adminId, name, adminRole, adminPermissions, isActive, status, req }) {
  const target = await prisma.user.findUnique({ where: { id: adminId } });
  if (!target) {
    const error = new Error('Admin user not found.');
    error.statusCode = 404;
    throw error;
  }

  // Prevent modifying Super Admin from this endpoint
  if (target.role === 'SUPER_ADMIN' || target.email === 'krajvanshi244@gmail.com') {
    const error = new Error('Super Admin account configuration cannot be modified via sub-admin manager.');
    error.statusCode = 403;
    throw error;
  }

  const updated = await prisma.user.update({
    where: { id: adminId },
    data: {
      ...(name ? { name } : {}),
      ...(adminRole ? { adminRole } : {}),
      ...(adminPermissions !== undefined ? { adminPermissions } : {}),
      ...(typeof isActive === 'boolean' ? { isActive } : {}),
      ...(status ? { status } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      adminRole: true,
      adminPermissions: true,
      isActive: true,
      status: true,
    },
  });

  await logAuditAction({
    req,
    action: 'ADMIN_UPDATE',
    resource: 'ADMINS',
    targetId: adminId,
    details: {
      adminEmail: target.email,
      adminRole: updated.adminRole,
      isActive: updated.isActive,
      status: updated.status,
    },
  });

  return updated;
}

export async function deleteSubAdmin({ adminId, req }) {
  const target = await prisma.user.findUnique({ where: { id: adminId } });
  if (!target) {
    const error = new Error('Admin user not found.');
    error.statusCode = 404;
    throw error;
  }

  if (target.role === 'SUPER_ADMIN' || target.email === 'krajvanshi244@gmail.com') {
    const error = new Error('Super Admin account cannot be deleted.');
    error.statusCode = 403;
    throw error;
  }

  await prisma.user.delete({ where: { id: adminId } });

  await logAuditAction({
    req,
    action: 'ADMIN_DELETE',
    resource: 'ADMINS',
    targetId: adminId,
    details: { deletedEmail: target.email, name: target.name },
  });

  return { success: true, message: 'Sub-admin removed successfully.' };
}

// ==========================================
// 10. WEBSITE & PLATFORM SETTINGS
// ==========================================
export async function getPlatformSettings() {
  const settings = await prisma.platformSetting.findMany({
    orderBy: { key: 'asc' },
  });

  const grouped = {
    general: {},
    announcements: {},
    finance: {},
    compliance: {},
    operations: {},
    disputes: {},
    other: {},
  };

  settings.forEach((s) => {
    const cat = (s.category || 'other').toLowerCase();
    const targetGroup = grouped[cat] || grouped.other;
    targetGroup[s.key] = {
      id: s.id,
      value: s.value,
      description: s.description,
      updatedBy: s.updatedBy,
      updatedAt: s.updatedAt,
    };
  });

  return { settings, grouped };
}

export async function updatePlatformSetting({ key, value, description, category, req }) {
  const existing = await prisma.platformSetting.findUnique({ where: { key } });
  const updated = await prisma.platformSetting.upsert({
    where: { key },
    update: {
      value,
      ...(description ? { description } : {}),
      ...(category ? { category } : {}),
      updatedBy: req?.user?.email || 'Super Admin',
    },
    create: {
      key,
      value,
      description: description || null,
      category: category || 'general',
      updatedBy: req?.user?.email || 'Super Admin',
    },
  });

  await logAuditAction({
    req,
    action: 'SETTING_UPDATE',
    resource: 'SETTINGS',
    targetId: updated.id,
    details: {
      key,
      previousValue: existing?.value,
      newValue: value,
    },
  });

  return updated;
}

export function getSystemIntegrations() {
  // Inspect environment variables safely without exposing secrets
  return {
    razorpay: {
      configured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      keyIdPreview: process.env.RAZORPAY_KEY_ID ? `${process.env.RAZORPAY_KEY_ID.substring(0, 8)}...` : 'Not configured',
      status: Boolean(process.env.RAZORPAY_KEY_ID) ? 'CONNECTED' : 'DISABLED',
    },
    msg91: {
      configured: Boolean(process.env.MSG91_AUTH_KEY),
      senderId: process.env.MSG91_SENDER_ID || 'TRDEXP',
      status: Boolean(process.env.MSG91_AUTH_KEY) ? 'CONNECTED' : 'DISABLED',
    },
    shiprocket: {
      configured: Boolean(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD),
      status: Boolean(process.env.SHIPROCKET_EMAIL) ? 'CONNECTED' : 'DISABLED',
    },
    database: {
      provider: 'MySQL (Aiven Cloud SSL)',
      status: 'CONNECTED',
    },
  };
}

// ==========================================
// 11. REPORTS & EXPORTS
// ==========================================
export async function getFinancialReport({ startDate, endDate } = {}) {
  const where = { paymentStatus: 'PAID' };
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [orders, escrowHeldAgg, commissionAgg] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        buyerName: true,
        buyerEmail: true,
        total: true,
        tax: true,
        shippingFee: true,
        paymentMethod: true,
        createdAt: true,
        escrowLedger: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.escrowLedger.aggregate({
      _sum: { amountHeld: true },
      where: { status: 'HELD' },
    }),
    prisma.escrowLedger.aggregate({
      _sum: { commissionFee: true },
    }),
  ]);

  const totalGrossRevenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const totalTaxCollected = orders.reduce((sum, o) => sum + Number(o.tax || 0), 0);
  const totalShippingCollected = orders.reduce((sum, o) => sum + Number(o.shippingFee || 0), 0);

  return {
    summary: {
      totalOrdersPaid: orders.length,
      totalGrossRevenue,
      totalTaxCollected,
      totalShippingCollected,
      totalEscrowHeld: Number(escrowHeldAgg._sum.amountHeld || 0),
      totalCommissionEarned: Number(commissionAgg._sum.commissionFee || 0),
    },
    orders,
  };
}
