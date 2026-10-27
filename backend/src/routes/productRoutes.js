import { Router } from 'express';
import * as productController from '../controllers/productController.js';

const router = Router();

router.get('/', productController.getProducts);
router.get('/id/:id', productController.getProductById);
router.get('/:slug/suppliers', productController.getProductSuppliers);
router.get('/:slug/compare-suppliers', productController.compareProductSuppliers);
router.post('/:slug/compare-suppliers', productController.compareProductSuppliers);
router.get('/compare', productController.compareProducts);
router.get('/:id/similar', productController.getSimilarProducts);
router.get('/:slug', productController.getProductBySlug);

export default router;
