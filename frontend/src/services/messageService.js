import { apiGet, apiPost, apiPatch } from './apiClient';

const messageService = {
  /**
   * List conversations for authenticated user.
   */
  async listConversations(search = '') {
    const path = search?.trim()
      ? `messages/conversations?search=${encodeURIComponent(search.trim())}`
      : 'messages/conversations';
    const res = await apiGet(path);
    return res.data || [];
  },

  /**
   * Fetch single conversation by ID with full details.
   */
  async getConversation(id) {
    const res = await apiGet(`messages/conversations/${id}`);
    return res.data;
  },

  /**
   * Create or retrieve an existing conversation with a supplier.
   */
  async createOrGetConversation({ supplierId, companyId, productId, rfqId, orderId, subject, initialMessage }) {
    const res = await apiPost('messages/conversations', {
      supplierId,
      companyId,
      productId,
      rfqId,
      orderId,
      subject,
      initialMessage,
    });
    return res.data;
  },

  /**
   * Send a message to a conversation.
   */
  async sendMessage(conversationId, content) {
    const res = await apiPost(`messages/conversations/${conversationId}/messages`, {
      content,
    });
    return res.data;
  },

  /**
   * Mark conversation messages as read.
   */
  async markRead(conversationId) {
    const res = await apiPatch(`messages/conversations/${conversationId}/read`);
    return res.data;
  },

  /**
   * Get total unread messages count for badges.
   */
  async getUnreadCount() {
    try {
      const res = await apiGet('messages/unread-count');
      return res.data?.unreadCount || 0;
    } catch {
      return 0;
    }
  },
};

export default messageService;
