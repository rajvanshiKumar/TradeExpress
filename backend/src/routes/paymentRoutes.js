import { Router } from 'express';
import { body } from 'express-validator';
import * as paymentController from '../controllers/paymentController.js';
import { validate } from '../middleware/validate.js';
import { authenticateJWT } from '../middleware/authMiddleware.js';

const router = Router();

router.post(
  '/create-order',
  authenticateJWT,
  validate([body('orderId').trim().notEmpty().withMessage('Order ID is required.')]),
  paymentController.createPaymentOrder
);

router.post(
  '/verify',
  authenticateJWT,
  validate([
    body('orderId').trim().notEmpty().withMessage('Order ID is required.'),
    body('paymentOrderId').trim().notEmpty().withMessage('Payment Order ID is required.'),
    body('transactionId').trim().notEmpty().withMessage('Transaction ID is required.'),
    body('signature').trim().notEmpty().withMessage('Payment signature is required.'),
  ]),
  paymentController.verifyPayment
);

router.post(
  '/sandbox-pay',
  authenticateJWT,
  validate([
    body('orderId').trim().notEmpty().withMessage('Order ID is required.'),
    body('paymentOrderId').trim().notEmpty().withMessage('Payment Order ID is required.'),
  ]),
  paymentController.sandboxSimulate
);

// Webhook endpoint verified cryptographically via HMAC SHA-256 with raw body
router.post('/webhook', paymentController.handleWebhook);

export default router;

