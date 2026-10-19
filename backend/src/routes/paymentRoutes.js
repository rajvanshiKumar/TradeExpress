import { Router } from 'express';
import { body } from 'express-validator';
import * as paymentController from '../controllers/paymentController.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.post(
  '/create-order',
  validate([body('orderId').notEmpty().withMessage('Order ID is required.')]),
  paymentController.createPaymentOrder
);

router.post(
  '/verify',
  validate([
    body('orderId').notEmpty().withMessage('Order ID is required.'),
    body('paymentOrderId').notEmpty().withMessage('Payment Order ID is required.'),
    body('transactionId').notEmpty().withMessage('Transaction ID is required.'),
    body('signature').notEmpty().withMessage('Payment signature is required.'),
  ]),
  paymentController.verifyPayment
);

router.post(
  '/sandbox-pay',
  validate([
    body('orderId').notEmpty().withMessage('Order ID is required.'),
    body('paymentOrderId').notEmpty().withMessage('Payment Order ID is required.'),
  ]),
  paymentController.sandboxSimulate
);

router.post('/webhook', paymentController.handleWebhook);

export default router;

