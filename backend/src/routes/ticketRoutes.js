import { Router } from 'express';
import * as ticketController from '../controllers/ticketController.js';
import { authenticateJWT, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Every ticket action requires a signed-in user; ownership is checked per ticket
router.use(authenticateJWT);

router.post('/', ticketController.createTicket);
router.get('/', ticketController.getTickets);
router.get('/:id', ticketController.getTicketById);
router.post('/:id/messages', ticketController.addMessage);
router.patch('/:id/status', requireRole('ADMIN'), ticketController.updateStatus);

export default router;
