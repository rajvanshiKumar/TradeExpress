import { Router } from 'express';
import { body } from 'express-validator';
import * as supplierProductController from '../controllers/supplierProductController.js';
import { authenticateJWT, requireRole } from '../middleware/authMiddleware.js';
import { uploadMemory } from '../middleware/uploadMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Require supplier or admin role
router.use(authenticateJWT, requireRole('SUPPLIER', 'ADMIN'));

router.get('/', supplierProductController.listProducts);
router.get('/bulk/template', supplierProductController.downloadBulkTemplate);
router.post('/bulk/upload', uploadMemory.single('file'), supplierProductController.handleBulkUpload);

router.post(
  '/',
  validate([
    body('name').trim().notEmpty().withMessage('Product name is required.'),
    body('categorySlug').trim().notEmpty().withMessage('Category is required.'),
    body('price').isFloat({ min: 0.01 }).withMessage('Base price must be greater than zero.'),
    body('moq').isInt({ min: 1 }).withMessage('MOQ must be at least 1.'),
    body('stock').isInt({ min: 0 }).withMessage('Stock must be zero or more.'),
  ]),
  supplierProductController.createProduct
);

router.put('/:id', supplierProductController.updateProduct);
router.delete('/:id', supplierProductController.deleteProduct);

export default router;
