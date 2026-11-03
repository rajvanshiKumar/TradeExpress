import { Router } from 'express';
import * as escrowController from '../controllers/escrowController.js';
import { authenticateJWT, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Escrow moves real money: platform-wide views and payout release are staff-only
router.use(authenticateJWT);

router.get('/summary', requireRole('ADMIN'), escrowController.getSummary);
router.get('/ledgers', requireRole('ADMIN', 'SUPPLIER'), escrowController.listLedgers);
router.post('/:orderId/release', requireRole('ADMIN'), escrowController.releasePayout);

export default router;
