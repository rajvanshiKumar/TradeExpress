import { Router } from 'express';
import * as escrowController from '../controllers/escrowController.js';
import { authenticateJWT, optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/summary', optionalAuth, escrowController.getSummary);
router.get('/ledgers', optionalAuth, escrowController.listLedgers);
router.post('/:orderId/release', optionalAuth, escrowController.releasePayout);

export default router;
