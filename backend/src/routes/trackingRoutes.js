import { Router } from 'express';
import * as trackingController from '../controllers/trackingController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Order status changes are not made here: suppliers prepare orders in Orders, and shipping / delivery are recorded
// in Transport & Delivery Management (/api/transport).
router.get('/:orderNumber', optionalAuth, trackingController.getTracking);

export default router;
