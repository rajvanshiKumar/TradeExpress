import { Router } from 'express';
import { body } from 'express-validator';
import * as trackingController from '../controllers/trackingController.js';
import { authenticateJWT, optionalAuth, requireRole } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/:orderNumber', optionalAuth, trackingController.getTracking);

router.patch(
  '/:orderId/status',
  authenticateJWT,
  requireRole('ADMIN', 'SUPPLIER'),
  validate([
    body('status')
      .isIn([
        'ORDER_PLACED',
        'ORDER_CONFIRMED',
        'PROCESSING',
        'SHIPPED',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED',
        'REFUNDED',
      ])
      .withMessage('Invalid order tracking status.'),
  ]),
  trackingController.updateStatus
);

export default router;
