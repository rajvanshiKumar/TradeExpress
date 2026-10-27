import * as paymentService from '../services/paymentService.js';

export async function createPaymentOrder(req, res, next) {
  try {
    const { orderId } = req.body;
    const paymentData = await paymentService.createPaymentOrder({
      orderId,
      userId: req.user?.id,
      userRole: req.user?.role,
    });
    res.json({
      success: true,
      data: paymentData,
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyPayment(req, res, next) {
  try {
    const { orderId, paymentOrderId, transactionId, signature } = req.body;
    const result = await paymentService.verifyPayment({
      orderId,
      paymentOrderId,
      transactionId,
      signature,
      userId: req.user?.id,
      userRole: req.user?.role,
    });

    res.json({
      success: true,
      message: result.message,
      data: result.order,
    });
  } catch (error) {
    next(error);
  }
}

export async function sandboxSimulate(req, res, next) {
  try {
    const { orderId, paymentOrderId } = req.body;
    const result = await paymentService.simulateSandboxPayment({
      orderId,
      paymentOrderId,
      userId: req.user?.id,
      userRole: req.user?.role,
    });

    res.json({
      success: true,
      message: 'Sandbox payment successfully simulated and verified.',
      data: result.order,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleWebhook(req, res, next) {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const result = await paymentService.handleRazorpayWebhook({
      rawBody: req.rawBody || req.body,
      signature,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
