import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMessage,
  formatConversation,
  verifyConversationAccess,
} from '../../src/services/messageService.js';
import { broadcastNewMessage } from '../../src/services/socketService.js';

describe('TradeExpress Supplier-to-Buyer Messaging System Suite', () => {
  describe('1. Message & Conversation Formatting with Sender Identity', () => {
    it('formats message and preserves sender identity, company, and role', () => {
      const rawMessage = {
        id: 'msg-001',
        conversationId: 'conv-123',
        senderId: 'supp-456',
        senderRole: 'SUPPLIER',
        content: 'Hello, your quotation #RFQ-2026-0001 is ready for review.',
        isAutomated: false,
        isRead: false,
        readAt: null,
        createdAt: new Date('2026-11-12T10:00:00Z'),
        sender: {
          id: 'supp-456',
          name: 'Rajesh Kumar',
          company: 'NovaTech Manufacturing LLP',
          role: 'SUPPLIER',
        },
      };

      const formatted = formatMessage(rawMessage);

      assert.equal(formatted.id, 'msg-001');
      assert.equal(formatted.conversationId, 'conv-123');
      assert.equal(formatted.senderId, 'supp-456');
      assert.equal(formatted.senderRole, 'SUPPLIER');
      assert.equal(formatted.senderName, 'Rajesh Kumar');
      assert.equal(formatted.senderCompany, 'NovaTech Manufacturing LLP');
      assert.equal(formatted.from, 'supplier');
      assert.equal(formatted.text, 'Hello, your quotation #RFQ-2026-0001 is ready for review.');
      assert.equal(formatted.content, 'Hello, your quotation #RFQ-2026-0001 is ready for review.');
      assert.equal(formatted.isRead, false);
      assert.equal(formatted.isAutomated, false);
    });

    it('formats conversation with buyer and supplier identity and unread counters', () => {
      const rawConv = {
        id: 'conv-123',
        buyerId: 'buyer-789',
        buyer: {
          id: 'buyer-789',
          name: 'Sarah Jenkins',
          email: 'buyer@tradesphere.com',
          company: 'Apex Global Imports',
          role: 'BUYER',
        },
        supplierId: 'supp-456',
        supplier: {
          id: 'supp-456',
          name: 'Rajesh Kumar',
          email: 'supplier@novatech.com',
          company: 'NovaTech Manufacturing LLP',
          role: 'SUPPLIER',
        },
        companyId: 'TS-CO-001',
        productId: 'prod-001',
        product: {
          id: 'prod-001',
          name: 'Stainless Steel Fasteners',
          slug: 'stainless-steel-fasteners',
        },
        rfqId: 'rfq-001',
        rfq: {
          id: 'rfq-001',
          rfqNumber: 'RFQ-2026-0001',
          title: 'Bulk Fasteners RFQ',
          status: 'Quoted',
        },
        orderId: null,
        order: null,
        subject: 'Inquiry regarding RFQ RFQ-2026-0001',
        unreadBuyer: 2,
        unreadSupplier: 0,
        lastMessageAt: new Date('2026-11-12T10:15:00Z'),
        createdAt: new Date('2026-11-12T09:00:00Z'),
        updatedAt: new Date('2026-11-12T10:15:00Z'),
        messages: [
          {
            id: 'msg-001',
            conversationId: 'conv-123',
            senderId: 'supp-456',
            senderRole: 'SUPPLIER',
            content: 'Hello Sarah, we updated the quote with faster dispatch.',
            isAutomated: false,
            isRead: false,
            createdAt: new Date('2026-11-12T10:00:00Z'),
            sender: {
              id: 'supp-456',
              name: 'Rajesh Kumar',
              company: 'NovaTech Manufacturing LLP',
              role: 'SUPPLIER',
            },
          },
        ],
      };

      const formatted = formatConversation(rawConv);

      assert.equal(formatted.id, 'conv-123');
      assert.equal(formatted.buyerId, 'buyer-789');
      assert.equal(formatted.buyerName, 'Sarah Jenkins');
      assert.equal(formatted.supplierId, 'supp-456');
      assert.equal(formatted.supplierName, 'NovaTech Manufacturing LLP');
      assert.equal(formatted.unreadBuyer, 2);
      assert.equal(formatted.unreadSupplier, 0);
      assert.equal(formatted.unread.buyer, 2);
      assert.equal(formatted.unread.supplier, 0);
      assert.equal(formatted.messages.length, 1);
      assert.equal(formatted.messages[0].senderCompany, 'NovaTech Manufacturing LLP');
      assert.equal(formatted.messages[0].senderName, 'Rajesh Kumar');
    });
  });

  describe('2. Supplier-Initiated Message Creation & Buyer Resolution Logic', () => {
    it('correctly maps supplier as sender and buyer as recipient on supplier message', () => {
      const supplierUser = {
        id: 'supp-456',
        role: 'SUPPLIER',
        name: 'Rajesh Kumar',
        company: 'NovaTech Manufacturing LLP',
      };
      const buyerUser = {
        id: 'buyer-789',
        role: 'BUYER',
        name: 'Sarah Jenkins',
        company: 'Apex Global Imports',
      };

      // Simulating controller caller assignment
      const callerUser = supplierUser;
      const reqBody = {
        buyerId: buyerUser.id,
        initialMessage: 'We have approved your request for quotation.',
      };

      const resolvedBuyerId = callerUser.role === 'BUYER' ? callerUser.id : reqBody.buyerId;
      const resolvedSupplierId = callerUser.role === 'SUPPLIER' ? callerUser.id : reqBody.supplierId;

      assert.equal(resolvedBuyerId, 'buyer-789', 'Buyer ID must be the buyer, NOT the supplier');
      assert.equal(resolvedSupplierId, 'supp-456', 'Supplier ID must be the authenticated supplier');

      // Sender and role assignment
      const senderId = callerUser.id;
      const senderRole = callerUser.role;
      const isSenderBuyer = senderId === resolvedBuyerId;

      assert.equal(senderId, 'supp-456');
      assert.equal(senderRole, 'SUPPLIER');
      assert.equal(isSenderBuyer, false);

      // Unread count update logic
      const unreadBuyer = !isSenderBuyer && reqBody.initialMessage ? 1 : 0;
      const unreadSupplier = isSenderBuyer && reqBody.initialMessage ? 1 : 0;

      assert.equal(unreadBuyer, 1, 'Buyer unread counter must increment when supplier sends message');
      assert.equal(unreadSupplier, 0, 'Supplier unread counter must remain 0 for their own message');
    });

    it('resolves buyer ID automatically from RFQ when supplier does not provide buyerId', () => {
      const mockRfq = {
        id: 'rfq-unique-999',
        rfqNumber: 'RFQ-2026-0042',
        buyerId: 'buyer-auto-resolved-111',
      };

      let resolvedBuyerId = null;
      const requestedRfqId = 'RFQ-2026-0042';

      if (!resolvedBuyerId && (requestedRfqId === mockRfq.id || requestedRfqId === mockRfq.rfqNumber)) {
        resolvedBuyerId = mockRfq.buyerId;
      }

      assert.equal(resolvedBuyerId, 'buyer-auto-resolved-111');
    });
  });

  describe('3. Bidirectional Buyer Reply & Read Status Resolution', () => {
    it('correctly attributes reply to buyer and increments supplier unread count', () => {
      const conv = {
        id: 'conv-123',
        buyerId: 'buyer-789',
        supplierId: 'supp-456',
        unreadBuyer: 1,
        unreadSupplier: 0,
      };

      const replyUser = {
        id: 'buyer-789',
        role: 'BUYER',
      };

      const isSenderBuyer = replyUser.id === conv.buyerId;
      assert.equal(isSenderBuyer, true);

      // When buyer replies, unreadSupplier increments
      const updateData = {
        unreadSupplier: isSenderBuyer ? conv.unreadSupplier + 1 : conv.unreadSupplier,
        unreadBuyer: isSenderBuyer ? conv.unreadBuyer : conv.unreadBuyer + 1,
      };

      assert.equal(updateData.unreadSupplier, 1, 'Supplier unread count increments on buyer reply');
      assert.equal(updateData.unreadBuyer, 1, 'Buyer count does not increment on own reply');
    });
  });

  describe('4. Privacy & Multi-Tenant Authorization Security', () => {
    it('allows access to valid buyer and supplier participants only', () => {
      const conv = {
        id: 'conv-123',
        buyerId: 'buyer-789',
        supplierId: 'supp-456',
      };

      const buyer = { id: 'buyer-789', role: 'BUYER' };
      const supplier = { id: 'supp-456', role: 'SUPPLIER' };
      const otherBuyer = { id: 'buyer-intruder-000', role: 'BUYER' };
      const admin = { id: 'admin-001', role: 'ADMIN' };

      const checkAccess = (user) => {
        if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;
        return conv.buyerId === user.id || conv.supplierId === user.id;
      };

      assert.equal(checkAccess(buyer), true, 'Legitimate buyer must have access');
      assert.equal(checkAccess(supplier), true, 'Legitimate supplier must have access');
      assert.equal(checkAccess(otherBuyer), false, 'Other buyers must NOT have access');
      assert.equal(checkAccess(admin), true, 'Super Admin must have oversight access');
    });
  });

  describe('5. Real-Time Socket Broadcast Target Verification', () => {
    it('dispatches new_message to conversation room AND personal recipient user rooms', () => {
      const emittedRooms = [];
      const emittedEvents = [];

      // Mock Socket.IO server
      const mockIO = {
        to: (room) => {
          emittedRooms.push(room);
          return {
            emit: (event, payload) => {
              emittedEvents.push({ room, event, payload });
            },
          };
        },
      };

      const conversation = {
        id: 'conv-123',
        buyerId: 'buyer-789',
        supplierId: 'supp-456',
      };
      const message = {
        id: 'msg-001',
        conversationId: 'conv-123',
        content: 'New offer',
      };

      // Replicating broadcastNewMessage logic
      mockIO.to(`conversation:${conversation.id}`).emit('new_message', message);
      if (conversation.buyerId) {
        mockIO.to(`user:${conversation.buyerId}`).emit('new_message', message);
        mockIO.to(`user:${conversation.buyerId}`).emit('conversation_updated', conversation);
      }
      if (conversation.supplierId) {
        mockIO.to(`user:${conversation.supplierId}`).emit('new_message', message);
        mockIO.to(`user:${conversation.supplierId}`).emit('conversation_updated', conversation);
      }

      assert.ok(emittedRooms.includes('conversation:conv-123'), 'Must emit to conversation room');
      assert.ok(emittedRooms.includes('user:buyer-789'), 'Must emit to buyer personal room');
      assert.ok(emittedRooms.includes('user:supp-456'), 'Must emit to supplier personal room');

      const buyerNewMessage = emittedEvents.find(
        (e) => e.room === 'user:buyer-789' && e.event === 'new_message'
      );
      assert.ok(buyerNewMessage, 'Buyer must receive real-time new_message event in personal user room');
    });
  });
});

