import prisma from '../config/db.js';
import { createNotification } from './notificationService.js';

/**
 * Builds where clause scoping to the authenticated supplier
 */
function getSupplierScopeWhere(supplierUser) {
  const companyId = supplierUser.companyId || supplierUser.company || supplierUser.id;
  return {
    OR: [
      { supplierId: supplierUser.id },
      ...(companyId ? [{ companyId: String(companyId) }] : []),
    ],
  };
}

function getSupplierOrderScopeWhere(supplierUser) {
  const companyId = supplierUser.companyId || supplierUser.company || supplierUser.id;
  return {
    OR: [
      { supplierId: supplierUser.id },
      ...(companyId ? [{ supplierCompanyId: String(companyId) }] : []),
      {
        items: {
          some: {
            product: {
              OR: [
                { supplierId: supplierUser.id },
                ...(companyId ? [{ companyId: String(companyId) }] : []),
              ],
            },
          },
        },
      },
    ],
  };
}

/**
 * 1. Supplier Dashboard Overview Statistics
 */
export async function getSupplierOverview(supplierUser) {
  const productScope = getSupplierScopeWhere(supplierUser);
  const orderScope = getSupplierOrderScopeWhere(supplierUser);

  // Run database queries in parallel for high performance
  const [
    allProducts,
    allOrders,
    allQuotes,
    openRfqs,
    escrowRecords,
    payoutRecords,
    unreadConversations,
    unreadNotifications,
  ] = await Promise.all([
    // Products
    prisma.product.findMany({
      where: productScope,
      select: {
        id: true,
        name: true,
        stock: true,
        moq: true,
        price: true,
        unit: true,
        status: true,
        moderationStatus: true,
        categorySlug: true,
        photo: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),

    // Orders
    prisma.order.findMany({
      where: orderScope,
      include: {
        items: {
          select: {
            id: true,
            productName: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
          },
        },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    }),

    // Quotations submitted by this supplier
    prisma.quotation.findMany({
      where: { supplierId: supplierUser.id },
      include: {
        rfq: {
          select: {
            id: true,
            rfqNumber: true,
            title: true,
            quantity: true,
            unit: true,
            buyerName: true,
            buyerCompany: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),

    // Open Buyer RFQs
    prisma.rfq.findMany({
      where: { status: 'OPEN' },
      select: {
        id: true,
        rfqNumber: true,
        title: true,
        quantity: true,
        unit: true,
        targetPrice: true,
        categorySlug: true,
        destinationCountry: true,
        requiredByDate: true,
        createdAt: true,
        buyerName: true,
        buyerCompany: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),

    // Escrow Ledgers for supplier's orders
    prisma.escrowLedger.findMany({
      where: {
        order: orderScope,
      },
      select: {
        id: true,
        amountHeld: true,
        commissionFee: true,
        commissionRate: true,
        payoutAmount: true,
        status: true,
        releasedAt: true,
      },
    }),

    // Direct Supplier Payouts
    prisma.supplierPayout.findMany({
      where: { supplierId: supplierUser.id },
      orderBy: { createdAt: 'desc' },
    }),

    // Unread messaging count
    prisma.conversation.aggregate({
      where: { supplierId: supplierUser.id },
      _sum: { unreadSupplier: true },
    }),

    // Unread notifications count
    prisma.notification.count({
      where: {
        userId: supplierUser.id,
        isRead: false,
      },
    }),
  ]);

  // --- Calculate Product Metrics ---
  const totalProducts = allProducts.length;
  const activeProducts = allProducts.filter((p) => p.status === 'Active' && p.moderationStatus === 'APPROVED').length;
  const pendingApproval = allProducts.filter((p) => p.moderationStatus === 'PENDING').length;
  const rejectedProducts = allProducts.filter((p) => p.moderationStatus === 'REJECTED').length;
  const lowStockProducts = allProducts.filter((p) => p.stock < p.moq * 2 || p.stock < 10);

  // --- Calculate Order & Revenue Metrics ---
  // Exclude cancelled and refunded orders from sales revenue
  const validOrders = allOrders.filter((o) => o.orderStatus !== 'CANCELLED' && o.orderStatus !== 'REFUNDED');
  const pendingOrders = validOrders.filter((o) => ['ORDER_PLACED', 'ORDER_CONFIRMED', 'PROCESSING', 'PACKED'].includes(o.orderStatus));
  const completedOrders = validOrders.filter((o) => o.orderStatus === 'DELIVERED');
  const inTransitOrders = validOrders.filter((o) => ['SHIPPED', 'OUT_FOR_DELIVERY'].includes(o.orderStatus));

  // Gross sales strictly from delivered orders or verified paid orders
  const grossSales = validOrders
    .filter((o) => o.orderStatus === 'DELIVERED' || o.paymentStatus === 'PAID')
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  // --- Calculate Payouts & Commission ---
  const pendingPayouts = escrowRecords
    .filter((e) => e.status === 'HELD')
    .reduce((sum, e) => sum + Number(e.payoutAmount || 0), 0);

  const releasedPayouts = escrowRecords
    .filter((e) => e.status === 'RELEASED')
    .reduce((sum, e) => sum + Number(e.payoutAmount || 0), 0);

  const totalCommissionDeducted = escrowRecords
    .reduce((sum, e) => sum + Number(e.commissionFee || 0), 0);

  // --- Calculate Quotations Metrics ---
  const openQuotes = allQuotes.filter((q) => ['SENT', 'VIEWED', 'COUNTERED'].includes(q.status));
  const acceptedQuotes = allQuotes.filter((q) => q.status === 'ACCEPTED');
  const rejectedQuotes = allQuotes.filter((q) => q.status === 'REJECTED');

  const now = Date.now();
  const threeDaysFromNow = now + 3 * 24 * 60 * 60 * 1000;
  const expiringQuotes = openQuotes.filter((q) => {
    if (!q.validityDate) return false;
    const time = new Date(q.validityDate).getTime();
    return time >= now && time <= threeDaysFromNow;
  });

  return {
    metrics: {
      totalProducts,
      activeProducts,
      pendingApproval,
      rejectedProducts,
      lowStockCount: lowStockProducts.length,
      totalOrders: allOrders.length,
      pendingOrders: pendingOrders.length,
      completedOrders: completedOrders.length,
      inTransitOrders: inTransitOrders.length,
      cancelledOrders: allOrders.filter((o) => o.orderStatus === 'CANCELLED').length,
      grossSales: Math.round(grossSales * 100) / 100,
      pendingPayouts: Math.round(pendingPayouts * 100) / 100,
      releasedPayouts: Math.round(releasedPayouts * 100) / 100,
      totalCommission: Math.round(totalCommissionDeducted * 100) / 100,
      netEarnings: Math.round((grossSales - totalCommissionDeducted) * 100) / 100,
      openInquiriesCount: openRfqs.length,
      totalQuotations: allQuotes.length,
      openQuotations: openQuotes.length,
      acceptedQuotations: acceptedQuotes.length,
      rejectedQuotations: rejectedQuotes.length,
      expiringQuotations: expiringQuotes.length,
      unreadMessages: unreadConversations._sum.unreadSupplier || 0,
      unreadNotifications,
    },
    verification: {
      isVerified: Boolean(supplierUser.isVerified),
      isPhoneVerified: Boolean(supplierUser.isPhoneVerified),
      kycStatus: supplierUser.kycStatus || 'NOT_SUBMITTED',
      kycRejectionReason: supplierUser.kycRejectionReason || null,
      panAadhaarStatus: supplierUser.panAadhaarStatus || 'NOT_STARTED',
      panAadhaarLinked: Boolean(supplierUser.panAadhaarLinked),
      panAadhaarMaskedPan: supplierUser.panAadhaarMaskedPan || null,
      panAadhaarCheckedAt: supplierUser.panAadhaarCheckedAt || null,
      gstStatus: supplierUser.gstStatus || null,
      gstin: supplierUser.gstin || null,
      pan: supplierUser.pan || null,
      supplierCode: supplierUser.supplierCode || 'SUP-ACTIVE',
    },
    recentOrders: allOrders.slice(0, 5).map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      buyerName: o.buyerName,
      buyerCompany: o.buyerCompany,
      total: Number(o.total),
      orderStatus: o.orderStatus,
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt,
      itemsCount: o.items.length,
      firstProduct: o.items[0]?.productName || 'Order item',
    })),
    recentInquiries: openRfqs.slice(0, 5),
    recentQuotations: allQuotes.slice(0, 5).map((q) => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      rfqTitle: q.rfq?.title,
      buyerCompany: q.rfq?.buyerCompany || q.rfq?.buyerName,
      unitPrice: Number(q.unitPrice),
      totalAmount: Number(q.unitPrice) * Number(q.rfq?.quantity || 1) + Number(q.freightCharge || 0),
      status: q.status,
      validityDate: q.validityDate,
      createdAt: q.createdAt,
    })),
    lowStockAlerts: lowStockProducts.slice(0, 5).map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stock,
      moq: p.moq,
      price: Number(p.price),
      unit: p.unit,
      photo: p.photo,
    })),
  };
}

/**
 * 2. Supplier Quotations List & Detail
 */
export async function listSupplierQuotations(supplierUser, { status, search, page = 1, limit = 20 } = {}) {
  const where = {
    supplierId: supplierUser.id,
    ...(status ? { status } : {}),
    ...(search
      ? {
        OR: [
          { quoteNumber: { contains: search } },
          { rfq: { title: { contains: search } } },
          { rfq: { buyerCompany: { contains: search } } },
          { rfq: { buyerName: { contains: search } } },
        ],
      }
      : {}),
  };

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const take = parseInt(limit, 10);

  const [total, quotations] = await Promise.all([
    prisma.quotation.count({ where }),
    prisma.quotation.findMany({
      where,
      skip,
      take,
      include: {
        rfq: true,
        items: true,
        versions: { orderBy: { versionNumber: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    total,
    page: parseInt(page, 10),
    totalPages: Math.ceil(total / take) || 1,
    data: quotations.map((q) => {
      const quantity = q.rfq?.quantity || 1;
      const subtotal = Number(q.unitPrice) * Number(quantity);
      const freight = Number(q.freightCharge || 0);
      const other = Number(q.otherCharges || 0);
      const taxable = subtotal + freight + other;
      const gstPercentage = Number(q.gstPercentage || 18);
      const gstAmount = (taxable * gstPercentage) / 100;
      const grandTotal = taxable + gstAmount;

      return {
        ...q,
        unitPrice: Number(q.unitPrice),
        freightCharge: freight,
        otherCharges: other,
        gstPercentage,
        subtotal: Math.round(subtotal * 100) / 100,
        taxableAmount: Math.round(taxable * 100) / 100,
        gstAmount: Math.round(gstAmount * 100) / 100,
        grandTotal: Math.round(grandTotal * 100) / 100,
      };
    }),
  };
}

/**
 * 3. Create or Submit Supplier Quotation
 */
export async function createSupplierQuotation(supplierUser, data) {
  const {
    rfqId,
    unitPrice,
    moq = 1,
    leadTimeDays = 14,
    shippingMethod = 'Road Express',
    freightCharge = 0,
    otherCharges = 0,
    otherChargesDesc = '',
    gstPercentage = 18.0,
    paymentTerms = '100% Advance',
    validityDays = 14,
    sampleAvailable = false,
    sampleCost = 0,
    customizationDetails = '',
    taxDutyNotes = '',
    notes = '',
    attachmentUrl = null,
  } = data;

  const rfq = await prisma.rfq.findUnique({
    where: { id: rfqId },
  });

  if (!rfq) {
    const error = new Error('Inquiry/RFQ not found.');
    error.statusCode = 404;
    throw error;
  }

  if (rfq.status === 'CLOSED' || rfq.status === 'CANCELLED') {
    const error = new Error('This RFQ is closed and no longer accepting quotations.');
    error.statusCode = 400;
    throw error;
  }

  const quoteNumber = `TS-QT-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
  const validityDate = new Date(Date.now() + parseInt(validityDays, 10) * 24 * 60 * 60 * 1000);
  const estimatedDeliveryDate = new Date(Date.now() + parseInt(leadTimeDays, 10) * 24 * 60 * 60 * 1000);

  const quotation = await prisma.quotation.create({
    data: {
      quoteNumber,
      rfqId,
      supplierId: supplierUser.id,
      currency: 'INR',
      unitPrice: Number(unitPrice),
      moq: parseInt(moq, 10) || 1,
      gstPercentage: Number(gstPercentage),
      freightCharge: Number(freightCharge),
      otherCharges: Number(otherCharges),
      otherChargesDesc: otherChargesDesc || null,
      shippingMethod,
      leadTimeDays: parseInt(leadTimeDays, 10),
      estimatedDeliveryDate,
      paymentTerms,
      validityDate,
      sampleAvailable: Boolean(sampleAvailable),
      sampleCost: Number(sampleCost),
      customizationDetails: customizationDetails || null,
      taxDutyNotes: taxDutyNotes || null,
      notes: notes || null,
      attachmentUrl: attachmentUrl || null,
      status: 'SENT',
      currentVersion: 1,
    },
    include: {
      rfq: true,
    },
  });

  // Notify the Buyer about the quotation
  if (rfq.buyerId) {
    try {
      await createNotification({
        userId: rfq.buyerId,
        title: `New Quotation for ${rfq.title}`,
        message: `${supplierUser.company || supplierUser.name} submitted a quotation (${quoteNumber}) for ₹${Number(unitPrice)}/unit.`,
        type: 'QUOTATION',
        link: `/buyer/quotes?quoteId=${quotation.id}`,
      });
    } catch (notifErr) {
      console.warn('Notification error (ignoring):', notifErr.message);
    }
  }

  return quotation;
}

/**
 * 4. Supplier Payments & Earnings Ledger
 */
export async function getSupplierPayments(supplierUser, { page = 1, limit = 20, status } = {}) {
  const orderScope = getSupplierOrderScopeWhere(supplierUser);

  const orders = await prisma.order.findMany({
    where: {
      ...orderScope,
      ...(status ? { paymentStatus: status } : {}),
    },
    include: {
      payments: true,
      escrow: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const platformSetting = await prisma.platformSetting.findUnique({
    where: { key: 'default_commission_rate' },
  });
  const defaultCommissionRate = platformSetting ? parseFloat(platformSetting.value) : 2.5;

  let grossTotal = 0;
  let totalCommission = 0;
  let totalNet = 0;
  let pendingPayoutTotal = 0;
  let completedPayoutTotal = 0;

  const ledger = orders.map((o) => {
    const gross = Number(o.total || 0);
    const subtotal = Number(o.subtotal || 0);
    const discount = Number(o.discount || 0);
    const eligibleSubtotal = o.commissionEligibleSubtotal !== null && o.commissionEligibleSubtotal !== undefined
      ? Number(o.commissionEligibleSubtotal)
      : Math.max(0, subtotal - discount);

    const commRate = o.commissionRate !== null && o.commissionRate !== undefined
      ? Number(o.commissionRate)
      : (o.escrow?.commissionRate ? Number(o.escrow.commissionRate) : (eligibleSubtotal <= 50000 ? 8.0 : eligibleSubtotal <= 200000 ? 6.0 : 4.0));

    const commFee = o.commissionFee !== null && o.commissionFee !== undefined
      ? Number(o.commissionFee)
      : (o.escrow?.commissionFee ? Number(o.escrow.commissionFee) : Math.round(eligibleSubtotal * (commRate / 100) * 100) / 100);

    const shippingFee = Number(o.shippingFee || 0);
    const tax = Number(o.tax || 0);
    const refundedCommission = Number(o.escrow?.refundedCommission || 0);

    const isRefunded = o.orderStatus === 'REFUNDED' || o.paymentStatus === 'REFUNDED';
    const isCancelled = o.orderStatus === 'CANCELLED';

    // Refunds if any on this order
    const refundAmount = isRefunded
      ? gross
      : o.escrow?.refundedCommission
        ? Math.max(0, Math.round((Number(o.escrow.amountHeld) - Number(o.escrow.payoutAmount)) * 100) / 100)
        : 0;

    const netSupplier = Math.max(0, Math.round((gross - commFee - refundAmount) * 100) / 100);

    const escrowStatus = o.escrow?.status || (o.paymentStatus === 'PAID' ? 'HELD' : 'PENDING');
    const payoutStatus = isCancelled
      ? 'CANCELLED'
      : isRefunded
        ? 'REFUNDED'
        : escrowStatus === 'RELEASED'
          ? 'SETTLED'
          : escrowStatus === 'HELD'
            ? 'HELD_IN_ESCROW'
            : 'PENDING_PAYMENT';

    const tierLabel = eligibleSubtotal <= 50000
      ? 'Tier 1 (≤ ₹50k)'
      : eligibleSubtotal <= 200000
        ? 'Tier 2 (₹50k-₹200k)'
        : 'Tier 3 (> ₹200k)';

    if (!isCancelled && !isRefunded) {
      if (o.paymentStatus === 'PAID' || o.orderStatus === 'DELIVERED') {
        grossTotal += gross;
        totalCommission += commFee;
        totalNet += netSupplier;
      }
      if (escrowStatus === 'HELD') {
        pendingPayoutTotal += netSupplier;
      } else if (escrowStatus === 'RELEASED') {
        completedPayoutTotal += netSupplier;
      }
    }

    return {
      orderId: o.id,
      orderNumber: o.orderNumber,
      createdAt: o.createdAt,
      buyerName: o.buyerName,
      buyerCompany: o.buyerCompany,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      orderStatus: o.orderStatus,
      productSubtotal: Math.round(subtotal * 100) / 100,
      eligibleSubtotal: Math.round(eligibleSubtotal * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      shippingFee: Math.round(shippingFee * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      grossAmount: Math.round(gross * 100) / 100,
      commissionRate: commRate,
      commissionAmount: Math.round(commFee * 100) / 100,
      refundedCommission: Math.round(refundedCommission * 100) / 100,
      refundAmount: Math.round(refundAmount * 100) / 100,
      tierLabel,
      netSupplierAmount: Math.round(netSupplier * 100) / 100,
      estimatedNetPayable: Math.round(netSupplier * 100) / 100,
      escrowStatus,
      payoutStatus,
      releasedAt: o.escrow?.releasedAt || null,
    };
  });

  const payouts = await prisma.supplierPayout.findMany({
    where: { supplierId: supplierUser.id },
    orderBy: { createdAt: 'desc' },
  });

  return {
    summary: {
      grossSales: Math.round(grossTotal * 100) / 100,
      commissionDeducted: Math.round(totalCommission * 100) / 100,
      netEarnings: Math.round(totalNet * 100) / 100,
      pendingPayouts: Math.round(pendingPayoutTotal * 100) / 100,
      settledPayouts: Math.round(completedPayoutTotal * 100) / 100,
      defaultCommissionRate,
    },
    ledger,
    payoutHistory: payouts.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      commission: Number(p.commission),
      status: p.status,
      reference: p.reference,
      processedAt: p.processedAt,
      createdAt: p.createdAt,
    })),
  };
}

/**
 * 5. Supplier Analytics & Performance
 */
export async function getSupplierAnalytics(supplierUser) {
  const orderScope = getSupplierOrderScopeWhere(supplierUser);

  const [orders, products, quotations] = await Promise.all([
    prisma.order.findMany({
      where: orderScope,
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.product.findMany({
      where: getSupplierScopeWhere(supplierUser),
      select: { id: true, name: true, price: true, stock: true, moq: true, photo: true },
    }),
    prisma.quotation.findMany({
      where: { supplierId: supplierUser.id },
      select: { id: true, status: true, createdAt: true },
    }),
  ]);

  // Aggregate monthly sales for the last 6 months
  const monthlySales = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
    monthlySales[key] = { month: key, gross: 0, net: 0, ordersCount: 0 };
  }

  orders.forEach((o) => {
    if (o.orderStatus !== 'CANCELLED' && o.orderStatus !== 'REFUNDED') {
      const d = new Date(o.createdAt);
      const key = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      if (monthlySales[key]) {
        const val = Number(o.total || 0);
        monthlySales[key].gross += val;
        monthlySales[key].net += val * 0.975; // after 2.5% platform commission
        monthlySales[key].ordersCount += 1;
      }
    }
  });

  // Calculate conversion rates
  const totalQuotes = quotations.length;
  const acceptedQuotes = quotations.filter((q) => q.status === 'ACCEPTED').length;
  const quoteAcceptanceRate = totalQuotes > 0 ? Math.round((acceptedQuotes / totalQuotes) * 100) : 0;

  // Order status distribution
  const orderStatusCounts = {
    CONFIRMED: orders.filter((o) => o.orderStatus === 'ORDER_CONFIRMED').length,
    PROCESSING: orders.filter((o) => ['PROCESSING', 'PACKED'].includes(o.orderStatus)).length,
    IN_TRANSIT: orders.filter((o) => ['SHIPPED', 'OUT_FOR_DELIVERY'].includes(o.orderStatus)).length,
    DELIVERED: orders.filter((o) => o.orderStatus === 'DELIVERED').length,
    CANCELLED: orders.filter((o) => o.orderStatus === 'CANCELLED').length,
  };

  return {
    monthlySales: Object.values(monthlySales),
    orderStatusCounts,
    kpis: {
      totalRevenue: Math.round(orders.filter((o) => o.orderStatus === 'DELIVERED').reduce((s, o) => s + Number(o.total), 0)),
      totalOrdersFulfilled: orderStatusCounts.DELIVERED,
      quoteAcceptanceRate,
      activeListingCount: products.length,
    },
  };
}

/**
 * 6. Supplier Shipping Management & Dispatch
 */
export async function getSupplierShipping(supplierUser) {
  const orderScope = getSupplierOrderScopeWhere(supplierUser);

  const orders = await prisma.order.findMany({
    where: orderScope,
    include: {
      items: true,
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const awaitingDispatch = orders.filter((o) =>
    ['ORDER_CONFIRMED', 'PROCESSING', 'PACKED'].includes(o.orderStatus)
  );
  const inTransit = orders.filter((o) =>
    ['SHIPPED', 'OUT_FOR_DELIVERY'].includes(o.orderStatus)
  );
  const delivered = orders.filter((o) => o.orderStatus === 'DELIVERED');

  return {
    awaitingDispatch: awaitingDispatch.map(mapShippingOrder),
    inTransit: inTransit.map(mapShippingOrder),
    delivered: delivered.map(mapShippingOrder),
  };
}

function mapShippingOrder(o) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    buyerName: o.buyerName,
    buyerPhone: o.buyerPhone,
    buyerCompany: o.buyerCompany,
    deliveryAddress: o.deliveryAddress,
    orderStatus: o.orderStatus,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    carrierName: o.carrierName || 'Self / Road Logistics',
    trackingNumber: o.trackingNumber || 'Pending AWB',
    dispatchDate: o.dispatchDate || null,
    estimatedDelivery: o.estimatedDelivery || null,
    items: o.items.map((i) => ({
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
    })),
    createdAt: o.createdAt,
    statusHistory: o.statusHistory,
  };
}

/**
 * 7. Dispatch Order & Update Carrier/Tracking
 */
export async function dispatchOrderWithCarrier(supplierUser, orderId, { carrierName, trackingNumber, estimatedDeliveryDate, notes }) {
  const orderScope = getSupplierOrderScopeWhere(supplierUser);
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      ...orderScope,
    },
  });

  if (!order) {
    const error = new Error('Order not found or you are not authorized to dispatch this order.');
    error.statusCode = 404;
    throw error;
  }

  if (order.orderStatus === 'CANCELLED') {
    const error = new Error('Cannot dispatch a cancelled order.');
    error.statusCode = 400;
    throw error;
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      orderStatus: 'SHIPPED',
      carrierName: carrierName.trim(),
      trackingNumber: trackingNumber.trim(),
      dispatchDate: new Date(),
      estimatedDelivery: estimatedDeliveryDate ? new Date(estimatedDeliveryDate) : null,
      statusHistory: {
        create: {
          status: 'SHIPPED',
          notes: notes?.trim() || `Dispatched via ${carrierName.trim()}. Tracking / AWB: ${trackingNumber.trim()}`,
          changedBy: supplierUser.name || 'Supplier Logistics',
        },
      },
    },
    include: {
      items: true,
      statusHistory: true,
    },
  });

  // Notify buyer about the dispatch and tracking number
  if (order.userId) {
    try {
      await createNotification({
        userId: order.userId,
        title: `Order #${order.orderNumber} Dispatched`,
        message: `Your consignment has been dispatched via ${carrierName.trim()}. AWB / Tracking: ${trackingNumber.trim()}`,
        type: 'ORDER_UPDATE',
        link: `/order-tracking?order=${order.orderNumber}`,
      });
    } catch (notifErr) {
      console.warn('Notification error (ignoring):', notifErr.message);
    }
  }

  return updatedOrder;
}

/**
 * 8. Supplier Order Acceptance (Step 2 of Mandatory Workflow)
 */
export async function acceptSupplierOrder(supplierUser, orderId) {
  const orderScope = getSupplierOrderScopeWhere(supplierUser);
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...orderScope },
  });

  if (!order) {
    const error = new Error('Order not found or unauthorized.');
    error.statusCode = 404;
    throw error;
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      orderStatus: 'ORDER_CONFIRMED',
      statusHistory: {
        create: {
          status: 'ORDER_CONFIRMED',
          notes: 'Order confirmed and accepted by supplier. Items are being prepared for fulfillment.',
          changedBy: supplierUser.name || 'Supplier',
        },
      },
    },
    include: {
      items: true,
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (order.userId) {
    await createNotification({
      userId: order.userId,
      title: `Order #${order.orderNumber} Confirmed`,
      message: `Supplier has accepted your order and is preparing items for dispatch.`,
      type: 'ORDER_UPDATE',
      link: `/buyer/orders`,
    }).catch(() => {});
  }

  return updatedOrder;
}

/**
 * 9. Supplier Order Rejection
 */
export async function rejectSupplierOrder(supplierUser, orderId, { rejectionReason } = {}) {
  const orderScope = getSupplierOrderScopeWhere(supplierUser);
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...orderScope },
    include: { items: true },
  });

  if (!order) {
    const error = new Error('Order not found or unauthorized.');
    error.statusCode = 404;
    throw error;
  }

  // Release reserved stock safely
  for (const item of order.items) {
    await prisma.$executeRaw`
      UPDATE products 
      SET reservedStock = GREATEST(0, reservedStock - ${item.quantity})
      WHERE id = ${item.productId}
    `.catch(() => {});
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      orderStatus: 'CANCELLED',
      statusHistory: {
        create: {
          status: 'CANCELLED',
          notes: rejectionReason || 'Order rejected by supplier.',
          changedBy: supplierUser.name || 'Supplier',
        },
      },
    },
    include: {
      items: true,
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (order.userId) {
    await createNotification({
      userId: order.userId,
      title: `Order #${order.orderNumber} Cancelled by Supplier`,
      message: `Supplier was unable to fulfill your order. Reason: ${rejectionReason || 'Supplier capacity constraints'}.`,
      type: 'ORDER_UPDATE',
      link: `/buyer/orders`,
    }).catch(() => {});
  }

  return updatedOrder;
}

/**
 * 10. Update Supplier Order Status
 */
export async function updateSupplierOrderStatus(supplierUser, orderId, { status, notes } = {}) {
  const orderScope = getSupplierOrderScopeWhere(supplierUser);
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...orderScope },
  });

  if (!order) {
    const error = new Error('Order not found or unauthorized.');
    error.statusCode = 404;
    throw error;
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      orderStatus: status,
      statusHistory: {
        create: {
          status,
          notes: notes || `Status updated to ${status} by supplier.`,
          changedBy: supplierUser.name || 'Supplier',
        },
      },
    },
    include: {
      items: true,
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
  });

  return updatedOrder;
}
