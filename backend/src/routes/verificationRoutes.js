import { Router } from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import * as verificationController from '../controllers/verificationController.js';
import { authenticateJWT, optionalAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const isDev = process.env.NODE_ENV !== 'production';

// Rate limiter to prevent API abuse and paid credit depletion
const verificationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: isDev ? 100 : 15, // 15 calls per 10 min in prod
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many verification attempts from this connection. Please try again after 10 minutes.',
  },
});

/**
 * POST /api/verification/pan-aadhaar/link-status
 * Checks if Aadhaar is linked to PAN and returns masked PAN.
 * Accessible to authenticated users or during registration with statutory consent.
 */
router.post(
  '/pan-aadhaar/link-status',
  verificationLimiter,
  optionalAuth,
  validate([
    body('aadhaarNumber')
      .optional()
      .trim()
      .custom((val, { req }) => {
        const valToTest = val || req.body.aadhaar;
        if (!valToTest) {
          throw new Error('Aadhaar number is required.');
        }
        const digits = String(valToTest).replace(/\D/g, '');
        if (digits.length !== 12) {
          throw new Error('Aadhaar number must be exactly 12 digits.');
        }
        return true;
      }),
    body('userConsent')
      .optional()
      .custom((val, { req }) => {
        const consentVal = val !== undefined ? val : req.body.consent;
        if (consentVal !== true && consentVal !== 'true') {
          throw new Error('Explicit consent is required to verify PAN-Aadhaar link status.');
        }
        return true;
      }),
  ]),
  verificationController.getPanAadhaarLinkStatus
);

/**
 * GET /api/verification/pan-aadhaar/status
 * Fetches saved PAN-Aadhaar verification status for the logged-in user.
 */
router.get(
  '/pan-aadhaar/status',
  authenticateJWT,
  verificationController.getMyPanAadhaarStatus
);

export default router;
