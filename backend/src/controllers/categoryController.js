import * as productService from '../services/productService.js';

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
