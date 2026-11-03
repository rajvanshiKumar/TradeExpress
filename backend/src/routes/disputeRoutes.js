import { Router } from 'express';
import { body } from 'express-validator';
import * as disputeController from '../controllers/disputeController.js';
import { authenticateJWT, requireRole } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Every dispute action requires a signed-in user; access to each dispute is checked in the controller
router.use(authenticateJWT);

router.get('/', disputeController.listDisputes);
router.get('/:id', disputeController.getDispute);

router.post(
  '/:orderId',
  requireRole('BUYER'),
  validate([
    body('reason').notEmpty().withMessage('Dispute reason is required.'),
    body('description').isLength({ min: 10 }).withMessage('Description must be at least 10 characters.'),
  ]),
  disputeController.createDispute
);

router.post(
  '/:id/messages',
  validate([
    body('message').notEmpty().withMessage('Message text is required.'),
  ]),
  disputeController.addMessage
);

router.post(
  '/:id/resolve',
  requireRole('ADMIN'),
  validate([
    body('action').isIn(['APPROVE_FULL_REFUND', 'APPROVE_PARTIAL_REFUND', 'REJECT']).withMessage('Valid resolution action is required.'),
  ]),
  disputeController.resolveDispute
);

export default router;
