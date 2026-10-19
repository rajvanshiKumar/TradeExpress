import { Router } from 'express';
import { body } from 'express-validator';
import * as authController from '../controllers/authController.js';
import { authenticateJWT } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.post(
  '/register',
  validate([
    body('email').isEmail().withMessage('Valid email is required.'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
    body('name').trim().notEmpty().withMessage('Name is required.'),
  ]),
  authController.register
);

router.post(
  '/login',
  validate([
    body('email').custom((val) => val === 'admin' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)).withMessage('Valid email is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ]),
  authController.login
);

router.get('/me', authenticateJWT, authController.me);
router.put('/profile', authenticateJWT, authController.updateProfile);
router.post(
  '/change-password',
  authenticateJWT,
  validate([
    body('currentPassword').notEmpty().withMessage('Current password is required.'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters.'),
  ]),
  authController.changePassword
);

router.post(
  '/forgot-password',
  validate([body('email').isEmail().withMessage('Valid email is required.')]),
  authController.forgotPassword
);

router.post(
  '/reset-password',
  validate([
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters.'),
  ]),
  authController.resetPassword
);

router.post('/kyc', authenticateJWT, authController.submitKyc);
router.get('/kyc', authenticateJWT, authController.getKyc);

router.get('/addresses', authenticateJWT, authController.getAddresses);
router.post(
  '/addresses',
  authenticateJWT,
  validate([
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('phone').trim().notEmpty().withMessage('Phone is required.'),
    body('street').trim().notEmpty().withMessage('Street address is required.'),
    body('city').trim().notEmpty().withMessage('City is required.'),
    body('postalCode').trim().notEmpty().withMessage('Postal code is required.'),
  ]),
  authController.addAddress
);

export default router;
