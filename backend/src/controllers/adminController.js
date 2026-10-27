import * as adminService from '../services/adminService.js';

export async function getKycList(req, res, next) {
  try {
    const list = await adminService.listPendingKyc();
    res.json({ success: true, data: list });
  } catch (error) {
    next(error);
  }
}

export async function reviewKyc(req, res, next) {
  try {
    const user = await adminService.reviewKyc(req.params.userId, req.body);
    res.json({
      success: true,
      message: `KYC status updated to ${user.kycStatus}.`,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

export async function getProductsForModeration(req, res, next) {
  try {
    const products = await adminService.listProductsForModeration();
    res.json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
}

export async function moderateProduct(req, res, next) {
  try {
    const product = await adminService.moderateProduct(req.params.productId, req.body);
    res.json({
      success: true,
      message: `Product moderation status updated to ${product.moderationStatus}.`,
      data: product,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCommission(req, res, next) {
  try {
    const settings = await adminService.getCommissionSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
}

export async function setCommission(req, res, next) {
  try {
    const setting = await adminService.saveCommissionSetting(req.body);
    res.json({
      success: true,
      message: 'Commission setting saved.',
      data: setting,
    });
  } catch (error) {
    next(error);
  }
}
