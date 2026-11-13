import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sideFor } from '../src/utils/messageUtils.js';

describe('Frontend Supplier-to-Buyer Messaging Integration Suite', () => {
  describe('1. Role & Side Resolution Logic', () => {
    it('accurately resolves participant side regardless of case', () => {
      assert.equal(sideFor({ role: 'buyer' }), 'buyer');
      assert.equal(sideFor({ role: 'BUYER' }), 'buyer');
      assert.equal(sideFor({ role: 'supplier' }), 'supplier');
      assert.equal(sideFor({ role: 'SUPPLIER' }), 'supplier');
      assert.equal(sideFor(null), 'buyer');
    });
  });

  describe('2. Real-Time Conversation Stream & Unread Calculation', () => {
    it('appends incoming supplier message and increments buyer unread counter', () => {
      const initialConversations = [
        {
          id: 'conv-100',
          buyerId: 'buyer-001',
          supplierId: 'supp-001',
          supplier: { name: 'Rajesh Kumar', company: 'NovaTech Manufacturing' },
          messages: [
            {
              id: 'msg-1',
              conversationId: 'conv-100',
              senderId: 'buyer-001',
              from: 'buyer',
              content: 'Can you deliver 100 units by next Monday?',
              createdAt: '2026-11-12T10:00:00Z',
            },
          ],
          unread: { buyer: 0, supplier: 1 },
          lastMessageAt: '2026-11-12T10:00:00Z',
        },
      ];

      const incomingSupplierMessage = {
        id: 'msg-2',
        conversationId: 'conv-100',
        senderId: 'supp-001',
        senderRole: 'SUPPLIER',
        senderName: 'Rajesh Kumar',
        senderCompany: 'NovaTech Manufacturing',
        from: 'supplier',
        content: 'Yes, we have ready warehouse stock for immediate dispatch.',
        createdAt: '2026-11-12T10:05:00Z',
      };

      // Simulating handleNewMessage logic from MessageContext
      const currentUserId = 'buyer-001';
      const userSide = 'buyer';
      const activeConversationId = null; // Buyer on dashboard or another page

      const convIndex = initialConversations.findIndex((c) => c.id === incomingSupplierMessage.conversationId);
      assert.ok(convIndex !== -1, 'Target conversation must exist in state');

      const conv = initialConversations[convIndex];
      const alreadyHas = conv.messages?.some((m) => m.id === incomingSupplierMessage.id);
      const updatedMessages = alreadyHas ? conv.messages : [...(conv.messages || []), incomingSupplierMessage];

      const isMine = incomingSupplierMessage.senderId === currentUserId;
      const isActive = activeConversationId === conv.id;

      const updatedConv = {
        ...conv,
        messages: updatedMessages,
        lastMessageAt: incomingSupplierMessage.createdAt,
        unread: {
          ...conv.unread,
          [userSide]: isMine || isActive ? 0 : (conv.unread?.[userSide] ?? 0) + 1,
        },
      };

      assert.equal(updatedConv.messages.length, 2);
      assert.equal(updatedConv.messages[1].content, 'Yes, we have ready warehouse stock for immediate dispatch.');
      assert.equal(updatedConv.messages[1].senderCompany, 'NovaTech Manufacturing');
      assert.equal(updatedConv.messages[1].senderName, 'Rajesh Kumar');
      assert.equal(updatedConv.unread.buyer, 1, 'Buyer unread count must increment by 1');
      assert.equal(updatedConv.lastMessageAt, '2026-11-12T10:05:00Z');
    });

    it('prevents duplicate message additions when message was already received or optimistically added', () => {
      const messages = [
        { id: 'msg-1', content: 'First message' },
        { id: 'msg-2', content: 'Second message' },
      ];

      const duplicateMessage = { id: 'msg-2', content: 'Second message' };
      const alreadyHas = messages.some((m) => m.id === duplicateMessage.id);
      const updatedMessages = alreadyHas ? messages : [...messages, duplicateMessage];

      assert.equal(updatedMessages.length, 2, 'Message count must remain exactly 2');
    });
  });

  describe('3. Deep Linking & Query Parameter Navigation', () => {
    it('matches existing conversation by RFQ number or buyer ID', () => {
      const conversations = [
        {
          id: 'conv-abc',
          rfqId: 'rfq-uuid-1',
          rfq: { rfqNumber: 'RFQ-2026-0001' },
          buyerId: 'buyer-111',
        },
        {
          id: 'conv-def',
          rfqId: 'rfq-uuid-2',
          rfq: { rfqNumber: 'RFQ-2026-0002' },
          buyerId: 'buyer-222',
        },
      ];

      const searchParams = new URLSearchParams('rfq=RFQ-2026-0002&buyerId=buyer-222');
      const rfqParam = searchParams.get('rfq');
      const buyerParam = searchParams.get('buyerId');

      const matched = conversations.find((c) => {
        if (rfqParam && (c.rfqId === rfqParam || c.rfq?.rfqNumber === rfqParam)) return true;
        if (buyerParam && c.buyerId === buyerParam) return true;
        return false;
      });

      assert.ok(matched);
      assert.equal(matched.id, 'conv-def');
    });
  });
});
