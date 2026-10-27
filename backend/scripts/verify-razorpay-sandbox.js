import crypto from 'crypto';
import prisma from '../src/config/db.js';
import { ENV } from '../src/config/env.js';
import {
  assertSandboxMode,
  verifyRazorpaySignature,
  createSandboxSignature,
  verifyWebhookSignature,
} from '../src/config/razorpay.js';
import * as paymentService from '../src/services/paymentService.js';
import * as orderService from '../src/services/orderService.js';
import * as authService from '../src/services/authService.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runRazorpaySandboxVerification() {
  console.log('====================================================');
  console.log('🧪 Starting Razorpay Sandbox/Test Mode Verification');
  console.log('====================================================\n');

  try {
    // 1. Sandbox Mode Enforcement Test
    console.log('[Test 1] Testing Sandbox Mode Enforcement & Key Validation...');
    assert(ENV.PAYMENT_GATEWAY_MODE === 'sandbox', `Gateway mode is explicitly sandbox: "${ENV.PAYMENT_GATEWAY_MODE}"`);
    assert(ENV.RAZORPAY_KEY_ID.startsWith('rzp_test_'), `Key ID uses test prefix: "${ENV.RAZORPAY_KEY_ID.slice(0, 9)}..."`);

    // Ensure assertSandboxMode passes with valid config
    assertSandboxMode();
    console.log('  ✓ PASS: assertSandboxMode() succeeded for valid test configuration');

    // 2. Timing-Safe Signature Verification Test
    console.log('\n[Test 2] Testing Cryptographic Timing-Safe Signature Verification...');
    const testOrderId = 'order_test_mock12345';
    const testPaymentId = 'pay_test_mock67890';
    const validSignature = createSandboxSignature({ orderId: testOrderId, paymentId: testPaymentId });
    assert(typeof validSignature === 'string' && validSignature.length === 64, 'Generated 64-char HMAC SHA-256 signature');

    // Test with correct signature
    const isSignatureValid = verifyRazorpaySignature({
      orderId: testOrderId,
      paymentId: testPaymentId,
      signature: validSignature,
    });
    assert(isSignatureValid === true, 'Cryptographic signature verified successfully with timingSafeEqual');

    // Test with tampered/forged signature
    const forgedSignature = validSignature.slice(0, -4) + 'abcd';
    const isForgedValid = verifyRazorpaySignature({
      orderId: testOrderId,
      paymentId: testPaymentId,
      signature: forgedSignature,
    });
    assert(isForgedValid === false, 'Tampered signature rejected');

    // Test with empty/null parameters
    assert(verifyRazorpaySignature({ orderId: '', paymentId: testPaymentId, signature: validSignature }) === false, 'Missing orderId rejected');
    assert(verifyRazorpaySignature({ orderId: testOrderId, paymentId: '', signature: validSignature }) === false, 'Missing paymentId rejected');
    assert(verifyRazorpaySignature({ orderId: testOrderId, paymentId: testPaymentId, signature: '' }) === false, 'Missing signature rejected');

    // 3. User Setup for Order Lifecycle Tests
    console.log('\n[Test 3] Setting up test users and order...');
    const buyerLogin = await authService.loginUser({
      email: 'buyer@tradesphere.com',
      password: 'TradeSphere@2026',
      otp: '123456',
    });
    const buyer = buyerLogin.user;
    assert(buyer && buyer.id, `Test buyer authenticated: ${buyer.email} (${buyer.id})`);

    const product = await prisma.product.findFirst({ where: { status: 'Active' } });
    assert(product && product.id, `Found active test product: "${product.name}"`);

    // Create a real wholesale test order
    const testOrder = await orderService.createOrder({
      userId: buyer.id,
      buyerName: buyer.name,
      buyerEmail: buyer.email,
      buyerPhone: buyer.phone || '+91 98765 43210',
      shippingMethod: 'standard',
      paymentMethod: 'online',
      deliveryAddress: {
        street: '42 Marine Lines',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
        country: 'India',
      },
      lines: [{ productId: product.id, quantity: product.moq || 10 }],
    });
    assert(testOrder && testOrder.id, `Created wholesale order #${testOrder.orderNumber}`);
    assert(testOrder.paymentStatus === 'PENDING', 'Initial paymentStatus is PENDING');
    assert(Number(testOrder.total) > 0, `Order total calculated by server: ₹${testOrder.total}`);

    // 4. Authorization Enforcement
    console.log('\n[Test 4] Testing Payment Authorization Rules...');
    // Attempt to create payment order with a different/unauthorized userId
    let authErrorCaught = false;
    try {
      await paymentService.createPaymentOrder({
        orderId: testOrder.id,
        userId: 'unauthorized-user-uuid-999',
        userRole: 'BUYER',
      });
    } catch (err) {
      authErrorCaught = true;
      assert(err.statusCode === 403, `Unauthorized user blocked with 403: "${err.message}"`);
    }
    assert(authErrorCaught === true, 'Authorization check strictly prevented non-owner payment creation');

    // 5. Payment Order Creation & Server-side Calculation
    console.log('\n[Test 5] Testing Payment Order Initiation & Amount Units...');
    const paymentData = await paymentService.createPaymentOrder({
      orderId: testOrder.id,
      userId: buyer.id,
      userRole: 'BUYER',
    });
    assert(paymentData.paymentOrderId && paymentData.paymentOrderId.length > 5, `Gateway order ID generated: ${paymentData.paymentOrderId}`);
    assert(paymentData.amount === Number(testOrder.total), 'Payable amount strictly equals server-calculated order.total');
    assert(paymentData.amountInPaise === Math.round(Number(testOrder.total) * 100), `Amount converted to paise: ${paymentData.amountInPaise}`);
    assert(paymentData.currency === 'INR', 'Currency enforced as INR');
    assert(paymentData.keyId === ENV.RAZORPAY_KEY_ID, 'Public Key ID returned correctly');

    // Verify pending payment record in DB
    const pendingPayment = await prisma.payment.findFirst({
      where: { orderId: testOrder.id, status: 'PENDING' },
    });
    assert(pendingPayment !== null, `Pending payment record persisted in MySQL: ID ${pendingPayment?.id}`);

    // 6. Signature Verification & Payment Confirmation
    console.log('\n[Test 6] Testing Payment Verification & Status Updates...');
    const testTransactionId = `pay_test_${Date.now().toString(36)}`;
    const validOrderSig = createSandboxSignature({
      orderId: paymentData.paymentOrderId,
      paymentId: testTransactionId,
    });

    const verifyResult = await paymentService.verifyPayment({
      orderId: testOrder.id,
      paymentOrderId: paymentData.paymentOrderId,
      transactionId: testTransactionId,
      signature: validOrderSig,
      userId: buyer.id,
      userRole: 'BUYER',
    });
    assert(verifyResult.success === true, 'Verification succeeded for valid signature');
    assert(verifyResult.order.paymentStatus === 'PAID', 'Order paymentStatus updated to PAID');
    assert(verifyResult.order.orderStatus === 'ORDER_CONFIRMED', 'Order orderStatus updated to ORDER_CONFIRMED');

    // Verify PAID record in database
    const paidRecord = await prisma.payment.findFirst({
      where: { transactionId: testTransactionId, status: 'PAID' },
    });
    assert(paidRecord !== null, `PAID payment record confirmed in MySQL: Txn ${paidRecord?.transactionId}`);

    // 7. Idempotency & Duplicate Verification Test
    console.log('\n[Test 7] Testing Idempotency & Repeated Verification Calls...');
    const duplicateVerify = await paymentService.verifyPayment({
      orderId: testOrder.id,
      paymentOrderId: paymentData.paymentOrderId,
      transactionId: testTransactionId,
      signature: validOrderSig,
      userId: buyer.id,
      userRole: 'BUYER',
    });
    assert(duplicateVerify.success === true, 'Duplicate verification handled gracefully without error');
    assert(duplicateVerify.message.includes('already'), `Idempotency message returned: "${duplicateVerify.message}"`);

    // Attempting to create payment on already paid order must be rejected
    let alreadyPaidBlocked = false;
    try {
      await paymentService.createPaymentOrder({
        orderId: testOrder.id,
        userId: buyer.id,
        userRole: 'BUYER',
      });
    } catch (err) {
      alreadyPaidBlocked = true;
      assert(err.statusCode === 400, `Already-paid order blocked with 400: "${err.message}"`);
    }
    assert(alreadyPaidBlocked === true, 'Prevented payment creation on already-paid order');

    // 8. Webhook Signature Verification Test
    console.log('\n[Test 8] Testing Razorpay Webhook Signature Verification & Idempotency...');
    const testWebhookSecret = 'test_webhook_secret_key_2026';
    const samplePayload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: `pay_test_hook_${Date.now()}`,
            amount: 500000,
            currency: 'INR',
            order_id: paymentData.paymentOrderId,
          },
        },
      },
    });

    const validWebhookSig = crypto
      .createHmac('sha256', testWebhookSecret)
      .update(samplePayload)
      .digest('hex');

    const webhookValid = verifyWebhookSignature({
      rawBody: samplePayload,
      signature: validWebhookSig,
      secret: testWebhookSecret,
    });
    assert(webhookValid === true, 'Webhook HMAC SHA-256 signature verified with timingSafeEqual');

    const webhookForged = verifyWebhookSignature({
      rawBody: samplePayload,
      signature: validWebhookSig.slice(0, -4) + '0000',
      secret: testWebhookSecret,
    });
    assert(webhookForged === false, 'Invalid webhook signature rejected');

    console.log('\n====================================================');
    console.log(`🎉 All ${passed}/${total} Razorpay Sandbox Tests Passed Successfully!`);
    console.log('====================================================\n');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runRazorpaySandboxVerification();
