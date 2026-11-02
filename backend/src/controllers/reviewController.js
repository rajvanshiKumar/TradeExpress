import * as reviewService from '../services/reviewService.js';

export async function createReview(req, res, next) {
  try {
    const review = await reviewService.createReview({
      ...req.body,
      orderId: req.params.orderId,
      buyerId: req.user?.id,
    });

    res.status(201).json({
      success: true,
      message: 'Review and rating submitted successfully.',
      data: review,
    });
  } catch (error) {
    next(error);
  }
}

export async function getReviewForOrder(req, res, next) {
  try {
    const review = await reviewService.getReviewForOrder(req.params.orderId);
    res.json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
}

export async function getProductReviews(req, res, next) {
  try {
    const data = await reviewService.listProductReviews(req.params.productId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
