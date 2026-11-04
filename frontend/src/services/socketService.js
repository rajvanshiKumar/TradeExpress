import { io } from 'socket.io-client';
import { getAuthToken } from '../utils/authSession.js';

let socket = null;
let socketToken = '';

function getSocketUrl() {
  const apiBase = (import.meta.env.VITE_PUBLIC_API_BASE_URL || 'http://localhost:5000/api').trim();
  // Strip trailing '/api' or '/api/' to get root server URL
  return apiBase.replace(/\/api\/?$/, '') || 'http://localhost:5000';
}

/**
 * Connect to Socket.IO server with JWT authentication.
 */
export function connectSocket() {
  const token = getAuthToken();
  if (!token) {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    return null;
  }

  // If already connected with same token, reuse. A different token means this window changed role.
  if (socket?.connected && socketToken === token) {
    return socket;
  }
  if (socket) socket.disconnect();
  socketToken = token;

  const url = getSocketUrl();
  socket = io(url, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 10000,
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket.IO] Connection error:', err.message);
  });

  return socket;
}

/**
 * Disconnect socket.
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Get current socket instance or initialize if token exists.
 */
export function getSocket() {
  if (!socket) {
    return connectSocket();
  }
  return socket;
}

/**
 * Join conversation room for real-time messages.
 */
export function joinConversationRoom(conversationId) {
  const s = getSocket();
  if (s && conversationId) {
    s.emit('join_conversation', { conversationId });
  }
}

/**
 * Leave conversation room.
 */
export function leaveConversationRoom(conversationId) {
  const s = getSocket();
  if (s && conversationId) {
    s.emit('leave_conversation', { conversationId });
  }
}

/**
 * Emit typing indicator.
 */
export function emitTyping(conversationId, isTyping) {
  const s = getSocket();
  if (s && conversationId) {
    s.emit('typing', { conversationId, isTyping });
  }
}
