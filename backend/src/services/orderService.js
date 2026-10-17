import prisma from '../config/db.js';
import { generateOrderNumber } from '../utils/orderNumber.js';
import { sendOrderConfirmationEmail } from './emailService.js';

export async function validateAndCalculateOrder({ lines, shippingMethod = 'standard' }) {
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

    // 1. Look up by exact ID
    let product = await prisma.product.findUnique({
      where: { id: productId },
    });

    // 2. Fall back to SKU, model number (e.g. TS-P-1041 -> -1041), slug, or name
    if (!product) {
      const match = String(productId).match(/(\d+)$/);
      const number = match ? match[1] : null;

      product = await prisma.product.findFirst({
        where: {
          OR: [
            { id: productId },
            { sku: line.sku || productId },
            ...(number ? [{ sku: { endsWith: `-${number}` } }] : []),
            ...(line.slug ? [{ slug: line.slug }] : []),
            ...(line.name ? [{ name: line.name }] : []),
          ],
        },
      });
    }

    if (!product || product.status !== 'Active') {
      const error = new Error(`Product "${line.name || line.productName || productId}" is unavailable.`);
      error.statusCode = 400;
      throw error;
    }

    if (quantity < product.moq) {
      const error = new Error(`Quantity for "${product.name}" must be at least ${product.moq} ${product.unit}(s).`);
      error.statusCode = 400;
      throw error;
    }

    if (quantity > product.stock) {
      const error = new Error(`Insufficient stock for "${product.name}". Available: ${product.stock} ${product.unit}(s).`);
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

  // Tax calculation (18% GST standard on wholesale in India)
  const tax = Math.round(subtotal * 0.18 * 100) / 100;
  const discount = 0;
  const total = Math.round((subtotal + shippingFee + tax - discount) * 100) / 100;

  return {
    items: validatedItems,
    totals: {
      subtotal,
      shippingFee,
      tax,
      discount,
      total,
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
  shippingMethod = 'standard',
  paymentMethod = 'online',
  deliveryAddress,
  lines,
  idempotencyKey,
  notes,
}) {
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
  const calculation = await validateAndCalculateOrder({ lines, shippingMethod });
  const orderNumber = generateOrderNumber();

  const isCod = paymentMethod === 'cod';
  const initialPaymentStatus = isCod ? 'COD' : 'PENDING';
  const initialOrderStatus = isCod ? 'ORDER_CONFIRMED' : 'ORDER_PLACED';

  // Execute database atomic transaction
  const order = await prisma.$transaction(async (tx) => {
    // 1. Decrement stock
    for (const item of calculation.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // 2. Create Order record
    const created = await tx.order.create({
      data: {
        orderNumber,
        userId: userId || null,
        buyerName,
        buyerEmail,
        buyerPhone,
        buyerCompany: buyerCompany || '',
        shippingMethod: calculation.shippingMethod,
        shippingEta: calculation.shippingEta,
        paymentMethod,
        paymentStatus: initialPaymentStatus,
        orderStatus: initialOrderStatus,
        subtotal: calculation.totals.subtotal,
        shippingFee: calculation.totals.shippingFee,
        tax: calculation.totals.tax,
        discount: calculation.totals.discount,
        total: calculation.totals.total,
        currency: 'INR',
        deliveryAddress: typeof deliveryAddress === 'object' ? deliveryAddress : JSON.parse(deliveryAddress),
        idempotencyKey: idempotencyKey || null,
        notes: notes || '',
        items: {
          create: calculation.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            productSku: item.productSku,
            productPhoto: item.productPhoto,
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
  });

  // If COD, send confirmation email immediately since order is confirmed
  if (isCod) {
    sendOrderConfirmationEmail(order).catch((err) => {
      console.error('[TradeSphere OrderService] Failed to send COD confirmation email:', err.message);
    });
  }

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

function formatOrder(order) {
  return {
    ...order,
    subtotal: Number(order.subtotal),
    shippingFee: Number(order.shippingFee),
    tax: Number(order.tax),
    discount: Number(order.discount),
    total: Number(order.total),
    items: (order.items || []).map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
    })),
  };
}
