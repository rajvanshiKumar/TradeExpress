import { Router } from 'express';
import * as ticketController from '../controllers/ticketController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(optionalAuth);

router.post('/', ticketController.createTicket);
router.get('/', ticketController.getTickets);
router.get('/:id', ticketController.getTicketById);
router.post('/:id/messages', ticketController.addMessage);
router.patch('/:id/status', ticketController.updateStatus);

export default router;
