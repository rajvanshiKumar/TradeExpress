import * as listingAiService from '../services/listingAiService.js';

/**
 * Product Listing AI for suppliers (photos -> suggested listing details).
 * POST /api/supplier/products/ai-listing        { photos: [url, ...] }  -> { jobToken }
 * GET  /api/supplier/products/ai-listing/:token                          -> processing | ready (suggestions) | failed
 */
function sendError(res, next, error) {
  if (!error.statusCode) return next(error);
  return res.status(error.statusCode).json({ success: false, code: error.errorCode, message: error.message });
}

export async function status(req, res) {
  return res.json({ success: true, data: { available: listingAiService.isListingAiConfigured() } });
}

export async function startJob(req, res, next) {
  try {
    const data = await listingAiService.startListingJob({ supplierId: req.user.id, photos: req.body.photos });
    return res.status(202).json({ success: true, data });
  } catch (error) {
    return sendError(res, next, error);
  }
}

export async function getJob(req, res, next) {
  try {
    const data = await listingAiService.getListingJob({ supplierId: req.user.id, jobToken: req.params.token });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, next, error);
  }
}
