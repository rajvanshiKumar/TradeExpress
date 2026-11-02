import * as paymentMethodService from '../services/paymentMethodService.js';

export async function listPaymentMethods(req, res, next) {
  try {
    const methods = await paymentMethodService.listPaymentMethods(req.user.id);
    res.json({ success: true, data: methods });
  } catch (error) {
    next(error);
  }
}

export async function getGatewayMethods(req, res, next) {
  try {
    const data = await paymentMethodService.getGatewayMethods();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function startCardSession(req, res, next) {
  try {
    const session = await paymentMethodService.startCardSession(req.user.id);
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
}

export async function completeCardSession(req, res, next) {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const result = await paymentMethodService.completeCardSession(req.user.id, { razorpayOrderId, razorpayPaymentId, razorpaySignature });
    res.status(201).json({ success: true, message: 'Card saved securely.', data: result });
  } catch (error) {
    next(error);
  }
}

export async function setDefaultPaymentMethod(req, res, next) {
  try {
    const method = await paymentMethodService.setDefaultPaymentMethod(req.user.id, req.params.id);
    res.json({ success: true, message: 'Default card updated.', data: method });
  } catch (error) {
    next(error);
  }
}

export async function verifyPaymentMethod(req, res, next) {
  try {
    const method = await paymentMethodService.verifyPaymentMethod(req.user.id, req.params.id);
    res.json({ success: true, data: method });
  } catch (error) {
    next(error);
  }
}

export async function removePaymentMethod(req, res, next) {
  try {
    const result = await paymentMethodService.removePaymentMethod(req.user.id, req.params.id);
    res.json({ success: true, message: 'Card removed.', data: result });
  } catch (error) {
    next(error);
  }
}
