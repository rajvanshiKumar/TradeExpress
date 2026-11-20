import { Router } from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import * as supplierProductController from '../controllers/supplierProductController.js';
import * as listingAiController from '../controllers/listingAiController.js';
import { authenticateJWT, requireRole } from '../middleware/authMiddleware.js';
import { uploadMemory } from '../middleware/uploadMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Require supplier or admin role
router.use(authenticateJWT, requireRole('SUPPLIER', 'ADMIN'));

// Product Listing AI: photos -> suggested details (each job uses paid AI quota, so starts are limited per supplier)
const isProduction = process.env.NODE_ENV === 'production';
const aiJobLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isProduction ? 20 : 200,
  keyGenerator: (req) => `ai-listing:${req.user.id}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'AI_LISTING_LIMIT', message: 'You have used the AI listing assistant many times this hour. Please try again later.' },
});
const aiPollLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, keyGenerator: (req) => `ai-listing-poll:${req.user.id}`, standardHeaders: true, legacyHeaders: false });
router.get('/ai-listing/status', listingAiController.status);
router.post(
  '/ai-listing',
  aiJobLimiter,
  validate([
    body('photos').isArray({ min: 1, max: 5 }).withMessage('Send between 1 and 5 product photos.'),
    body('photos.*').isString().isLength({ min: 1, max: 600 }).withMessage('Each photo must be an uploaded photo address.'),
  ]),
  listingAiController.startJob,
);
router.get('/ai-listing/:token', aiPollLimiter, listingAiController.getJob);

router.get('/', supplierProductController.listProducts);
router.get('/bulk/template', supplierProductController.downloadBulkTemplate);
router.post('/bulk/upload', uploadMemory.single('file'), supplierProductController.handleBulkUpload);
router.get('/:id', supplierProductController.getProduct);

router.post(
  '/',
  (req, res, next) => {
    if (!req.body.categorySlug && req.body.category) {
      req.body.categorySlug = req.body.category;
    }
    next();
  },
  validate([
    body('name').trim().notEmpty().withMessage('Product name is required.'),
    body('categorySlug').trim().notEmpty().withMessage('Category is required.'),
    body('price').isFloat({ min: 0.01 }).withMessage('Base price must be greater than zero.'),
    body('moq').isInt({ min: 1 }).withMessage('MOQ must be at least 1.'),
    body('stock').isInt({ min: 0 }).withMessage('Stock must be zero or more.'),
    body('images')
      .optional()
      .custom((val) => {
        if (val !== undefined && val !== null) {
          if (!Array.isArray(val)) {
            throw new Error('Images must be an array of image URLs.');
          }
          if (val.length > 8) {
            throw new Error('Maximum 8 product images allowed.');
          }
        }
        return true;
      }),
    body('videoUrl')
      .optional({ nullable: true })
      .isString()
      .withMessage('Video URL must be a string path or URL.'),
  ]),
  supplierProductController.createProduct
);

router.put(
  '/:id',
  validate([
    body('name').optional().trim().notEmpty().withMessage('Product name cannot be empty.'),
    body('price').optional().isFloat({ min: 0.01 }).withMessage('Base price must be greater than zero.'),
    body('moq').optional().isInt({ min: 1 }).withMessage('MOQ must be at least 1.'),
    body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be zero or more.'),
    body('images')
      .optional()
      .custom((val) => {
        if (val !== undefined && val !== null) {
          if (!Array.isArray(val)) {
            throw new Error('Images must be an array of image URLs.');
          }
          if (val.length > 8) {
            throw new Error('Maximum 8 product images allowed.');
          }
        }
        return true;
      }),
    body('videoUrl')
      .optional({ nullable: true })
      .isString()
      .withMessage('Video URL must be a string path or URL.'),
  ]),
  supplierProductController.updateProduct
);

router.delete('/:id', supplierProductController.deleteProduct);

export default router;
