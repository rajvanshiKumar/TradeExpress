import * as trackingService from '../services/trackingService.js';

export async function getTracking(req, res, next) {
  try {
    const { orderNumber } = req.params;
    const { email } = req.query;
    const userId = req.user?.id || null;

    const trackingData = await trackingService.getOrderTracking({
      orderNumber,
      email,
      userId,
    });

    res.json({
      success: true,
      data: trackingData,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(req, res, next) {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body;
    const changedBy = req.user?.name || 'Administrator';

    const updated = await trackingService.updateOrderStatus({
      orderId,
      status,
      notes,
      changedBy,
    });

    res.json({
      success: true,
      message: `Order status updated to ${status}.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}
