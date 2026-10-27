import prisma from '../config/db.js';
import { getRazorpayClient, verifyRazorpaySignature, createSandboxSignature, verifyWebhookSignature } from '../config/razorpay.js';
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
    const error = new Error('This order has already been fully paid.');
    error.statusCode = 400;
    throw error;
  }

  // Determine payable amount (partial advance vs balance vs full)
  let payableAmount = Number(order.total);
  if (order.isPartialPayment) {
    if (order.paymentStatus === 'UNPAID' && order.advanceAmount) {
      payableAmount = Number(order.advanceAmount);
    } else if (order.paymentStatus === 'PARTIALLY_PAID' && order.balanceDue) {
      payableAmount = Number(order.balanceDue);
    }
  }

  const amountInPaise = Math.round(payableAmount * 100);
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
          isPartialPayment: String(order.isPartialPayment),
        },
      });
      gatewayOrderId = response.id;
    } catch (err) {
      console.warn('[TradeExpress Payment] Razorpay API order create warning, falling back to sandbox test order:', err.message);
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

  let newPaymentStatus = 'PAID';
  let paymentAmount = Number(order.total);
  let statusNote = '';

  if (order.isPartialPayment) {
    if (order.paymentStatus === 'UNPAID') {
      newPaymentStatus = 'PARTIALLY_PAID';
      paymentAmount = Number(order.advanceAmount || (Number(order.total) * 0.2).toFixed(2));
      statusNote = `Partial advance payment of ₹${paymentAmount.toLocaleString('en-IN')} confirmed via Razorpay (Txn: ${transactionId}). Balance ₹${Number(order.balanceDue || 0).toLocaleString('en-IN')} due on delivery.`;
    } else if (order.paymentStatus === 'PARTIALLY_PAID') {
      newPaymentStatus = 'PAID';
      paymentAmount = Number(order.balanceDue || 0);
      statusNote = `Final balance payment of ₹${paymentAmount.toLocaleString('en-IN')} confirmed via Razorpay (Txn: ${transactionId}). Full payment complete.`;
    }
  } else {
    statusNote = `Online payment of ₹${Number(order.total).toLocaleString('en-IN')} confirmed via Razorpay (Txn: ${transactionId}).`;
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
        changedBy: 'Payment Gateway',
      },
    });

    return updated;
  });

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

export async function handleRazorpayWebhook({ rawBody, signature }) {
  const isValid = verifyWebhookSignature({ rawBody, signature });
  if (!isValid) {
    const error = new Error('Invalid Razorpay webhook signature');
    error.statusCode = 400;
    throw error;
  }

  const payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  const event = payload.event;
  console.log(`[TradeExpress Webhook] Received Razorpay event: ${event}`);

  if (event === 'payment.captured' || event === 'order.paid') {
    const paymentEntity = payload.payload?.payment?.entity;
    const orderEntity = payload.payload?.order?.entity;

    const gatewayOrderId = paymentEntity?.order_id || orderEntity?.id;
    const transactionId = paymentEntity?.id;
    const orderIdNote = paymentEntity?.notes?.orderId || orderEntity?.notes?.orderId;

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
            transactionId: transactionId || 'webhook_' + Date.now(),
            paymentOrderId: gatewayOrderId,
            amount: paymentEntity?.amount ? paymentEntity.amount / 100 : order.total,
            currency: 'INR',
            status: 'PAID',
            rawResponse: payload,
          },
        });
      });
    }
  }

  return { received: true };
}
