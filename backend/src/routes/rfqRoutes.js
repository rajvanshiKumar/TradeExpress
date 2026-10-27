import { Router } from 'express';
import { body } from 'express-validator';
import * as rfqController from '../controllers/rfqController.js';
import { authenticateJWT, optionalAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/', optionalAuth, rfqController.listRfqs);
router.post(
  '/',
  optionalAuth,
  validate([
    body('title').notEmpty().withMessage('Title is required.'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1.'),
  ]),
  rfqController.createRfq
);

router.get('/:id', optionalAuth, rfqController.getRfq);
router.get('/:id/comparison', optionalAuth, rfqController.getRfqComparison);
router.put('/:id/comparison', authenticateJWT, rfqController.saveComparison);

router.post(
  '/:id/quote',
  authenticateJWT,
  validate([
    body('unitPrice').isFloat({ min: 0.01 }).withMessage('Unit price must be greater than 0.'),
    body('leadTimeDays').isInt({ min: 1 }).withMessage('Lead time days must be at least 1.'),
  ]),
  rfqController.submitQuote
);

router.post(
  '/quotes/:quoteId/counter',
  optionalAuth,
  validate([
    body('unitPrice').isFloat({ min: 0.01 }).withMessage('Counter unit price must be greater than 0.'),
  ]),
  rfqController.counterQuote
);

router.post('/quotes/:quoteId/accept', optionalAuth, rfqController.acceptQuote);
router.post('/quotes/:quoteId/reject', optionalAuth, rfqController.rejectQuote);

export default router;
