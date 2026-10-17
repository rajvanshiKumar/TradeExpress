import * as orderService from '../services/orderService.js';

export async function calculateTotals(req, res, next) {
  try {
    const { lines, shippingMethod } = req.body;
    const calculation = await orderService.validateAndCalculateOrder({ lines, shippingMethod });
    res.json({
      success: true,
      data: calculation,
    });
  } catch (error) {
    next(error);
  }
}

export async function createOrder(req, res, next) {
  try {
    const userId = req.user?.id || null;
    const {
      buyerName,
      buyerEmail,
      buyerPhone,
      buyerCompany,
      shippingMethod,
      paymentMethod,
      deliveryAddress,
      lines,
      idempotencyKey,
      notes,
    } = req.body;

    const order = await orderService.createOrder({
      userId,
      buyerName: buyerName || req.user?.name,
      buyerEmail: buyerEmail || req.user?.email,
      buyerPhone: buyerPhone || req.user?.phone,
      buyerCompany: buyerCompany || req.user?.company,
      shippingMethod,
      paymentMethod,
      deliveryAddress,
      lines,
      idempotencyKey,
      notes,
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully.',
      data: order,
    });
  } catch (error) {
    next(error);
  }
}

export async function getOrder(req, res, next) {
  try {
    const userId = req.user?.id || null;
    const order = await orderService.getOrderByIdOrNumber(req.params.identifier, userId);
    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyOrders(req, res, next) {
  try {
    const orders = await orderService.listUserOrders(req.user.id);
    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
}
