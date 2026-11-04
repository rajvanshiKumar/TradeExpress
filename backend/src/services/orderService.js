import prisma from '../config/db.js';
import { generateOrderNumber } from '../utils/orderNumber.js';
import { sendOrderConfirmationEmail } from './emailService.js';
import { initiateEscrowForOrder } from './escrowService.js';
import {
  calculateOrderCommission,
  getActiveCommissionPolicy,
  roundINR,
} from './commissionTierService.js';
import { createNotification } from './notificationService.js';
import {
  availabilitySnapshot,
  availableOf,
  publishInventoryChanges,
  reserveForNewOrder,
  transitionOrderInventory,
} from './inventoryLifecycleService.js';

export async function validateAndCalculateOrder({ lines, shippingMethod = 'standard', deliveryAddress = null }) {
  if (!lines || !Array.isArray(lines) || lines.length === 0) {
    const error = new Error('Order must contain at least one item.');
    error.statusCode = 400;
    throw error;
  }

  const validatedItems = [];
  let subtotal = 0;

  for (const line of lines) {
    const productId = line.productId || line.product?.id || line.id;
    const quantity = parseInt(line.quantity, 10);

    if (!productId || isNaN(quantity) || quantity <= 0) {
      const error = new Error('Invalid item or quantity.');
      error.statusCode = 400;
      throw error;
    }

    const productName = line.name || line.productName || line.product?.name || '';
    const productSlug = line.slug || line.product?.slug || '';
    const productSku = line.sku || line.product?.sku || '';

    // 1. Look up by exact ID
    let product = null;
    try {
      product = await prisma.product.findUnique({
        where: { id: productId },
      });
    } catch {
      // Ignored if productId is not a UUID
    }

    // 2. Fall back to the exact SKU or slug the catalogue gave the buyer. Products are never matched by name
    // (that could pick another supplier's product) and never created from order data: price, stock and
    // supplier always come from the database.
    if (!product && (productSku || productSlug)) {
      product = await prisma.product.findFirst({
        where: { OR: [...(productSku ? [{ sku: productSku }] : []), ...(productSlug ? [{ slug: productSlug }] : [])] },
      });
    }
    if (!product || product.status !== 'Active') {
      const error = new Error(`Product "${productName || productId}" is not available.`);
      error.statusCode = 400;
      throw error;
    }

    if (quantity < product.moq) {
      const error = new Error(`Quantity for "${product.name}" must be at least ${product.moq} ${product.unit}(s).`);
      error.statusCode = 400;
      throw error;
    }

    if (quantity > availableOf(product)) {
      const error = new Error(`Insufficient stock for "${product.name}". Available: ${availableOf(product)} ${product.unit}(s).`);
      error.statusCode = 400;
      throw error;
    }

    // Server-side tiered pricing calculation
    let unitPrice = Number(product.price);
    if (product.priceTiers && Array.isArray(product.priceTiers)) {
      const sortedTiers = [...product.priceTiers].sort((a, b) => b.minQty - a.minQty);
      for (const tier of sortedTiers) {
        if (quantity >= tier.minQty) {
          unitPrice = Number(tier.price);
          break;
        }
      }
    }

    const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
    subtotal += lineTotal;

    validatedItems.push({
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      productPhoto: product.photo,
      companyId: product.companyId || null,
      supplierId: product.supplierId || null,
      hsnCode: product.hsnCode || '8471',
      gstRate: Number(product.gstRate || 18.0),
      unit: product.unit,
      quantity,
      unitPrice,
      lineTotal,
      variant: line.variant || null,
    });
  }

  subtotal = Math.round(subtotal * 100) / 100;

  // Shipping rules
  let shippingFee = 0;
  let shippingEta = '5–7 business days';
  if (shippingMethod === 'express') {
    shippingFee = 650;
    shippingEta = '2–3 business days';
  } else if (shippingMethod === 'freight') {
    shippingFee = 1500;
    shippingEta = '7–12 business days (pallet cargo)';
  } else {
    shippingFee = subtotal >= 5000 ? 0 : 250;
    shippingEta = '5–7 business days';
  }

  // GST Calculation: Intra-state (CGST 9% + SGST 9%) vs Inter-state (IGST 18%)
  // Default supplier state is Maharashtra if not specified
  let buyerState = '';
  if (deliveryAddress) {
    try {
      const parsed = typeof deliveryAddress === 'object' ? deliveryAddress : JSON.parse(deliveryAddress || '{}');
      buyerState = (parsed?.state || '').trim().toLowerCase();
    } catch {
      buyerState = '';
    }
  }
  const supplierState = (validatedItems[0]?.companyId ? 'maharashtra' : 'maharashtra').toLowerCase();
  const isInterState = buyerState ? buyerState !== supplierState : false;

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (isInterState) {
    igst = Math.round(subtotal * 0.18 * 100) / 100;
  } else {
    cgst = Math.round(subtotal * 0.09 * 100) / 100;
    sgst = Math.round(subtotal * 0.09 * 100) / 100;
  }

  const tax = Math.round((cgst + sgst + igst) * 100) / 100;
  const discount = 0;
  const total = Math.round((subtotal + shippingFee + tax - discount) * 100) / 100;

  // Calculate declining order-level commission (base: product subtotal minus product discount)
  const commissionPolicy = await getActiveCommissionPolicy();
  const commissionCalc = calculateOrderCommission({
    subtotal,
    discount,
    policy: commissionPolicy,
  });

  return {
    items: validatedItems,
    totals: {
      subtotal,
      shippingFee,
      tax,
      cgst,
      sgst,
      igst,
      isInterState,
      discount,
      total,
      commission: commissionCalc,
    },
    shippingMethod,
    shippingEta,
  };
}

export async function createOrder({
  userId,
  buyerName,
  buyerEmail,
  buyerPhone,
  buyerCompany,
  buyerGstin,
  supplierGstin,
  shippingMethod = 'standard',
  paymentMethod = 'online',
  isPartialPayment = false,
  deliveryAddress,
  lines,
  idempotencyKey,
  notes,
}) {
  const parsedAddress = typeof deliveryAddress === 'object' ? deliveryAddress : JSON.parse(deliveryAddress || '{}');
  // Check for duplicate submission using idempotency key
  if (idempotencyKey) {
    const existingOrder = await prisma.order.findUnique({
      where: { idempotencyKey },
      include: {
        items: true,
        payments: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (existingOrder) {
      return formatOrder(existingOrder);
    }
  }

  // Strictly validate prices, quantities, and totals against MySQL
  const calculation = await validateAndCalculateOrder({ lines, shippingMethod, deliveryAddress });
  const orderNumber = generateOrderNumber();

  const isCod = paymentMethod === 'cod';
  const initialPaymentStatus = isCod ? 'COD' : 'PENDING';
  const initialOrderStatus = isCod ? 'ORDER_CONFIRMED' : 'ORDER_PLACED';

  const stockBefore = await availabilitySnapshot(calculation.items.map((i) => i.productId));
  let touchedProducts = [];

  // Execute database atomic transaction
  const order = await prisma.$transaction(async (tx) => {
    // 1. Lock the products and hold the stock (COD is confirmed at once, so it is committed straight away)
    const holding = await reserveForNewOrder(tx, {
      orderNumber,
      items: calculation.items,
      commit: isCod,
      actor: { id: userId || null, name: buyerName || 'Buyer' },
    });
    touchedProducts = holding.touched;

    const primarySupplierCompanyId = calculation.items[0]?.companyId || 'SUP';
    const primarySupplierId = calculation.items[0]?.supplierId || null;
    const supplierInvoiceSeries = `TS-INV-${primarySupplierCompanyId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-6)}`;
    const advanceAmount = isPartialPayment ? Math.round(calculation.totals.total * 0.20 * 100) / 100 : calculation.totals.total;
    const balanceDue = isPartialPayment ? Math.round((calculation.totals.total - advanceAmount) * 100) / 100 : 0;

    // 2. Create Order record
    const created = await tx.order.create({
      data: {
        orderNumber,
        userId: userId || null,
        supplierId: primarySupplierId,
        supplierCompanyId: primarySupplierCompanyId,
        supplierInvoiceNumber: supplierInvoiceSeries,
        buyerName,
        buyerEmail,
        buyerPhone,
        buyerCompany: buyerCompany || '',
        buyerGstin: buyerGstin || null,
        supplierGstin: supplierGstin || null,
        shippingMethod: calculation.shippingMethod,
        shippingEta: calculation.shippingEta,
        paymentMethod,
        paymentStatus: initialPaymentStatus,
        orderStatus: initialOrderStatus,
        subtotal: calculation.totals.subtotal,
        shippingFee: calculation.totals.shippingFee,
        tax: calculation.totals.tax,
        cgst: calculation.totals.cgst,
        sgst: calculation.totals.sgst,
        igst: calculation.totals.igst,
        isInterState: calculation.totals.isInterState,
        discount: calculation.totals.discount,
        total: calculation.totals.total,
        commissionEligibleSubtotal: calculation.totals.commission?.eligibleSubtotal ?? Math.max(0, calculation.totals.subtotal - calculation.totals.discount),
        commissionRate: calculation.totals.commission?.commissionRate ?? 8.0,
        commissionFee: calculation.totals.commission?.commissionFee ?? 0,
        commissionPolicy: calculation.totals.commission?.policyVersion ?? 'TIERED_V1',
        commissionCalculatedAt: calculation.totals.commission?.calculatedAt ?? new Date(),
        isPartialPayment: Boolean(isPartialPayment),
        advanceAmount,
        balanceDue,
        currency: 'INR',
        deliveryAddress: parsedAddress,
        idempotencyKey: idempotencyKey || null,
        notes: notes || '',
        inventoryState: holding.inventoryState,
        reservationExpiresAt: holding.reservationExpiresAt,
        items: {
          create: calculation.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            productSku: item.productSku,
            productPhoto: item.productPhoto,
            hsnCode: item.hsnCode || '8471',
            gstRate: item.gstRate || 18.0,
            unit: item.unit,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            variant: item.variant || null,
          })),
        },
        statusHistory: {
          create: [
            {
              status: 'ORDER_PLACED',
              notes: isCod ? 'Order placed with Cash on Delivery.' : 'Order placed, awaiting online payment confirmation.',
              changedBy: 'Buyer',
            },
            ...(isCod
              ? [
                  {
                    status: 'ORDER_CONFIRMED',
                    notes: 'Order confirmed for Cash on Delivery processing.',
                    changedBy: 'System',
                  },
                ]
              : []),
          ],
        },
      },
      include: {
        items: true,
        payments: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });

    return created;
  }, { maxWait: 15000, timeout: 30000 });

  // Automatically initialize escrow ledger entry for wholesale order
  initiateEscrowForOrder(order.id).catch((err) => {
    console.error('[TradeExpress Escrow] Escrow init note:', err.message);
  });

  // If COD, send confirmation email immediately since order is confirmed
  if (isCod) {
    sendOrderConfirmationEmail(order).catch((err) => {
      console.error('[TradeExpress OrderService] Failed to send COD confirmation email:', err.message);
    });
  }

  // Notify supplier of incoming wholesale order
  if (order.supplierId) {
    createNotification({
      userId: order.supplierId,
      title: `New Order: #${order.orderNumber}`,
      message: `Received new bulk order of ₹${Number(order.total).toLocaleString('en-IN')} from ${order.buyerCompany || order.buyerName}.`,
      type: 'ORDER',
      link: `/supplier/orders?order=${order.orderNumber}`,
    }).catch(() => {});
  }

  // Live stock to the supplier, admins and buyers (and a low-stock alert if a threshold was crossed)
  publishInventoryChanges(touchedProducts, stockBefore);

  return formatOrder(order);
}

export async function getOrderByIdOrNumber(identifier, userId = null) {
  const where = identifier.startsWith('TS-') ? { orderNumber: identifier } : { id: identifier };

  const order = await prisma.order.findFirst({
    where,
    include: {
      items: true,
      payments: true,
      statusHistory: { orderBy: { createdAt: 'desc' } },
      escrowLedger: true,
      dispute: {
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      },
      review: true,
      supplier: {
        select: {
          id: true,
          name: true,
          company: true,
          email: true,
          phone: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          gstin: true,
          pan: true,
        },
      },
    },
  });

  if (!order) {
    const error = new Error('Order not found.');
    error.statusCode = 404;
    throw error;
  }

  // If userId is provided, ensure user owns the order (or is admin/supplier)
  if (userId && order.userId && order.userId !== userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.role !== 'ADMIN') {
      const error = new Error('You do not have permission to view this order.');
      error.statusCode = 403;
      throw error;
    }
  }

  return formatOrder(order);
}

export async function listUserOrders(userId) {
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      items: true,
      payments: true,
      statusHistory: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  return orders.map(formatOrder);
}

export async function cancelBuyerOrder({ orderId, userId, reason = '' }) {
  const where = orderId.startsWith('TS-') ? { orderNumber: orderId } : { id: orderId };
  const order = await prisma.order.findFirst({
    where,
    include: { items: true },
  });

  if (!order) {
    const error = new Error('Order not found.');
    error.statusCode = 404;
    throw error;
  }

  if (userId && order.userId && order.userId !== userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.role !== 'ADMIN') {
      const error = new Error('You do not have permission to cancel this order.');
      error.statusCode = 403;
      throw error;
    }
  }

  // Strict Rule: Buyer can cancel before "Packed"
  const NON_CANCELLABLE = ['PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
  if (NON_CANCELLABLE.includes(order.orderStatus)) {
    const error = new Error(`Order cannot be cancelled because it is already "${order.orderStatus}". Orders can only be cancelled before packing/dispatch.`);
    error.statusCode = 400;
    throw error;
  }

  const stockBefore = await availabilitySnapshot(order.items.map((i) => i.productId));

  const { updated, released } = await prisma.$transaction(async (tx) => {
    // 1. Claim the cancellation, so a double click or a parallel shipment cannot both win
    const claimed = await tx.order.updateMany({
      where: { id: order.id, orderStatus: { notIn: NON_CANCELLABLE } },
      data: {
        orderStatus: 'CANCELLED',
        rejectionReason: reason || 'Cancelled by buyer before packing.',
      },
    });
    if (claimed.count === 0) {
      const error = new Error('This order was already cancelled or has moved past packing.');
      error.statusCode = 409;
      throw error;
    }

    // 2. Give the held stock back (no-op for orders placed before stock tracking)
    const moved = await transitionOrderInventory(tx, order.id, 'RELEASE', {
      reason: 'ORDER_CANCELLED',
      notes: `Buyer cancelled Order #${order.orderNumber}${reason ? `: ${reason}` : ''}`,
      actor: { id: userId || null, name: 'Buyer' },
    });

    // 3. Record status history
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: 'CANCELLED',
        notes: `Order cancelled by buyer: ${reason || 'Buyer cancelled before packing.'}`,
        changedBy: 'Buyer',
      },
    });

    const fresh = await tx.order.findUnique({
      where: { id: order.id },
      include: {
        items: true,
        payments: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });
    return { updated: fresh, released: moved };
  }, { maxWait: 15000, timeout: 30000 });

  publishInventoryChanges(released.touched, stockBefore);

  if (order.supplierId) {
    createNotification({
      userId: order.supplierId,
      title: `Order Cancelled: #${order.orderNumber}`,
      message: released.applied
        ? `Buyer cancelled order #${order.orderNumber}. The held stock is available again.`
        : `Buyer cancelled order #${order.orderNumber}.`,
      type: 'ORDER',
      link: `/supplier/orders?order=${order.orderNumber}`,
    }).catch(() => {});
  }

  return formatOrder(updated);
}

function formatOrder(order) {
  return {
    ...order,
    subtotal: Number(order.subtotal),
    shippingFee: Number(order.shippingFee),
    tax: Number(order.tax),
    cgst: Number(order.cgst || 0),
    sgst: Number(order.sgst || 0),
    igst: Number(order.igst || 0),
    discount: Number(order.discount),
    total: Number(order.total),
    advanceAmount: Number(order.advanceAmount || 0),
    balanceDue: Number(order.balanceDue || 0),
    commissionEligibleSubtotal: order.commissionEligibleSubtotal !== null && order.commissionEligibleSubtotal !== undefined ? Number(order.commissionEligibleSubtotal) : null,
    commissionRate: order.commissionRate !== null && order.commissionRate !== undefined ? Number(order.commissionRate) : null,
    commissionFee: order.commissionFee !== null && order.commissionFee !== undefined ? Number(order.commissionFee) : null,
    commissionPolicy: order.commissionPolicy || null,
    commissionCalculatedAt: order.commissionCalculatedAt || null,
    escrowLedger: order.escrowLedger ? {
      ...order.escrowLedger,
      amountHeld: Number(order.escrowLedger.amountHeld),
      commissionRate: Number(order.escrowLedger.commissionRate),
      commissionFee: Number(order.escrowLedger.commissionFee),
      refundedCommission: Number(order.escrowLedger.refundedCommission || 0),
      payoutAmount: Number(order.escrowLedger.payoutAmount),
    } : null,
    items: (order.items || []).map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
      gstRate: Number(item.gstRate || 18.0),
    })),
  };
}
