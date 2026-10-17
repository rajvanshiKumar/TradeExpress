import prisma from '../config/db.js';

const TRACKING_STEPS = [
  { key: 'ORDER_PLACED', label: 'Order Placed', description: 'Order received and logged in system.' },
  { key: 'ORDER_CONFIRMED', label: 'Order Confirmed', description: 'Payment or COD verified and order confirmed.' },
  { key: 'PROCESSING', label: 'Processing', description: 'Items picked and prepared for dispatch at supplier warehouse.' },
  { key: 'SHIPPED', label: 'Shipped', description: 'Package dispatched with freight carrier.' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', description: 'Shipment with local courier for final delivery.' },
  { key: 'DELIVERED', label: 'Delivered', description: 'Goods delivered and accepted at destination.' },
];

export async function getOrderTracking({ orderNumber, email, userId }) {
  const where = orderNumber.startsWith('TS-') ? { orderNumber } : { id: orderNumber };

  const order = await prisma.order.findFirst({
    where,
    include: {
      items: true,
      statusHistory: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!order) {
    const error = new Error(`Order #${orderNumber} could not be found.`);
    error.statusCode = 404;
    throw error;
  }

  // If user is authenticated, ensure ownership unless admin
  if (userId && order.userId && order.userId !== userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.role !== 'ADMIN') {
      const error = new Error('You do not have permission to view tracking for this order.');
      error.statusCode = 403;
      throw error;
    }
  }

  // If public lookup with email verification
  if (email && order.buyerEmail.toLowerCase() !== email.toLowerCase().trim()) {
    const error = new Error('The email provided does not match the order record.');
    error.statusCode = 403;
    throw error;
  }

  // Calculate current progress index in timeline
  const isCancelled = order.orderStatus === 'CANCELLED';
  const isRefunded = order.orderStatus === 'REFUNDED';
  const currentStepIndex = TRACKING_STEPS.findIndex((s) => s.key === order.orderStatus);

  const timeline = TRACKING_STEPS.map((step, idx) => {
    const historyEntry = order.statusHistory.find((h) => h.status === step.key);
    const isCompleted = !isCancelled && !isRefunded && idx <= currentStepIndex;
    const isCurrent = !isCancelled && !isRefunded && idx === currentStepIndex;

    return {
      step: idx + 1,
      statusKey: step.key,
      label: step.label,
      description: step.description,
      isCompleted,
      isCurrent,
      timestamp: historyEntry ? historyEntry.createdAt : null,
      notes: historyEntry ? historyEntry.notes : null,
    };
  });

  return {
    orderNumber: order.orderNumber,
    orderId: order.id,
    orderDate: order.createdAt,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    shippingMethod: order.shippingMethod,
    shippingEta: order.shippingEta,
    deliveryAddress: typeof order.deliveryAddress === 'string' ? JSON.parse(order.deliveryAddress) : order.deliveryAddress,
    isCancelled,
    isRefunded,
    timeline,
    statusHistory: order.statusHistory,
    items: order.items.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
    })),
    totals: {
      subtotal: Number(order.subtotal),
      shippingFee: Number(order.shippingFee),
      tax: Number(order.tax),
      total: Number(order.total),
    },
  };
}

export async function updateOrderStatus({ orderId, status, notes = '', changedBy = 'Admin' }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    const error = new Error('Order not found.');
    error.statusCode = 404;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { orderStatus: status },
      include: { statusHistory: { orderBy: { createdAt: 'desc' } } },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status,
        notes: notes || `Order status updated to ${status}.`,
        changedBy,
      },
    });

    return updated;
  });
}
