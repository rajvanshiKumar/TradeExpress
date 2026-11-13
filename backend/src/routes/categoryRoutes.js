import { Router } from 'express';
import * as categoryController from '../controllers/categoryController.js';

const router = Router();

router.get('/', categoryController.getCategories);
// Before '/:slug', so 'trending' is not read as a category name
router.get('/trending', categoryController.getTrendingCategories);
router.get('/:slug', categoryController.getCategoryBySlug);

export default router;
