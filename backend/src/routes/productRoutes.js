import { Router } from 'express';
import multer from 'multer';
import * as productController from '../controllers/productController.js';
import { visualSearchLimiter } from '../middleware/rateLimiter.js';
import { VISUAL_SEARCH_MAX_BYTES, VISUAL_SEARCH_MIME_TYPES } from '../services/visualSearchService.js';

const router = Router();

// One image held in memory only for recognition (never written to disk)
const visualSearchUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: VISUAL_SEARCH_MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => cb(null, VISUAL_SEARCH_MIME_TYPES.includes(file.mimetype)),
}).single('image');

const acceptSearchImage = (req, res, next) => visualSearchUpload(req, res, (err) => {
  if (!err) return next();
  const tooLarge = err.code === 'LIMIT_FILE_SIZE';
  return res.status(400).json({
    success: false,
    code: 'INVALID_IMAGE',
    message: tooLarge ? 'The image is larger than 5 MB. Please upload a smaller photo.' : 'Upload a single JPG, PNG or WEBP product image.',
  });
});

router.post('/visual-search', visualSearchLimiter, acceptSearchImage, productController.visualSearch);
router.get('/', productController.getProducts);
router.get('/suggest', productController.getSuggestions);
router.get('/id/:id', productController.getProductById);
router.get('/:slug/suppliers', productController.getProductSuppliers);
router.get('/:slug/compare-suppliers', productController.compareProductSuppliers);
router.post('/:slug/compare-suppliers', productController.compareProductSuppliers);
router.get('/compare', productController.compareProducts);
router.get('/:id/similar', productController.getSimilarProducts);
router.get('/:slug', productController.getProductBySlug);

export default router;
