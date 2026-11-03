import { Router } from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { authenticateJWT, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Users read and update only their own notifications; only staff can create one for another user
router.use(authenticateJWT);

router.get('/', notificationController.getNotifications);
router.post('/', requireRole('ADMIN'), notificationController.createNotification);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', notificationController.markAsRead);

export default router;
