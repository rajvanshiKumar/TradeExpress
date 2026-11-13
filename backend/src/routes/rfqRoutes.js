import { Router } from 'express';
import { body } from 'express-validator';
import * as rfqController from '../controllers/rfqController.js';
import { authenticateJWT, optionalAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/', optionalAuth, rfqController.listRfqs);
router.get('/matching-suppliers', optionalAuth, rfqController.getMatchingSuppliers);
router.post(
  '/',
  optionalAuth,
  validate([
    body('title').custom((value, { req }) => {
      if (value && String(value).trim()) return true;
      if (req.body.products && Array.isArray(req.body.products) && req.body.products.length > 0) return true;
      if (req.body.items && Array.isArray(req.body.items) && req.body.items.length > 0) return true;
      throw new Error('Title or at least one product is required.');
    }),
    body('quantity').custom((value, { req }) => {
      if (value !== undefined && value !== null && parseInt(value, 10) >= 1) return true;
      if (req.body.products && Array.isArray(req.body.products) && req.body.products.length > 0) return true;
      if (req.body.items && Array.isArray(req.body.items) && req.body.items.length > 0) return true;
      throw new Error('Quantity must be at least 1.');
    }),
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
