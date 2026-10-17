import prisma from '../config/db.js';
import { getRazorpayClient, verifyRazorpaySignature, createSandboxSignature } from '../config/razorpay.js';
import { ENV } from '../config/env.js';
import { sendOrderConfirmationEmail } from './emailService.js';

export async function createPaymentOrder({ orderId }) {
  const where = orderId.startsWith('TS-') ? { orderNumber: orderId } : { id: orderId };
  const order = await prisma.order.findFirst({
    where,
  });

  if (!order) {
    const error = new Error('Order not found.');
    error.statusCode = 404;
    throw error;
  }

  if (order.paymentStatus === 'PAID') {
    const error = new Error('This order has already been paid.');
    error.statusCode = 400;
    throw error;
  }

  const amountInPaise = Math.round(Number(order.total) * 100);
  const razorpay = getRazorpayClient();

  let gatewayOrderId = null;

  if (razorpay && ENV.PAYMENT_GATEWAY_MODE !== 'sandbox_offline') {
    try {
      const response = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: order.orderNumber,
        notes: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          buyerEmail: order.buyerEmail,
        },
      });
      gatewayOrderId = response.id;
    } catch (err) {
      console.warn('[TradeSphere Payment] Razorpay API order create warning, falling back to sandbox test order:', err.message);
      gatewayOrderId = `order_test_${order.orderNumber.replace(/[^a-zA-Z0-9]/g, '')}`;
    }
  } else {
    gatewayOrderId = `order_test_${order.orderNumber.replace(/[^a-zA-Z0-9]/g, '')}`;
  }

  // Record initial pending payment
  await prisma.payment.create({
    data: {
      orderId: order.id,
      gateway: 'razorpay',
      paymentOrderId: gatewayOrderId,
      amount: order.total,
      currency: 'INR',
      status: 'PENDING',
    },
  });

  return {
    keyId: ENV.RAZORPAY_KEY_ID,
    orderId: order.id,
    orderNumber: order.orderNumber,
    paymentOrderId: gatewayOrderId,
    amount: Number(order.total),
    amountInPaise,
    currency: 'INR',
    buyerName: order.buyerName,
    buyerEmail: order.buyerEmail,
    buyerPhone: order.buyerPhone,
    isSandbox: ENV.PAYMENT_GATEWAY_MODE === 'sandbox',
  };
}

export async function verifyPayment({ orderId, paymentOrderId, transactionId, signature }) {
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

  if (order.paymentStatus === 'PAID') {
    return { success: true, message: 'Order is already marked as paid.', order };
  }

  // Cryptographic Signature Verification
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
        amount: order.total,
        currency: 'INR',
        status: 'FAILED',
        rawResponse: { error: 'Cryptographic HMAC signature verification failed.' },
      },
    });

    const error = new Error('Payment verification failed. Invalid gateway signature.');
    error.statusCode = 400;
    throw error;
  }

  // Transactionally update Order, Payment, and Status History
  const updatedOrder = await prisma.$transaction(async (tx) => {
    // 1. Update order
    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'PAID',
        orderStatus: 'ORDER_CONFIRMED',
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
        amount: order.total,
        currency: 'INR',
        status: 'PAID',
        rawResponse: { verified: true, verifiedAt: new Date().toISOString() },
      },
    });

    // 3. Add to status history
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: 'ORDER_CONFIRMED',
        notes: `Online payment of ₹${Number(order.total).toLocaleString('en-IN')} confirmed via Razorpay (Txn: ${transactionId}).`,
        changedBy: 'Payment Gateway',
      },
    });

    return updated;
  });

  // Automatically send order confirmation email
  sendOrderConfirmationEmail(updatedOrder).catch((err) => {
    console.error('[TradeSphere Payment] Failed to send order confirmation email:', err.message);
  });

  return {
    success: true,
    message: 'Payment verified and order confirmed successfully.',
    order: updatedOrder,
  };
}

export async function simulateSandboxPayment({ orderId, paymentOrderId }) {
  if (ENV.PAYMENT_GATEWAY_MODE !== 'sandbox') {
    const error = new Error('Sandbox simulation is only allowed in sandbox mode.');
    error.statusCode = 403;
    throw error;
  }

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
  });
}
