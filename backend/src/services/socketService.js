import { Server as SocketIOServer } from 'socket.io';
import { verifyJwt } from '../utils/jwt.js';
import prisma from '../config/db.js';
import * as messageService from './messageService.js';

let io = null;

export function initSocket(httpServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => callback(null, true),
      credentials: true,
      methods: ['GET', 'POST', 'PATCH'],
    },
    pingTimeout: 30000,
    pingInterval: 10000,
  });

  // JWT Socket Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const rawToken =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
        socket.handshake.query?.token;

      if (!rawToken) {
        return next(new Error('Authentication token required for Socket connection.'));
      }

      const decoded = verifyJwt(rawToken);
      if (!decoded || !decoded.userId) {
        return next(new Error('Invalid or expired token for Socket connection.'));
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          company: true,
          isActive: true,
          status: true,
        },
      });

      if (!user || user.isActive === false || user.status === 'SUSPENDED') {
        return next(new Error('User account is inactive or suspended.'));
      }

      socket.user = user;
      next();
    } catch (err) {
      next(new Error(`Socket authentication error: ${err.message}`));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    // Join private user room for notifications and unread badges
    socket.join(`user:${userId}`);

    // Join conversation room with participant verification
    socket.on('join_conversation', async ({ conversationId }, callback) => {
      try {
        const canAccess = await messageService.verifyConversationAccess(conversationId, socket.user);
        if (!canAccess) {
          if (callback) callback({ error: 'Unauthorized to join this conversation' });
          return;
        }
        socket.join(`conversation:${conversationId}`);
        if (callback) callback({ success: true });
      } catch (err) {
        if (callback) callback({ error: err.message });
      }
    });

    // Leave conversation room
    socket.on('leave_conversation', ({ conversationId }) => {
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
      }
    });

    // Send a message over socket
    socket.on('send_message', async ({ conversationId, content }, callback) => {
      try {
        const result = await messageService.sendMessage({
          conversationId,
          senderId: socket.user.id,
          senderRole: socket.user.role,
          content,
        });

        // Broadcast to conversation room
        io.to(`conversation:${conversationId}`).emit('new_message', result.message);

        // Notify both participants in their personal user rooms
        const { conversation } = result;
        io.to(`user:${conversation.buyerId}`).emit('conversation_updated', conversation);
        io.to(`user:${conversation.supplierId}`).emit('conversation_updated', conversation);

        if (callback) callback({ success: true, data: result.message });
      } catch (err) {
        if (callback) callback({ error: err.message });
      }
    });

    // Mark as read over socket
    socket.on('mark_read', async ({ conversationId }, callback) => {
      try {
        const updated = await messageService.markConversationRead(
          conversationId,
          socket.user.id,
          socket.user.role
        );

        io.to(`conversation:${conversationId}`).emit('messages_read', {
          conversationId,
          readBy: socket.user.id,
          role: socket.user.role,
        });

        io.to(`user:${socket.user.id}`).emit('unread_count_updated', {
          conversationId,
        });

        if (callback) callback({ success: true, data: updated });
      } catch (err) {
        if (callback) callback({ error: err.message });
      }
    });

    // Typing indicators
    socket.on('typing', ({ conversationId, isTyping }) => {
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit('user_typing', {
          conversationId,
          userId: socket.user.id,
          userName: socket.user.name,
          isTyping: Boolean(isTyping),
        });
      }
    });

    socket.on('disconnect', () => {
      // Automatic cleanup
    });
  });

  return io;
}

export function getIO() {
  return io;
}

/**
 * Broadcasts a new message to the conversation room and personal rooms.
 */
export function broadcastNewMessage(conversation, message) {
  if (!io) return;
  io.to(`conversation:${conversation.id}`).emit('new_message', message);
  io.to(`user:${conversation.buyerId}`).emit('conversation_updated', conversation);
  io.to(`user:${conversation.supplierId}`).emit('conversation_updated', conversation);
}

/**
 * Broadcasts read status to the conversation room.
 */
export function broadcastMessagesRead(conversationId, userId, role) {
  if (!io) return;
  io.to(`conversation:${conversationId}`).emit('messages_read', {
    conversationId,
    readBy: userId,
    role,
  });
  io.to(`user:${userId}`).emit('unread_count_updated', { conversationId });
}
