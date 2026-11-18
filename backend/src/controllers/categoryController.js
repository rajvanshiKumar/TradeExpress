import * as productService from '../services/productService.js';
import prisma from '../config/db.js';
import { resolveAttributeSchema, taxonomyCategory } from '../data/categoryAttributes.js';

/**
 * GET /api/categories/:slug/attributes?subcategory=&productType=
 * The resolved specification schema (category -> subcategory -> product type). Read-only and public: it only
 * describes which fields a listing in this category has. An admin-maintained list stored in
 * Category.attributes.specSchema replaces the built-in category level.
 */
export async function getCategoryAttributes(req, res, next) {
  try {
    const slug = String(req.params.slug || '').trim();
    const subcategory = typeof req.query.subcategory === 'string' ? req.query.subcategory.slice(0, 120) : null;
    const productType = typeof req.query.productType === 'string' ? req.query.productType.slice(0, 120) : null;
    const category = await prisma.category.findUnique({ where: { slug }, select: { slug: true, attributes: true } });
    if (!category && !taxonomyCategory(slug)) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }
    const override = category?.attributes && typeof category.attributes === 'object' ? category.attributes.specSchema : null;
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({ success: true, data: resolveAttributeSchema(slug, subcategory || null, productType || null, override) });
  } catch (error) {
    return next(error);
  }
}
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
