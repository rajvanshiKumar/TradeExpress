import prisma from '../src/config/db.js';
import * as authService from '../src/services/authService.js';
import * as productService from '../src/services/productService.js';
import * as orderService from '../src/services/orderService.js';
import * as paymentService from '../src/services/paymentService.js';
import * as trackingService from '../src/services/trackingService.js';
import { sendOrderConfirmationEmail } from '../src/services/emailService.js';

async function runE2EVerification() {
  console.log('====================================================');
  console.log('🧪 Starting TradeSphere Full-Stack Verification Suite');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // TEST 1: Database Connectivity & Seeding Check
    console.log('[Test 1] Checking MySQL connection & seeded tables...');
    const userCount = await prisma.user.count();
    const productCount = await prisma.product.count();
    const categoryCount = await prisma.category.count();
    assert(userCount >= 3, `Users in MySQL: ${userCount}`);
    assert(productCount >= 50, `Products in MySQL: ${productCount}`);
    assert(categoryCount >= 12, `Categories in MySQL: ${categoryCount}`);

    // TEST 2: Authentication & JWT Generation
    console.log('\n[Test 2] Testing User Authentication & Token Generation...');
    const loginResult = await authService.loginUser({
      email: 'buyer@tradesphere.com',
      password: 'TradeSphere@2026',
      otp: '123456',
    });
    assert(loginResult.token && loginResult.token.length > 20, 'JWT token successfully generated');
    assert(loginResult.user.role === 'BUYER', 'Buyer role verified in database');

    const adminLogin = await authService.loginUser({
      email: 'krajvanshi244@gmail.com',
      password: 'modiji@12345',
      isAdminLogin: true,
    });
    assert(adminLogin.token && adminLogin.token.length > 20, 'Admin JWT token generated');
    assert(adminLogin.user.role === 'ADMIN' || adminLogin.user.role === 'SUPER_ADMIN', 'Admin or Super Admin role verified in database');

    // TEST 3: Product Retrieval & Image URL Integrity
    console.log('\n[Test 3] Testing Product Retrieval & HD Image URLs...');
    const productsRes = await productService.listProducts({ limit: 5 });
    assert(productsRes.products.length > 0, 'Products returned from database');
    const firstProduct = productsRes.products[0];
    assert(firstProduct.photo && !firstProduct.photo.includes('cartoon') && !firstProduct.photo.includes('placeholder'), `Valid HD photo: ${firstProduct.photo}`);

    // TEST 4: Server-Side Inventory & MOQ Validation
    console.log('\n[Test 4] Testing Server-Side Inventory & MOQ Validation...');
    let moqFailed = false;
    try {
      await orderService.validateAndCalculateOrder({
        lines: [{ productId: firstProduct.id, quantity: 1 }], // MOQ is usually > 1
      });
    } catch (err) {
      moqFailed = err.message.includes('must be at least');
    }
    assert(moqFailed, 'Server-side MOQ rule strictly enforced');

    // TEST 5: Cash on Delivery (COD) Order Flow
    console.log('\n[Test 5] Testing Cash on Delivery (COD) Order Flow & Stock Decrement...');
    const initialStock = firstProduct.stock;
    const testOrderQty = firstProduct.moq;
    const idempotencyKey = `test_e2e_${Date.now()}`;

    const codOrder = await orderService.createOrder({
      userId: loginResult.user.id,
      buyerName: 'Priya Sharma (E2E Test)',
      buyerEmail: 'priya.sharma@example.com',
      buyerPhone: '+91 98765 43210',
      buyerCompany: 'Apex Retailers Pvt Ltd',
      shippingMethod: 'standard',
      paymentMethod: 'cod',
      deliveryAddress: {
        name: 'Priya Sharma',
        street: '42 MG Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        country: 'India',
        phone: '+91 98765 43210',
      },
      lines: [{ productId: firstProduct.id, quantity: testOrderQty }],
      idempotencyKey,
    });

    assert(codOrder.orderNumber.startsWith('TS-'), `Order Number created: ${codOrder.orderNumber}`);
    assert(codOrder.paymentStatus === 'COD', 'Payment status is COD');
    assert(codOrder.orderStatus === 'ORDER_CONFIRMED', 'Order status is ORDER_CONFIRMED');

    // Verify stock decrement in MySQL
    const updatedProduct = await prisma.product.findUnique({ where: { id: firstProduct.id } });
    assert(updatedProduct.stock === initialStock - testOrderQty, `Stock decremented from ${initialStock} to ${updatedProduct.stock}`);

    // TEST 6: Duplicate Order Submission Prevention (Idempotency)
    console.log('\n[Test 6] Testing Idempotency & Duplicate Order Prevention...');
    const duplicateOrder = await orderService.createOrder({
      userId: loginResult.user.id,
      buyerName: 'Priya Sharma (E2E Test)',
      buyerEmail: 'priya.sharma@example.com',
      buyerPhone: '+91 98765 43210',
      shippingMethod: 'standard',
      paymentMethod: 'cod',
      deliveryAddress: { name: 'Priya Sharma' },
      lines: [{ productId: firstProduct.id, quantity: testOrderQty }],
      idempotencyKey, // same key
    });
    assert(duplicateOrder.orderNumber === codOrder.orderNumber, 'Duplicate order prevented, existing order returned');

    // TEST 7: Online Payment (Razorpay Sandbox) Order & Signature Verification
    console.log('\n[Test 7] Testing Online Payment Gateway & HMAC Signature Verification...');
    // Create an order for online payment
    const onlineOrder = await orderService.createOrder({
      userId: loginResult.user.id,
      buyerName: 'Vikram Mehta (E2E Test)',
      buyerEmail: 'vikram.mehta@example.com',
      buyerPhone: '+91 91234 56789',
      shippingMethod: 'express',
      paymentMethod: 'card',
      deliveryAddress: {
        name: 'Vikram Mehta',
        street: '12 Marine Drive',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400020',
        country: 'India',
        phone: '+91 91234 56789',
      },
      lines: [{ productId: firstProduct.id, quantity: testOrderQty }],
    });
    assert(onlineOrder.paymentStatus === 'PENDING', 'Initial payment status is PENDING');

    // Initiate Gateway Payment Order
    const paymentOrder = await paymentService.createPaymentOrder({ orderId: onlineOrder.id });
    assert(paymentOrder.paymentOrderId && paymentOrder.paymentOrderId.length > 5, `Gateway Order ID generated: ${paymentOrder.paymentOrderId}`);

    // Sandbox Simulation with HMAC Cryptographic Verification
    const verifiedResult = await paymentService.simulateSandboxPayment({
      orderId: onlineOrder.id,
      paymentOrderId: paymentOrder.paymentOrderId,
    });
    assert(verifiedResult.success, 'Gateway signature verification succeeded');
    assert(verifiedResult.order.paymentStatus === 'PAID', 'Order paymentStatus updated to PAID in MySQL');
    assert(verifiedResult.order.orderStatus === 'ORDER_CONFIRMED', 'Order orderStatus updated to ORDER_CONFIRMED');

    // Check payment record in MySQL
    const paymentRecord = await prisma.payment.findFirst({ where: { orderId: onlineOrder.id, status: 'PAID' } });
    assert(paymentRecord !== null, `Payment record stored in MySQL with Txn ID: ${paymentRecord?.transactionId}`);

    // TEST 8: Order Confirmation Email Dispatch & Template Rendering
    console.log('\n[Test 8] Testing Nodemailer Order Confirmation Email Delivery...');
    const emailResult = await sendOrderConfirmationEmail(verifiedResult.order);
    assert(emailResult && emailResult.messageId, `Email delivered with Message ID: ${emailResult.messageId}`);
    if (emailResult.previewUrl) {
      console.log(`    ✉️ Ethereal Email Preview: ${emailResult.previewUrl}`);
    }

    // TEST 9: Order Tracking API & Status History
    console.log('\n[Test 9] Testing Order Tracking & Multi-Stage Timeline...');
    const trackingData = await trackingService.getOrderTracking({ orderNumber: onlineOrder.orderNumber });
    assert(trackingData.orderNumber === onlineOrder.orderNumber, 'Tracking found by orderNumber');
    assert(trackingData.timeline.length === 6, 'All 6 lifecycle steps present in timeline');
    assert(trackingData.timeline[0].isCompleted && trackingData.timeline[1].isCompleted, 'Order Placed & Order Confirmed completed');

    // Lookup tracking by ID as well
    const trackingById = await trackingService.getOrderTracking({ orderNumber: onlineOrder.id });
    assert(trackingById.orderNumber === onlineOrder.orderNumber, 'Tracking found by database ID');

    // TEST 10: Status Progression Persistence
    console.log('\n[Test 10] Testing Status Progression to SHIPPED in MySQL...');
    await trackingService.updateOrderStatus({
      orderId: onlineOrder.id,
      status: 'SHIPPED',
      notes: 'Dispatched via BlueDart Air Express. AWB: BD-984729184.',
      changedBy: 'Logistics Manager',
    });

    const updatedTracking = await trackingService.getOrderTracking({ orderNumber: onlineOrder.orderNumber });
    assert(updatedTracking.orderStatus === 'SHIPPED', 'Order status updated to SHIPPED in MySQL');
    const shippedStep = updatedTracking.timeline.find((s) => s.statusKey === 'SHIPPED');
    assert(shippedStep.isCompleted, 'Timeline step SHIPPED marked completed');
    assert(shippedStep.notes.includes('BlueDart'), `Timeline note saved: "${shippedStep.notes}"`);

    // TEST 11: Buyer–Supplier Messaging System
    console.log('\n[Test 11] Testing Buyer-Supplier Messaging System & Persistence...');
    const msgService = await import('../src/services/messageService.js');
    const firstSupplier = await prisma.user.findFirst({ where: { role: 'SUPPLIER' } });
    const sampleProduct = await prisma.product.findFirst({ where: { supplierId: firstSupplier.id } });

    const msgConv = await msgService.createOrGetConversation({
      buyerId: loginResult.user.id,
      productId: sampleProduct.id,
      initialMessage: 'Automated test inquiry regarding bulk order specifications.',
    });
    assert(Boolean(msgConv.conversation.id), 'Messaging conversation created');
    assert(msgConv.conversation.unreadSupplier >= 1, 'Supplier unread counter incremented');

    const replyMsg = await msgService.sendMessage({
      conversationId: msgConv.conversation.id,
      senderId: firstSupplier.id,
      senderRole: 'SUPPLIER',
      content: 'We can fulfill bulk orders with customized packaging.',
    });
    assert(replyMsg.message.content.includes('customized packaging'), 'Supplier reply message persisted');

    const buyerConvs = await msgService.listConversations(loginResult.user.id, 'BUYER');
    assert(buyerConvs.some((c) => c.id === msgConv.conversation.id), 'Conversation listed in buyer inbox');

    const markedRead = await msgService.markConversationRead(msgConv.conversation.id, loginResult.user.id, 'BUYER');
    assert(markedRead.unreadBuyer === 0, 'Buyer unread count reset on markRead');

    console.log('\n====================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log('====================================================\n');
  } catch (error) {
    console.error('\n❌ VERIFICATION TEST FAILED:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runE2EVerification();
