import { Router } from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(optionalAuth);

router.get('/', notificationController.getNotifications);
router.post('/', notificationController.createNotification);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', notificationController.markAsRead);

export default router;
