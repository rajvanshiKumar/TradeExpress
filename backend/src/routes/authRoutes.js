import { Router } from 'express';
import { body, param } from 'express-validator';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/authController.js';
import { authenticateJWT, requireRole } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { validatePassword } from '../utils/passwordValidator.js';

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

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many sign-in attempts. Please try again in 15 minutes.' },
});

/** Standard Password Validation Middleware Rule */
const passwordValidationRule = body('password').custom((value) => {
  const result = validatePassword(value);
  if (!result.isValid) {
    throw new Error(result.message);
  }
  return true;
});

const newPasswordValidationRule = body('newPassword').custom((value) => {
  const result = validatePassword(value);
  if (!result.isValid) {
    throw new Error(result.message);
  }
  return true;
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
    body('otp').trim().isLength({ min: 6, max: 6 }).isNumeric().withMessage('Enter the 6-digit verification code.'),
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
  '/send-email-verification-otp',
  otpSendLimiter,
  validate([
    body('email').isEmail().withMessage('Valid email is required.'),
  ]),
  authController.sendEmailVerificationOtp
);

router.post(
  '/verify-email-verification-otp',
  otpVerifyLimiter,
  validate([
    body('email').isEmail().withMessage('Valid email is required.'),
    body('otp').trim().isLength({ min: 6, max: 6 }).isNumeric().withMessage('Enter the 6-digit verification code.'),
  ]),
  authController.verifyEmailVerificationOtp
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
    passwordValidationRule,
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('phone').trim().notEmpty().withMessage('Mobile number is required.'),
    body('verificationToken').optional().trim(),
    body('emailVerificationToken').optional().trim(),
  ]),
  authController.register
);

router.post(
  '/google',
  authRateLimiter,
  validate([
    // Only Google's one-time authorization code is accepted; identity comes from Google, never the browser
    body('code').isString().trim().isLength({ min: 10, max: 2048 }).withMessage('Google sign-in code is missing. Please try again.'),
    body('role').optional().isIn(['BUYER', 'SUPPLIER', 'buyer', 'supplier']).withMessage('Role must be Buyer or Supplier.'),
  ]),
  authController.googleAuth
);

router.post(
  '/register-buyer',
  authRateLimiter,
  validate([
    body('email').isEmail().withMessage('Valid email is required.'),
    body('name').isString().trim().isLength({ min: 2, max: 120 }).withMessage('Full name must be between 2 and 120 characters.'),
    body('phone').isString().trim().notEmpty().withMessage('Mobile number is required.'),
    // Password is optional for buyers (they sign in with a code or Google); when sent it must be valid
    body('password').optional({ values: 'falsy' }).isString().custom((value) => {
      const result = validatePassword(value);
      if (!result.isValid) throw new Error(result.message);
      return true;
    }),
    body('confirmPassword').optional({ values: 'falsy' }).isString().custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match.'),
    body('verificationToken').isString().notEmpty().withMessage('Mobile verification is required.'),
    body('emailVerificationToken').isString().notEmpty().withMessage('Email verification is required.'),
  ]),
  authController.registerBuyer
);

router.post(
  '/register-supplier',
  authRateLimiter,
  validate([
    body('email').isEmail().withMessage('Valid email is required.'),
    passwordValidationRule,
    body('name').trim().notEmpty().withMessage('Full name is required.'),
    body('company').trim().notEmpty().withMessage('Company name is required.'),
    body('phone').trim().notEmpty().withMessage('Mobile number is required.'),
    body('country').trim().notEmpty().withMessage('Country is required.'),
    body('businessType').trim().notEmpty().withMessage('Business type is required.'),
    body('companyDescription').trim().notEmpty().withMessage('Company description is required.'),
  ]),
  authController.registerSupplier
);

router.post(
  '/login',
  loginRateLimiter,
  validate([
    body('email').isString().custom((val) =>
      val === 'admin' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) || /^\+?[0-9][0-9\s()-]{6,17}$/.test(val)
    ).withMessage('Enter a valid email address or mobile number.'),
    body('country').optional().isString().trim().notEmpty(),
    body('otp').optional({ nullable: true }).trim(),
    body('password').optional({ nullable: true }).isString().isLength({ max: 128 }),
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
    newPasswordValidationRule,
  ]),
  authController.changePassword
);

router.post(
  '/forgot-password',
  authRateLimiter,
  validate([body('email').isEmail().withMessage('Valid email is required.')]),
  authController.forgotPassword
);

router.post(
  '/reset-password',
  authRateLimiter,
  validate([
    newPasswordValidationRule,
  ]),
  authController.resetPassword
);

// Seller business verification: the signup details plus KYC, always for the authenticated seller only
router.get('/kyc', authenticateJWT, requireRole('SUPPLIER'), authController.getKyc);
router.post(
  '/kyc',
  authenticateJWT,
  requireRole('SUPPLIER'),
  validate([
    body('submit').optional().isBoolean().withMessage('submit must be true or false.'),
    body('business').optional().isObject().withMessage('business must be an object.'),
    body('statutory').optional().isObject().withMessage('statutory must be an object.'),
    body('warehouse').optional().isObject().withMessage('warehouse must be an object.'),
    body('documents').optional().isArray({ max: 20 }).withMessage('documents must be a list of up to 20 files.'),
  ]),
  authController.submitKyc
);

// Buyer address book. The owner is always the authenticated user, never a client-supplied id.
const addressBodyRules = [
  body('firstName').isString().trim().notEmpty().withMessage('First name is required.'),
  body('lastName').isString().trim().notEmpty().withMessage('Last name is required.'),
  body('phone').isString().trim().notEmpty().withMessage('Phone number is required.'),
  body('street').isString().trim().notEmpty().withMessage('Street address or P.O. box is required.'),
  body('apartment').optional({ nullable: true }).isString().withMessage('Apartment must be text.'),
  body('city').isString().trim().notEmpty().withMessage('City is required.'),
  body('state').isString().trim().notEmpty().withMessage('State / province is required.'),
  body('postalCode').isString().trim().notEmpty().withMessage('Postal code is required.'),
  body('country').optional().isString().trim().notEmpty().withMessage('Country / region is required.'),
  body('isDefault').optional().isBoolean().withMessage('isDefault must be true or false.'),
];
const addressIdRule = param('id').isUUID().withMessage('Invalid address id.');
const buyerOnly = [authenticateJWT, requireRole('BUYER')];

router.get('/addresses', ...buyerOnly, authController.getAddresses);
router.post('/addresses', ...buyerOnly, validate(addressBodyRules), authController.addAddress);
router.put('/addresses/:id', ...buyerOnly, validate([addressIdRule, ...addressBodyRules]), authController.updateAddress);
router.patch('/addresses/:id/default', ...buyerOnly, validate([addressIdRule]), authController.setDefaultAddress);
router.delete('/addresses/:id', ...buyerOnly, validate([addressIdRule]), authController.deleteAddress);

router.post('/logout', authenticateJWT, authController.logout);

export default router;
