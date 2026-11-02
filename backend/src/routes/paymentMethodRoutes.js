import { Router } from 'express';
import { body, param } from 'express-validator';
import * as controller from '../controllers/paymentMethodController.js';
import { authenticateJWT, requireRole } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Buyer saved payment methods. The owner is always the authenticated user, never a client-supplied id.
router.use(authenticateJWT, requireRole('BUYER'));

const idRule = param('id').isUUID().withMessage('Invalid payment method id.');

router.get('/', controller.listPaymentMethods);
router.get('/gateway', controller.getGatewayMethods);
router.post('/cards/session', controller.startCardSession);
router.post(
  '/cards/complete',
  validate([
    body('razorpayOrderId').isString().matches(/^order_[A-Za-z0-9]+$/).withMessage('Invalid gateway order id.'),
    body('razorpayPaymentId').isString().matches(/^pay_[A-Za-z0-9]+$/).withMessage('Invalid gateway payment id.'),
    body('razorpaySignature').isString().matches(/^[a-f0-9]{64}$/).withMessage('Invalid gateway signature.'),
  ]),
  controller.completeCardSession
);
router.patch('/:id/default', validate([idRule]), controller.setDefaultPaymentMethod);
router.post('/:id/verify', validate([idRule]), controller.verifyPaymentMethod);
router.delete('/:id', validate([idRule]), controller.removePaymentMethod);

export default router;
