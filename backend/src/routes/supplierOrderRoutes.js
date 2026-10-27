import { Router } from 'express';
import { body } from 'express-validator';
import * as supplierOrderController from '../controllers/supplierOrderController.js';
import { authenticateJWT, requireRole } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(authenticateJWT, requireRole('SUPPLIER', 'ADMIN'));

router.get('/', supplierOrderController.getOrders);
router.post('/:orderId/accept', supplierOrderController.acceptOrder);
router.post('/:orderId/reject', supplierOrderController.rejectOrder);
router.patch(
  '/:orderId/status',
  validate([
    body('status')
      .isIn(['ORDER_CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'])
      .withMessage('Valid status required.'),
  ]),
  supplierOrderController.updateStatus
);
router.post(
  '/:orderId/dispatch',
  validate([
    body('carrierName').trim().notEmpty().withMessage('Carrier name is required.'),
    body('trackingNumber').trim().notEmpty().withMessage('Tracking / LR number is required.'),
  ]),
  supplierOrderController.dispatchOrder
);

export default router;
