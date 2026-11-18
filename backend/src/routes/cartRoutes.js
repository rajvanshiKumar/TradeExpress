import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as cartController from '../controllers/cartController.js';
import { authenticateJWT, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// The cart belongs to the signed-in buyer; guests keep a cart in their own browser until they sign in
router.use(authenticateJWT, requireRole('BUYER'));
const cartWriteLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many cart changes. Please wait a moment.' } });

router.get('/', cartController.getCart);
router.post('/items', cartWriteLimiter, cartController.addItem);
router.patch('/items/:itemId', cartWriteLimiter, cartController.updateItem);
router.delete('/items/:itemId', cartWriteLimiter, cartController.removeItem);
router.delete('/', cartWriteLimiter, cartController.clearCart);
router.post('/merge', cartWriteLimiter, cartController.mergeItems);

export default router;
