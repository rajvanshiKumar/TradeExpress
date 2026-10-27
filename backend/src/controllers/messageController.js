import * as messageService from '../services/messageService.js';
import { broadcastNewMessage, broadcastMessagesRead } from '../services/socketService.js';

/**
 * Create or retrieve a conversation.
 * POST /api/messages/conversations
 */
export async function createOrGetConversation(req, res, next) {
  try {
    const buyerId = req.user.id;
    const { supplierId, companyId, productId, rfqId, orderId, subject, initialMessage } = req.body;

    const result = await messageService.createOrGetConversation({
      buyerId,
      supplierId,
      companyId,
      productId,
      rfqId,
      orderId,
      subject,
      initialMessage,
    });

    if (initialMessage && result.conversation.messages?.length > 0) {
      const latestMessage = result.conversation.messages[result.conversation.messages.length - 1];
      broadcastNewMessage(result.conversation, latestMessage);
    }

    res.status(result.isNew ? 201 : 200).json({
      success: true,
      message: result.isNew ? 'Conversation created successfully.' : 'Existing conversation retrieved.',
      data: result.conversation,
      isNew: result.isNew,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List conversations for authenticated user.
 * GET /api/messages/conversations
 */
export async function getConversations(req, res, next) {
  try {
    const { search } = req.query;
    const conversations = await messageService.listConversations(
      req.user.id,
      req.user.role,
      search
    );

    res.json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single conversation by ID.
 * GET /api/messages/conversations/:id
 */
export async function getConversation(req, res, next) {
  try {
    const { id } = req.params;
    const conversation = await messageService.getConversationById(id, req.user);

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Send a message in a conversation.
 * POST /api/messages/conversations/:id/messages
 */
export async function sendMessage(req, res, next) {
  try {
    const { id } = req.params;
    const { content, text } = req.body;
    const messageContent = content || text;

    const result = await messageService.sendMessage({
      conversationId: id,
      senderId: req.user.id,
      senderRole: req.user.role,
      content: messageContent,
    });

    // Broadcast in real time via Socket.IO
    broadcastNewMessage(result.conversation, result.message);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully.',
      data: result.message,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mark a conversation as read.
 * PATCH /api/messages/conversations/:id/read
 */
export async function markRead(req, res, next) {
  try {
    const { id } = req.params;
    const updated = await messageService.markConversationRead(
      id,
      req.user.id,
      req.user.role
    );

    broadcastMessagesRead(id, req.user.id, req.user.role);

    res.json({
      success: true,
      message: 'Conversation marked as read.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get total unread count for current user.
 * GET /api/messages/unread-count
 */
export async function getUnreadCount(req, res, next) {
  try {
    const count = await messageService.getUnreadCount(req.user.id, req.user.role);

    res.json({
      success: true,
      data: {
        unreadCount: count,
      },
    });
  } catch (error) {
    next(error);
  }
}
