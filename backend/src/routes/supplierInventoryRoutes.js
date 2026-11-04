import { Router } from 'express';
import { body, param } from 'express-validator';
import * as supplierInventoryController from '../controllers/supplierInventoryController.js';
import { authenticateJWT, requireRole, requireSuperAdmin } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Protect all inventory routes: only authenticated suppliers and admins
router.use(authenticateJWT, requireRole('SUPPLIER', 'ADMIN'));

router.get('/', supplierInventoryController.listInventory);

// Platform-wide check that stored reserved/committed figures match open orders (Super Admin only)
router.get('/reconciliation', requireSuperAdmin, supplierInventoryController.getReconciliation);

router.get(
  '/:productId/detail',
  validate([param('productId').notEmpty().withMessage('Product ID is required.')]),
  supplierInventoryController.getProductDetail
);

router.post(
  '/:productId/adjust',
  validate([
    param('productId').notEmpty().withMessage('Product ID is required.'),
    body('adjustmentType')
      .optional()
      .isIn(['ADD', 'SET', 'SUBTRACT'])
      .withMessage('Adjustment type must be ADD, SET, or SUBTRACT.'),
    body('quantity')
      .isInt({ min: 0 })
      .withMessage('Quantity must be a valid non-negative integer.'),
    body('reason')
      .trim()
      .notEmpty()
      .withMessage('Adjustment reason is mandatory for inventory audit trail.'),
  ]),
  supplierInventoryController.adjustStock
);

router.get(
  '/:productId/history',
  validate([param('productId').notEmpty().withMessage('Product ID is required.')]),
  supplierInventoryController.getInventoryHistory
);

router.patch(
  '/:productId/settings',
  validate([param('productId').notEmpty().withMessage('Product ID is required.')]),
  supplierInventoryController.updateSettings
);

export default router;

