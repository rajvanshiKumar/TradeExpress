import { Router } from 'express';
import * as productController from '../controllers/productController.js';

const router = Router();

router.get('/', productController.getProducts);
router.get('/id/:id', productController.getProductById);
router.get('/:slug/suppliers', productController.getProductSuppliers);
router.get('/:slug', productController.getProductBySlug);

export default router;
