import * as productService from '../services/productService.js';

export async function getProducts(req, res, next) {
  try {
    const {
      category,
      search,
      minPrice,
      maxPrice,
      maxMoq,
      readyToShip,
      sampleAvailable,
      isNew,
      deal,
      verifiedOnly,
      sort,
      page,
      limit,
    } = req.query;
    const result = await productService.listProducts({
      category,
      search,
      minPrice,
      maxPrice,
      maxMoq,
      readyToShip,
      sampleAvailable,
      isNew,
      deal,
      verifiedOnly,
      sort,
      page,
      limit,
    });
    res.json({
      success: true,
      data: result.products,
      pagination: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getProductSuppliers(req, res, next) {
  try {
    const result = await productService.getProductSuppliers(req.params.slug);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getProductBySlug(req, res, next) {
  try {
    const product = await productService.getProductBySlug(req.params.slug);
    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
}

export async function getProductById(req, res, next) {
  try {
    const product = await productService.getProductById(req.params.id);
    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
}

