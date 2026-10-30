import * as supplierDashboardService from '../services/supplierDashboardService.js';
import * as authService from '../services/authService.js';

export async function getOverview(req, res, next) {
  try {
    const overview = await supplierDashboardService.getSupplierOverview(req.user);
    res.json({
      success: true,
      data: overview,
    });
  } catch (error) {
    next(error);
  }
}

export async function listQuotations(req, res, next) {
  try {
    const result = await supplierDashboardService.listSupplierQuotations(req.user, req.query);
    res.json({
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    });
  } catch (error) {
    next(error);
  }
}

export async function createQuotation(req, res, next) {
  try {
    const quotation = await supplierDashboardService.createSupplierQuotation(req.user, req.body);
    res.status(201).json({
      success: true,
      message: 'Quotation submitted successfully to buyer.',
      data: quotation,
    });
  } catch (error) {
    next(error);
  }
}

export async function getPayments(req, res, next) {
  try {
    const payments = await supplierDashboardService.getSupplierPayments(req.user, req.query);
    res.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAnalytics(req, res, next) {
  try {
    const analytics = await supplierDashboardService.getSupplierAnalytics(req.user);
    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
}

export async function getShipping(req, res, next) {
  try {
    const shipping = await supplierDashboardService.getSupplierShipping(req.user);
    res.json({
      success: true,
      data: shipping,
    });
  } catch (error) {
    next(error);
  }
}

export async function dispatchOrder(req, res, next) {
  try {
    const order = await supplierDashboardService.dispatchOrderWithCarrier(
      req.user,
      req.params.orderId,
      req.body
    );
    res.json({
      success: true,
      message: 'Consignment dispatched and tracking saved.',
      data: order,
    });
  } catch (error) {
    next(error);
  }
}

export async function getProfile(req, res, next) {
  try {
    const profile = await authService.getUserProfile(req.user.id);
    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const updated = await authService.updateUserProfile(req.user.id, req.body);
    res.json({
      success: true,
      message: 'Supplier profile updated successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function acceptOrder(req, res, next) {
  try {
    const order = await supplierDashboardService.acceptSupplierOrder(req.user, req.params.orderId);
    res.json({
      success: true,
      message: 'Order accepted and confirmed.',
      data: order,
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectOrder(req, res, next) {
  try {
    const order = await supplierDashboardService.rejectSupplierOrder(req.user, req.params.orderId, req.body);
    res.json({
      success: true,
      message: 'Order rejected.',
      data: order,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateOrderStatus(req, res, next) {
  try {
    const order = await supplierDashboardService.updateSupplierOrderStatus(req.user, req.params.orderId, req.body);
    res.json({
      success: true,
      message: 'Order status updated.',
      data: order,
    });
  } catch (error) {
    next(error);
  }
}
