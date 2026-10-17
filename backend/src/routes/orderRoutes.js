import { Router } from 'express';
import { body } from 'express-validator';
import * as orderController from '../controllers/orderController.js';
import { authenticateJWT, optionalAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.post('/calculate', orderController.calculateTotals);

router.post(
  '/',
  optionalAuth,
  validate([
    body('buyerName').trim().notEmpty().withMessage('Buyer name is required.'),
    body('buyerEmail').isEmail().withMessage('Valid buyer email is required.'),
    body('buyerPhone').trim().notEmpty().withMessage('Buyer phone is required.'),
    body('deliveryAddress').notEmpty().withMessage('Delivery address is required.'),
    body('lines').isArray({ min: 1 }).withMessage('At least one item is required in the order.'),
  ]),
  orderController.createOrder
);

router.get('/my-orders', authenticateJWT, orderController.getMyOrders);
router.get('/:identifier', optionalAuth, orderController.getOrder);

export default router;
