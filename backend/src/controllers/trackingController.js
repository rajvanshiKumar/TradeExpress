import * as trackingService from '../services/trackingService.js';

export async function getTracking(req, res, next) {
  try {
    const { orderNumber } = req.params;
    const { email } = req.query;
    const trackingData = await trackingService.getOrderTracking({
      orderNumber,
      email,
      user: req.user || null,
    });

    res.json({
      success: true,
      data: trackingData,
    });
  } catch (error) {
    next(error);
  }
}

