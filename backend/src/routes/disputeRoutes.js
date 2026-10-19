import { Router } from 'express';
import { body } from 'express-validator';
import * as disputeController from '../controllers/disputeController.js';
import { authenticateJWT, optionalAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/', optionalAuth, disputeController.listDisputes);
router.get('/:id', optionalAuth, disputeController.getDispute);

router.post(
  '/:orderId',
  optionalAuth,
  validate([
    body('reason').notEmpty().withMessage('Dispute reason is required.'),
    body('description').isLength({ min: 10 }).withMessage('Description must be at least 10 characters.'),
  ]),
  disputeController.createDispute
);

router.post(
  '/:id/messages',
  optionalAuth,
  validate([
    body('message').notEmpty().withMessage('Message text is required.'),
  ]),
  disputeController.addMessage
);

router.post(
  '/:id/resolve',
  optionalAuth,
  validate([
    body('action').isIn(['APPROVE_FULL_REFUND', 'APPROVE_PARTIAL_REFUND', 'REJECT']).withMessage('Valid resolution action is required.'),
  ]),
  disputeController.resolveDispute
);

export default router;
