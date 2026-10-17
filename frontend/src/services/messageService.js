import seedConversations from '../data/conversations';
import { STORAGE_KEYS } from '../utils/constants';
import { createCollection } from './localCollection';
import makeId from '../utils/ids';

const conversations = createCollection(STORAGE_KEYS.conversations, seedConversations);

const AUTO_REPLIES = [
  'Thanks for your message. Our sales team will review the details and come back with pricing and lead time.',
  'Noted. Could you confirm the quantity and destination port so we can prepare an accurate quote?',
  'Thank you. We can arrange a sample before bulk production if that helps.',
];

const messageService = {
  listConversations: (options) => conversations.list(options),
  saveConversations: (records) => conversations.saveAll(records),

  buildMessage: (from, text) => ({ id: makeId('TS-M'), from, text: text.trim(), at: new Date().toISOString() }),

  /** A clearly labelled automated reply so a new conversation gets an acknowledgement. */
  buildAutoReply() {
    const text = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
    return { id: makeId('TS-M'), from: 'supplier', automated: true, text, at: new Date().toISOString() };
  },

  buildConversation({ buyer, company, product, subject }) {
    return {
      id: makeId('TS-C'), buyerId: buyer.id, buyerName: buyer.name, companyId: company.id,
      productId: product?.id ?? null, subject: subject || (product ? product.name : `Enquiry for ${company.name}`),
      unread: { buyer: 0, supplier: 0 }, messages: [],
    };
  },
};

export default messageService;
