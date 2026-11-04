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
      .isIn(['ORDER_CONFIRMED', 'PROCESSING', 'PACKED'])
      .withMessage('Suppliers can set Confirmed, Processing or Packed. Shipping and delivery are recorded in Transport & Delivery.'),
  ]),
  supplierOrderController.updateStatus
);

export default router;
