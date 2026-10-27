import { Router } from 'express';
import * as messageController from '../controllers/messageController.js';
import { authenticateJWT } from '../middleware/authMiddleware.js';

const router = Router();

// All message APIs require authentication
router.use(authenticateJWT);

// Unread count
router.get('/unread-count', messageController.getUnreadCount);

// Conversations endpoints
router.post('/conversations', messageController.createOrGetConversation);
router.get('/conversations', messageController.getConversations);
router.get('/conversations/:id', messageController.getConversation);
router.post('/conversations/:id/messages', messageController.sendMessage);
router.patch('/conversations/:id/read', messageController.markRead);

// Aliases for mounting at /api/conversations or direct paths
router.post('/', messageController.createOrGetConversation);
router.get('/', messageController.getConversations);
router.get('/:id', messageController.getConversation);
router.post('/:id/messages', messageController.sendMessage);
router.patch('/:id/read', messageController.markRead);

export default router;
