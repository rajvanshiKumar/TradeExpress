import { Router } from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/authController.js';
import { authenticateJWT } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const isDev = process.env.NODE_ENV !== 'production';

const otpSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: isDev ? 100 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP requests from this connection. Please try again after 10 minutes.',
  },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: isDev ? 200 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP verification attempts. Please wait 10 minutes before retrying.',
  },
});

router.post(
  '/send-mobile-otp',
  otpSendLimiter,
  validate([
    body('phone').trim().notEmpty().withMessage('Mobile number is required.'),
  ]),
  authController.sendMobileOtp
);

router.post(
  '/verify-mobile-otp',
  otpVerifyLimiter,
  validate([
    body('phone').trim().notEmpty().withMessage('Mobile number is required.'),
    body('otp').trim().notEmpty().withMessage('OTP is required.').isLength({ min: 4, max: 9 }).withMessage('Valid OTP code is required.'),
  ]),
  authController.verifyMobileOtp
);

router.post(
  '/resend-mobile-otp',
  otpSendLimiter,
  validate([
    body('phone').trim().notEmpty().withMessage('Mobile number is required.'),
  ]),
  authController.resendMobileOtp
);

router.post(
  '/send-email-otp',
  otpSendLimiter,
  validate([
    body('email').isEmail().withMessage('Valid email is required.'),
  ]),
  authController.sendEmailOtp
);

router.post(
  '/verify-email-otp',
  otpVerifyLimiter,
  validate([
    body('email').isEmail().withMessage('Valid email is required.'),
    body('otp').trim().notEmpty().withMessage('OTP is required.').isLength({ min: 4, max: 9 }).withMessage('Valid OTP code is required.'),
  ]),
  authController.verifyEmailOtp
);

router.post(
  '/send-mobile-login-otp',
  otpSendLimiter,
  validate([
    body('phone').trim().notEmpty().withMessage('Mobile number is required.'),
  ]),
  authController.sendMobileLoginOtp
);

router.post(
  '/login-mobile',
  authRateLimiter,
  validate([
    body('phone').trim().notEmpty().withMessage('Mobile number is required.'),
    body('otp').trim().notEmpty().withMessage('OTP is required.'),
  ]),
  authController.loginMobile
);

router.post(
  '/admin-login',
  authRateLimiter,
  validate([
    body('email').trim().notEmpty().withMessage('Admin email is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ]),
  authController.adminLogin
);

router.post(
  '/register',
  authRateLimiter,
  validate([
    body('email').isEmail().withMessage('Valid email is required.'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('phone').trim().notEmpty().withMessage('Mobile number is required.'),
    body('verificationToken').optional().trim(),
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
