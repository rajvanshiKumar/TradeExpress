import { Router } from 'express';
import { body } from 'express-validator';
import * as reviewController from '../controllers/reviewController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/order/:orderId', optionalAuth, reviewController.getReviewForOrder);
router.get('/product/:productId', optionalAuth, reviewController.getProductReviews);

router.post(
  '/:orderId',
  optionalAuth,
  validate([
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Overall rating must be between 1 and 5.'),
  ]),
  reviewController.createReview
);

export default router;
