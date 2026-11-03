import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import * as accountController from '../controllers/accountController.js';
import { authenticateJWT, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Account Settings: signed-in Buyers, Suppliers and Super Admins manage only their own account
router.use(authenticateJWT, requireRole('BUYER', 'SUPPLIER', 'SUPER_ADMIN'));

const accountWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many account changes. Please wait a few minutes and try again.' },
});

// Codes, password and email changes: a tighter limit on top of the per-code limits in the service
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many security requests. Please wait a few minutes and try again.' },
});

// Held in memory so the image content can be checked before anything is written to disk
const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

function handleAvatarUpload(req, res, next) {
  avatarUpload.single('photo')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Profile photos must be 2 MB or smaller.' : 'The photo could not be uploaded.';
      return res.status(400).json({ success: false, message });
    }
    return next();
  });
}

router.get('/settings', accountController.getSettings);
router.patch('/profile', accountWriteLimiter, accountController.updateProfile);
router.post('/avatar', accountWriteLimiter, handleAvatarUpload, accountController.uploadAvatar);
router.delete('/avatar', accountWriteLimiter, accountController.deleteAvatar);

router.post('/verification/send', sensitiveLimiter, accountController.sendVerificationCode);
router.post('/verification/verify', sensitiveLimiter, accountController.verifyVerificationCode);
router.post('/password/change', sensitiveLimiter, accountController.changePassword);
router.post('/email/request-change', sensitiveLimiter, accountController.requestEmailChange);
router.post('/email/verify-new', sensitiveLimiter, accountController.verifyNewEmail);

export default router;
