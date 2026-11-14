import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as controller from '../controllers/supplierDocumentController.js';
import { authenticateJWT, requireRole } from '../middleware/authMiddleware.js';

// PDF generation is the costly part, so downloads have their own limit
const generationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many document requests. Please wait a minute and try again.' },
});

/** /api/buyer/documents: a buyer's own documents. No route accepts an external user ID, so only their own can be reached. */
export const buyerDocumentRouter = Router();
buyerDocumentRouter.use(authenticateJWT, requireRole('BUYER'));
buyerDocumentRouter.get('/', controller.getMine);
buyerDocumentRouter.get('/preview/:kind', generationLimiter, controller.previewMine);
buyerDocumentRouter.get('/certificate.pdf', generationLimiter, controller.certificateMine);
buyerDocumentRouter.get('/id-card.pdf', generationLimiter, controller.idCardMine);
buyerDocumentRouter.get('/photo', controller.photoMine);
buyerDocumentRouter.put('/photo', controller.updatePhotoMine);
buyerDocumentRouter.patch('/details', controller.updateDetailsMine);
buyerDocumentRouter.patch('/privacy', controller.updatePrivacyMine);

