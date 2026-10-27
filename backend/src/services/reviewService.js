import prisma from '../config/db.js';

export async function createReview({
  orderId,
  buyerId = null,
  rating = 5,
  qualityRating = 5,
  packagingRating = 5,
  timelinessRating = 5,
  comment = '',
}) {
  const order = await prisma.order.findFirst({
    where: {
      OR: [{ id: orderId }, { orderNumber: orderId }],
    },
    include: {
      items: true,
      review: true,
    },
  });

  if (!order) {
    const error = new Error(`Order ${orderId} not found.`);
    error.statusCode = 404;
    throw error;
  }

  // Must be DELIVERED to rate and review
  if (order.orderStatus !== 'DELIVERED') {
    const error = new Error('You can only review an order after it has been DELIVERED.');
    error.statusCode = 400;
    throw error;
  }

  if (order.review) {
    const error = new Error('A review has already been submitted for this order.');
    error.statusCode = 400;
    throw error;
  }

  const primaryProductId = order.items?.[0]?.productId || null;
  const numRating = Math.min(5, Math.max(1, Number(rating) || 5));

  const review = await prisma.review.create({
    data: {
      orderId: order.id,
      buyerId: buyerId || order.userId || 'guest-buyer',
      productId: primaryProductId,
      rating: numRating,
      qualityRating: Math.min(5, Math.max(1, Number(qualityRating) || 5)),
      packagingRating: Math.min(5, Math.max(1, Number(packagingRating) || 5)),
      timelinessRating: Math.min(5, Math.max(1, Number(timelinessRating) || 5)),
      comment: comment?.trim() || null,
    },
    include: {
      buyer: { select: { id: true, name: true, company: true } },
    },
  });

  return review;
}

export async function getReviewForOrder(orderId) {
  const review = await prisma.review.findFirst({
    where: {
      OR: [
        { orderId },
        { order: { orderNumber: orderId } },
      ],
    },
    include: {
      buyer: { select: { id: true, name: true, company: true } },
    },
  });

  return review;
}

export async function listProductReviews(productId) {
  const reviews = await prisma.review.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' },
    include: {
      buyer: { select: { id: true, name: true, company: true } },
    },
  });

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return {
    reviews,
    totalReviews: reviews.length,
    averageRating: Math.round(avgRating * 10) / 10,
  };
}
