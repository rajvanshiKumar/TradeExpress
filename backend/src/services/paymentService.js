import prisma from '../config/db.js';
import {
  assertSandboxMode,
  getRazorpayClient,
  verifyRazorpaySignature,
  createSandboxSignature,
  verifyWebhookSignature,
} from '../config/razorpay.js';
import { ENV } from '../config/env.js';
import { sendOrderConfirmationEmail } from './emailService.js';

/**
 * Creates a Razorpay test order for an existing TradeExpress order.
 * Strictly uses server-calculated totals from database records.
 */
export async function createPaymentOrder({ orderId, userId, userRole }) {
  assertSandboxMode();

  const where = orderId.startsWith('TS-') ? { orderNumber: orderId } : { id: orderId };
  const order = await prisma.order.findFirst({
    where,
  });

  if (!order) {
    const error = new Error('Order not found.');
    error.statusCode = 404;
    throw error;
  }

  // Authorization: Only the order owner or administrator can initiate payment
  if (userId && order.userId && order.userId !== userId && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
    const error = new Error('You do not have permission to initiate payment for this order.');
    error.statusCode = 403;
    throw error;
  }

  if (order.orderStatus === 'CANCELLED') {
    const error = new Error('Cannot initiate payment for a cancelled order.');
    error.statusCode = 400;
    throw error;
  }

  if (order.paymentStatus === 'PAID') {
    const error = new Error('This order has already been fully paid.');
    error.statusCode = 400;
    throw error;
  }

  // Calculate payable amount strictly from server-side database records
  let payableAmount = Number(order.total);
  if (order.isPartialPayment) {
    if (order.paymentStatus === 'PARTIALLY_PAID' && order.balanceDue) {
      payableAmount = Number(order.balanceDue);
    } else if (order.advanceAmount) {
      payableAmount = Number(order.advanceAmount);
    }
  }

  // Razorpay amounts are strictly in smallest currency unit (paise for INR)
  const amountInPaise = Math.round(payableAmount * 100);
  if (amountInPaise <= 0) {
    const error = new Error('Payable amount must be greater than zero.');
    error.statusCode = 400;
    throw error;
  }

  const razorpay = getRazorpayClient();
  let gatewayOrderId = null;

  try {
    const rzpOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: order.orderNumber.slice(0, 40),
      notes: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        buyerEmail: order.buyerEmail,
        isPartialPayment: String(order.isPartialPayment),
      },
    });
    gatewayOrderId = rzpOrder.id;
    console.log(`[TradeExpress Payment] Razorpay test order created: ${gatewayOrderId} for order #${order.orderNumber}`);
  } catch (err) {
    console.error('[TradeExpress Payment] Razorpay order creation failed:', err?.error?.description || err.message);
    const error = new Error(err?.error?.description || 'Failed to create payment order with Razorpay test gateway.');
    error.statusCode = err?.statusCode || 502;
    throw error;
  }

  // Record initial pending payment in MySQL
  await prisma.payment.create({
    data: {
      orderId: order.id,
      gateway: 'razorpay',
      paymentOrderId: gatewayOrderId,
      amount: payableAmount,
      currency: 'INR',
      status: 'PENDING',
    },
  });

  return {
    keyId: ENV.RAZORPAY_KEY_ID,
    orderId: order.id,
    orderNumber: order.orderNumber,
    paymentOrderId: gatewayOrderId,
    amount: payableAmount,
    amountInPaise,
    isPartialPayment: order.isPartialPayment,
    paymentStatus: order.paymentStatus,
    currency: 'INR',
    buyerName: order.buyerName,
    buyerEmail: order.buyerEmail,
    buyerPhone: order.buyerPhone,
    isSandbox: true,
  };
}

/**
 * Cryptographically verifies Razorpay payment signature and confirms order payment.
 */
export async function verifyPayment({
  orderId,
  paymentOrderId,
  transactionId,
  signature,
  userId,
  userRole,
}) {
  assertSandboxMode();

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

  // Authorization check
  if (userId && order.userId && order.userId !== userId && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
    const error = new Error('You do not have permission to verify payment for this order.');
    error.statusCode = 403;
    throw error;
  }

  // Idempotency: Return existing successful order if this transaction was already processed
  const existingPayment = await prisma.payment.findFirst({
    where: {
      transactionId,
      status: 'PAID',
    },
    include: { order: true },
  });
  if (existingPayment) {
    return {
      success: true,
      message: 'Payment has already been verified and processed.',
      order: existingPayment.order,
    };
  }

  if (order.paymentStatus === 'PAID') {
    return {
      success: true,
      message: 'This order has already been marked as fully paid.',
      order,
    };
  }

  // Cryptographic Signature Verification using timingSafeEqual
  const isValidSignature = verifyRazorpaySignature({
    orderId: paymentOrderId,
    paymentId: transactionId,
    signature,
  });

  if (!isValidSignature) {
    // Record payment failure in MySQL
    await prisma.payment.create({
      data: {
        orderId: order.id,
        gateway: 'razorpay',
        transactionId: transactionId || null,
        paymentOrderId: paymentOrderId || null,
        signature: signature || null,
        amount: order.isPartialPayment && order.advanceAmount ? order.advanceAmount : order.total,
        currency: 'INR',
        status: 'FAILED',
        rawResponse: { error: 'Cryptographic HMAC signature verification failed.' },
      },
    });

    const error = new Error('Payment verification failed: Invalid gateway signature.');
    error.statusCode = 400;
    throw error;
  }

  let newPaymentStatus = 'PAID';
  let paymentAmount = Number(order.total);
  let statusNote = '';

  if (order.isPartialPayment) {
    if (order.paymentStatus === 'PARTIALLY_PAID') {
      newPaymentStatus = 'PAID';
      paymentAmount = Number(order.balanceDue || 0);
      statusNote = `Final balance payment of ₹${paymentAmount.toLocaleString('en-IN')} confirmed via Razorpay test gateway (Txn: ${transactionId}). Full payment complete.`;
    } else {
      newPaymentStatus = 'PARTIALLY_PAID';
      paymentAmount = Number(order.advanceAmount || (Number(order.total) * 0.2).toFixed(2));
      statusNote = `Partial advance payment of ₹${paymentAmount.toLocaleString('en-IN')} confirmed via Razorpay test gateway (Txn: ${transactionId}). Balance ₹${Number(order.balanceDue || 0).toLocaleString('en-IN')} due on delivery.`;
    }
  } else {
    statusNote = `Online payment of ₹${Number(order.total).toLocaleString('en-IN')} confirmed via Razorpay test gateway (Txn: ${transactionId}).`;
  }

  // Transactionally update Order, Payment, and Status History
  const updatedOrder = await prisma.$transaction(async (tx) => {
    // 1. Update order
    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: newPaymentStatus,
        orderStatus: order.orderStatus === 'ORDER_PLACED' ? 'ORDER_CONFIRMED' : order.orderStatus,
      },
      include: {
        items: true,
        payments: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    // 2. Record successful payment
    await tx.payment.create({
      data: {
        orderId: order.id,
        gateway: 'razorpay',
        transactionId,
        paymentOrderId,
        signature,
        amount: paymentAmount,
        currency: 'INR',
        status: 'PAID',
        rawResponse: { verified: true, verifiedAt: new Date().toISOString() },
      },
    });

    // 3. Add to status history
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: updated.orderStatus,
        notes: statusNote,
        changedBy: 'Razorpay Gateway',
      },
    });

    return updated;
  });

  console.log(`[TradeExpress Payment] Payment verified for order #${order.orderNumber} (Txn: ${transactionId})`);

  // Automatically send order confirmation email
  sendOrderConfirmationEmail(updatedOrder).catch((err) => {
    console.error('[TradeExpress Payment] Failed to send order confirmation email:', err.message);
  });

  return {
    success: true,
    message: 'Payment verified and order confirmed successfully.',
    order: updatedOrder,
  };
}

/**
 * Simulates sandbox payment in development environments using valid HMAC signature.
 */
export async function simulateSandboxPayment({
  orderId,
  paymentOrderId,
  userId,
  userRole,
}) {
  assertSandboxMode();

  const transactionId = `pay_test_${Date.now().toString(36)}`;
  const signature = createSandboxSignature({
    orderId: paymentOrderId,
    paymentId: transactionId,
  });

  return verifyPayment({
    orderId,
    paymentOrderId,
    transactionId,
    signature,
    userId,
    userRole,
  });
}

/**
 * Handles incoming Razorpay webhooks with raw body signature verification and idempotent processing.
 */
export async function handleRazorpayWebhook({ rawBody, signature }) {
  assertSandboxMode();

  if (!ENV.RAZORPAY_WEBHOOK_SECRET) {
    const error = new Error('Razorpay webhook secret is not configured.');
    error.statusCode = 503;
    throw error;
  }

  const isValid = verifyWebhookSignature({ rawBody, signature });
  if (!isValid) {
    const error = new Error('Invalid Razorpay webhook signature');
    error.statusCode = 400;
    throw error;
  }

  const payload = Buffer.isBuffer(rawBody)
    ? JSON.parse(rawBody.toString('utf8'))
    : typeof rawBody === 'string'
      ? JSON.parse(rawBody)
      : rawBody;

  const event = payload.event;
  console.log(`[TradeExpress Webhook] Received validated Razorpay event: ${event}`);

  if (event === 'payment.captured' || event === 'order.paid') {
    const paymentEntity = payload.payload?.payment?.entity;
    const orderEntity = payload.payload?.order?.entity;

    const gatewayOrderId = paymentEntity?.order_id || orderEntity?.id;
    const transactionId = paymentEntity?.id;
    const orderIdNote = paymentEntity?.notes?.orderId || orderEntity?.notes?.orderId;

    if (!transactionId) {
      return { received: true, ignored: true, reason: 'Missing transaction ID' };
    }

    // Idempotency: skip if already processed
    const existing = await prisma.payment.findFirst({
      where: { transactionId, status: 'PAID' },
    });
    if (existing) {
      return { received: true, duplicate: true };
    }

    let order = null;
    if (orderIdNote) {
      order = await prisma.order.findUnique({ where: { id: orderIdNote } });
    }
    if (!order && gatewayOrderId) {
      const existingPayment = await prisma.payment.findFirst({
        where: { paymentOrderId: gatewayOrderId },
        include: { order: true },
      });
      if (existingPayment?.order) {
        order = existingPayment.order;
      }
    }

    if (order && order.paymentStatus !== 'PAID') {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: order.isPartialPayment ? 'PARTIALLY_PAID' : 'PAID',
            orderStatus: order.orderStatus === 'ORDER_PLACED' ? 'ORDER_CONFIRMED' : order.orderStatus,
          },
        });
        await tx.payment.create({
          data: {
            orderId: order.id,
            gateway: 'razorpay_webhook',
            transactionId: transactionId,
            paymentOrderId: gatewayOrderId,
            amount: paymentEntity?.amount ? paymentEntity.amount / 100 : order.total,
            currency: 'INR',
            status: 'PAID',
            rawResponse: { event, paymentId: transactionId },
          },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: 'ORDER_CONFIRMED',
            notes: `Payment confirmed via Razorpay webhook (${event}: ${transactionId})`,
            changedBy: 'Razorpay Webhook',
          },
        });
      });
    }
  }

  return { received: true };
}
