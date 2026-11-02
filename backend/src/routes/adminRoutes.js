import { Router } from 'express';
import { body } from 'express-validator';
import * as adminController from '../controllers/adminController.js';
import { authenticateJWT, requireRole } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Protect all admin endpoints
router.use(authenticateJWT, requireRole('ADMIN'));

router.get('/kyc', adminController.getKycList);
router.post(
  '/kyc/:userId/review',
  validate([
    body('status').isIn(['APPROVED', 'VERIFIED', 'REJECTED']).withMessage('Status must be APPROVED or REJECTED.'),
  ]),
  adminController.reviewKyc
);

router.get('/products/moderation', adminController.getProductsForModeration);
router.post(
  '/products/:productId/moderate',
  validate([
    body('status').isIn(['APPROVED', 'REJECTED']).withMessage('Status must be APPROVED or REJECTED.'),
  ]),
  adminController.moderateProduct
);

router.get('/commission', adminController.getCommission);
router.post(
  '/commission',
  validate([
    body('percentage').isFloat({ min: 0, max: 100 }).withMessage('Percentage must be between 0 and 100.'),
  ]),
  adminController.setCommission
);

export default router;
