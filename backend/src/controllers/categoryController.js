import * as productService from '../services/productService.js';
import { getTrendingCategories as rankTrending } from '../services/trendingCategoryService.js';

export async function getCategories(req, res, next) {
  try {
    const categories = await productService.listCategories();
    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTrendingCategories(req, res, next) {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 7));
    res.json({ success: true, data: await rankTrending({ limit }) });
  } catch (error) {
    next(error);
  }
}

export async function getCategoryBySlug(req, res, next) {
  try {
    const category = await productService.getCategoryBySlug(req.params.slug);
    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
}
