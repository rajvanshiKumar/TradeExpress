import prisma from '../src/config/db.js';
import * as authService from '../src/services/authService.js';
import * as messageService from '../src/services/messageService.js';

async function runMessagingVerification() {
  console.log('====================================================');
  console.log('🧪 Starting Buyer-Supplier Messaging Test Suite');
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
    // 1. Get Buyer & Supplier users
    console.log('[Test 1] Verifying buyer and supplier existence...');
    const buyer = await prisma.user.findFirst({
      where: { role: 'BUYER' },
    });
    assert(Boolean(buyer), `Buyer found: ${buyer.name} (${buyer.email})`);

    const supplier = await prisma.user.findFirst({
      where: { role: 'SUPPLIER' },
    });
    assert(Boolean(supplier), `Supplier found: ${supplier.name} (${supplier.company})`);

    const otherSupplier = await prisma.user.findFirst({
      where: { role: 'SUPPLIER', id: { not: supplier.id } },
    });
    assert(Boolean(otherSupplier), `Other supplier found: ${otherSupplier.name} (${otherSupplier.company})`);

    const product = await prisma.product.findFirst({
      where: { supplierId: supplier.id },
    });
    assert(Boolean(product), `Product for supplier found: ${product.name}`);

    // Clean up any test conversations between buyer and supplier for this product
    await prisma.conversation.deleteMany({
      where: { buyerId: buyer.id, supplierId: supplier.id, productId: product.id },
    });

    // 2. Create Conversation
    console.log('\n[Test 2] Creating conversation from buyer...');
    const created = await messageService.createOrGetConversation({
      buyerId: buyer.id,
      productId: product.id,
      initialMessage: 'Hello, is this product available for wholesale bulk delivery?',
    });

    assert(Boolean(created.conversation.id), `Conversation created with ID: ${created.conversation.id}`);
    assert(created.isNew === true, 'Conversation was marked as new');
    assert(created.conversation.messages.length === 1, 'Initial message was attached');
    assert(created.conversation.unreadSupplier === 1, 'Supplier unread count is 1');
    assert(created.conversation.unreadBuyer === 0, 'Buyer unread count is 0');

    // 3. Prevent duplicate conversation
    console.log('\n[Test 3] Verifying duplicate conversation prevention...');
    const retrieved = await messageService.createOrGetConversation({
      buyerId: buyer.id,
      productId: product.id,
    });
    assert(retrieved.conversation.id === created.conversation.id, 'Existing conversation ID was returned');
    assert(retrieved.isNew === false, 'isNew is false for duplicate attempt');

    // 4. Supplier sends a reply message
    console.log('\n[Test 4] Supplier replying to conversation...');
    const replyResult = await messageService.sendMessage({
      conversationId: created.conversation.id,
      senderId: supplier.id,
      senderRole: 'SUPPLIER',
      content: 'Yes, we have ready stock in warehouse. What quantity do you need?',
    });
    assert(replyResult.message.content.includes('ready stock'), 'Reply message saved');
    assert(replyResult.conversation.unreadBuyer === 1, 'Buyer unread count incremented to 1');

    // 5. List conversations for Buyer and Supplier
    console.log('\n[Test 5] Checking conversation listing and scoping...');
    const buyerConvs = await messageService.listConversations(buyer.id, 'BUYER');
    assert(buyerConvs.some((c) => c.id === created.conversation.id), 'Buyer sees conversation');

    const supplierConvs = await messageService.listConversations(supplier.id, 'SUPPLIER');
    assert(supplierConvs.some((c) => c.id === created.conversation.id), 'Supplier sees conversation');

    const otherSupplierConvs = await messageService.listConversations(otherSupplier.id, 'SUPPLIER');
    assert(!otherSupplierConvs.some((c) => c.id === created.conversation.id), 'Other supplier CANNOT see conversation');

    // 6. Security & Access Control
    console.log('\n[Test 6] Testing access control and authorization...');
    try {
      await messageService.getConversationById(created.conversation.id, otherSupplier);
      assert(false, 'Other supplier was allowed to access conversation!');
    } catch (err) {
      assert(err.status === 403, `Access denied with 403 Forbidden: ${err.message}`);
    }

    try {
      await messageService.sendMessage({
        conversationId: created.conversation.id,
        senderId: otherSupplier.id,
        senderRole: 'SUPPLIER',
        content: 'I should not be able to post here',
      });
      assert(false, 'Other supplier was allowed to send message!');
    } catch (err) {
      assert(err.status === 403, `Send message denied with 403 Forbidden: ${err.message}`);
    }

    // 7. Mark as read
    console.log('\n[Test 7] Marking conversation as read...');
    const readByBuyer = await messageService.markConversationRead(
      created.conversation.id,
      buyer.id,
      'BUYER'
    );
    assert(readByBuyer.unreadBuyer === 0, 'Buyer unread count reset to 0');

    // 8. Unread counts aggregate
    console.log('\n[Test 8] Checking unread count aggregate...');
    const buyerUnread = await messageService.getUnreadCount(buyer.id, 'BUYER');
    assert(typeof buyerUnread === 'number', `Buyer unread count: ${buyerUnread}`);

    console.log(`\n====================================================`);
    console.log(`🎉 All ${passedTests}/${totalTests} messaging tests PASSED!`);
    console.log(`====================================================`);
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMessagingVerification();
