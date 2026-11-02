import * as supplierOrderService from '../services/supplierOrderService.js';

export async function getOrders(req, res, next) {
  try {
    const orders = await supplierOrderService.getSupplierOrders(req.user);
    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
}

export async function acceptOrder(req, res, next) {
  try {
    const order = await supplierOrderService.acceptSupplierOrder(req.user, req.params.orderId);
    res.json({
      success: true,
      message: 'Order accepted successfully.',
      data: order,
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectOrder(req, res, next) {
  try {
    const order = await supplierOrderService.rejectSupplierOrder(req.user, req.params.orderId, req.body.reason);
    res.json({
      success: true,
      message: 'Order rejected and buyer notified.',
      data: order,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(req, res, next) {
  try {
    const order = await supplierOrderService.updateSupplierOrderStatus(req.user, req.params.orderId, req.body);
    res.json({
      success: true,
      message: `Order status updated to ${req.body.status}.`,
      data: order,
    });
  } catch (error) {
    next(error);
  }
}

export async function dispatchOrder(req, res, next) {
  try {
    const order = await supplierOrderService.dispatchSupplierOrder(req.user, req.params.orderId, req.body);
    res.json({
      success: true,
      message: 'Order dispatch details and shipping documents saved.',
      data: order,
    });
  } catch (error) {
    next(error);
  }
}
