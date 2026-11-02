import { Router } from 'express';
import * as cartController from '../controllers/cartController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', optionalAuth, cartController.getCart);
router.post('/sync', optionalAuth, cartController.syncCart);

export default router;
