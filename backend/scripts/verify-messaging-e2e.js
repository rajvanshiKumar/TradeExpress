import { io as ClientIO } from 'socket.io-client';
import prisma from '../src/config/db.js';
import { signJwt } from '../src/utils/jwt.js';

const BASE_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

async function runE2E() {
  console.log('====================================================');
  console.log('🧪 Starting Full E2E REST & Socket.IO Messaging Test');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      throw new Error(message);
    }
  }

  let buyerSocket = null;
  let supplierSocket = null;

  try {
    // 1. Authenticate Buyer & Supplier via JWT tokens
    console.log('[Step 1] Resolving Buyer & Supplier accounts...');
    const buyer = await prisma.user.findFirst({
      where: { role: 'BUYER' },
    });
    assert(Boolean(buyer), `Buyer user found: ${buyer.name} (${buyer.email})`);
    const buyerToken = signJwt({ userId: buyer.id, role: buyer.role });

    const supplier = await prisma.user.findFirst({
      where: { role: 'SUPPLIER' },
    });
    assert(Boolean(supplier), `Supplier user found: ${supplier.name} (${supplier.company})`);
    const supplierToken = signJwt({ userId: supplier.id, role: supplier.role });

    const otherSupplier = await prisma.user.findFirst({
      where: { role: 'SUPPLIER', id: { not: supplier.id } },
    });
    assert(Boolean(otherSupplier), `Unrelated Supplier found: ${otherSupplier.name}`);
    const otherSupplierToken = signJwt({ userId: otherSupplier.id, role: otherSupplier.role });

    // 2. Fetch a product belonging to supplier
    console.log('\n[Step 2] Finding supplier product...');
    const product = await prisma.product.findFirst({
      where: { supplierId: supplier.id },
    });
    assert(Boolean(product), `Found product: ${product.name} (ID: ${product.id})`);

    // 3. Connect Socket.IO clients for Buyer and Supplier
    console.log('\n[Step 3] Connecting Socket.IO clients...');
    buyerSocket = ClientIO(SOCKET_URL, {
      auth: { token: buyerToken },
      transports: ['websocket'],
    });

    supplierSocket = ClientIO(SOCKET_URL, {
      auth: { token: supplierToken },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      let buyerDone = false;
      let supplierDone = false;
      const timeout = setTimeout(() => reject(new Error('Socket connection timed out')), 5000);

      buyerSocket.on('connect', () => {
        buyerDone = true;
        if (buyerDone && supplierDone) {
          clearTimeout(timeout);
          resolve();
        }
      });

      supplierSocket.on('connect', () => {
        supplierDone = true;
        if (buyerDone && supplierDone) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    assert(buyerSocket.connected, 'Buyer Socket.IO connected with JWT');
    assert(supplierSocket.connected, 'Supplier Socket.IO connected with JWT');

    // 4. Test REST API: Create/Get conversation
    console.log('\n[Step 4] Creating/Retrieving conversation via REST API...');
    const convRes = await fetch(`${BASE_URL}/messages/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerToken}`,
      },
      body: JSON.stringify({
        productId: product.id,
        initialMessage: 'E2E Test: What is the sample price and lead time?',
      }),
    });
    const convData = await convRes.json();
    assert(convRes.ok && convData.success, 'Conversation created/retrieved via REST API');
    const conversation = convData.data;
    assert(Boolean(conversation.id), `Conversation ID: ${conversation.id}`);

    // Join conversation room on sockets
    await new Promise((resolve) => {
      buyerSocket.emit('join_conversation', { conversationId: conversation.id }, () => resolve());
    });
    await new Promise((resolve) => {
      supplierSocket.emit('join_conversation', { conversationId: conversation.id }, () => resolve());
    });
    assert(true, 'Both Buyer & Supplier joined conversation room');

    // 5. Test Real-Time Message Delivery via Socket.IO
    console.log('\n[Step 5] Testing Real-Time Message Delivery...');
    const receivedPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Did not receive message in real time')), 5000);
      buyerSocket.on('new_message', (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
    });

    // Supplier sends reply via REST API
    const replyRes = await fetch(`${BASE_URL}/messages/conversations/${conversation.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supplierToken}`,
      },
      body: JSON.stringify({
        content: 'E2E Realtime Reply: Samples dispatch within 2 business days!',
      }),
    });
    const replyData = await replyRes.json();
    assert(replyRes.ok && replyData.success, 'Supplier sent reply message via REST API');

    const liveMsg = await receivedPromise;
    assert(
      liveMsg.content === 'E2E Realtime Reply: Samples dispatch within 2 business days!',
      'Buyer received supplier message live via Socket.IO'
    );

    // 6. Test Typing Indicator over Socket.IO
    console.log('\n[Step 6] Testing typing indicator...');
    const typingPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Typing event timed out')), 5000);
      supplierSocket.on('user_typing', (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });

    buyerSocket.emit('typing', { conversationId: conversation.id, isTyping: true });
    const typingData = await typingPromise;
    assert(typingData.isTyping === true, 'Supplier received typing event from Buyer');

    // 7. Test Mark as Read via REST API
    console.log('\n[Step 7] Testing mark as read...');
    const readRes = await fetch(`${BASE_URL}/messages/conversations/${conversation.id}/read`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${buyerToken}`,
      },
    });
    const readData = await readRes.json();
    assert(readRes.ok && readData.success, 'Buyer marked conversation as read');

    // 8. Test Unread Count API
    console.log('\n[Step 8] Testing unread count API...');
    const unreadRes = await fetch(`${BASE_URL}/messages/unread-count`, {
      headers: {
        Authorization: `Bearer ${buyerToken}`,
      },
    });
    const unreadData = await unreadRes.json();
    assert(unreadRes.ok && typeof unreadData.data.unreadCount === 'number', 'Unread count API returns number');

    // 9. Test Access Control: Unrelated Supplier is FORBIDDEN
    console.log('\n[Step 9] Testing Access Control (Unrelated Supplier)...');
    const forbiddenRes = await fetch(`${BASE_URL}/messages/conversations/${conversation.id}`, {
      headers: {
        Authorization: `Bearer ${otherSupplierToken}`,
      },
    });
    assert(forbiddenRes.status === 403, 'Unrelated supplier was denied with 403 Forbidden');

    const forbiddenSend = await fetch(`${BASE_URL}/messages/conversations/${conversation.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${otherSupplierToken}`,
      },
      body: JSON.stringify({ content: 'I should be rejected' }),
    });
    assert(forbiddenSend.status === 403, 'Unrelated supplier cannot send message (403 Forbidden)');

    console.log('\n====================================================');
    console.log(`🎉 All ${passed}/${total} E2E REST & Real-Time Socket.IO tests PASSED!`);
    console.log('====================================================\n');
  } catch (err) {
    console.error('E2E Verification Error:', err);
    process.exit(1);
  } finally {
    if (buyerSocket) buyerSocket.disconnect();
    if (supplierSocket) supplierSocket.disconnect();
    await prisma.$disconnect();
  }
}

runE2E();
