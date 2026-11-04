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

/** /api/supplier/documents: a supplier's own documents. No route accepts a supplier ID, so only their own can be reached. */
export const supplierDocumentRouter = Router();
supplierDocumentRouter.use(authenticateJWT, requireRole('SUPPLIER'));
supplierDocumentRouter.get('/', controller.getMine);
supplierDocumentRouter.get('/preview/:kind', generationLimiter, controller.previewMine);
supplierDocumentRouter.get('/certificate.pdf', generationLimiter, controller.certificateMine);
supplierDocumentRouter.get('/id-card.pdf', generationLimiter, controller.idCardMine);
supplierDocumentRouter.get('/photo', controller.photoMine);
supplierDocumentRouter.put('/photo', controller.updatePhotoMine);
supplierDocumentRouter.patch('/details', controller.updateDetailsMine);
supplierDocumentRouter.patch('/privacy', controller.updatePrivacyMine);

/** /api/public/suppliers: what anyone sees after scanning a QR code. */
export const publicSupplierRouter = Router();
publicSupplierRouter.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please wait a minute and try again.' },
}));
publicSupplierRouter.get('/:code', controller.publicProfile);
publicSupplierRouter.get('/:code/photo', controller.publicPhoto);
