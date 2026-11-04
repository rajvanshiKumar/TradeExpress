import prisma from '../config/db.js';
import { getShipmentsForOrderTracking } from './transport/shipmentService.js';

const NEEDS_EMAIL = 'Sign in to the account that placed this order, or enter the email address used for the order.';

function trackingError(message, statusCode, errorCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
}

const TRACKING_STEPS = [
  { key: 'ORDER_PLACED', label: 'Order Placed', description: 'Order received and logged in system.' },
  { key: 'ORDER_CONFIRMED', label: 'Order Confirmed', description: 'Payment or COD verified and order confirmed.' },
  { key: 'PROCESSING', label: 'Processing', description: 'Items picked and prepared for dispatch at supplier warehouse.' },
  { key: 'SHIPPED', label: 'Shipped', description: 'Package dispatched with freight carrier.' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', description: 'Shipment with local courier for final delivery.' },
  { key: 'DELIVERED', label: 'Delivered', description: 'Goods delivered and accepted at destination.' },
];

/** True when the supplier is the order's supplier or supplies one of its products. */
async function suppliesOrder(supplierId, order) {
  if (order.supplierId === supplierId) return true;
  const productIds = order.items.map((item) => item.productId).filter(Boolean);
  if (!productIds.length) return false;
  return (await prisma.product.count({ where: { id: { in: productIds }, supplierId } })) > 0;
}

/**
 * Order tracking. Full details for the buyer who placed the order, a supplier on it, or staff. Anyone else must
 * give the order's email address and gets a limited view (status, items, shipments; no prices, address, escrow,
 * disputes or contact numbers). Anonymous lookups never reveal whether an order number exists.
 */
export async function getOrderTracking({ orderNumber, email, user }) {
  const where = orderNumber.startsWith('TS-') ? { orderNumber } : { id: orderNumber };

  const order = await prisma.order.findFirst({
    where,
    include: {
      items: true,
      statusHistory: { orderBy: { createdAt: 'asc' } },
      escrowLedger: true,
      dispute: { include: { messages: { orderBy: { createdAt: 'asc' } } } },
      review: true,
    },
  });

  const isStaff = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isBuyer = Boolean(user && order && order.userId === user.id);
  const fullAccess = isStaff || isBuyer || (user?.role === 'SUPPLIER' && order && await suppliesOrder(user.id, order));

  if (!fullAccess) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) throw trackingError(NEEDS_EMAIL, 401, 'TRACKING_EMAIL_REQUIRED');
    if (!order || order.buyerEmail.toLowerCase() !== cleanEmail) {
      throw trackingError('We could not find an order with that number and email address.', 404, 'TRACKING_NOT_FOUND');
    }
  } else if (!order) {
    throw trackingError(`Order #${orderNumber} could not be found.`, 404, 'TRACKING_NOT_FOUND');
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

  const shipments = await getShipmentsForOrderTracking(order.id, { publicView: !fullAccess });
  if (!fullAccess) {
    const address = typeof order.deliveryAddress === 'string' ? JSON.parse(order.deliveryAddress) : order.deliveryAddress;
    return {
      access: 'public',
      orderNumber: order.orderNumber,
      orderDate: order.createdAt,
      orderStatus: order.orderStatus,
      isCancelled,
      isRefunded,
      shippingEta: order.shippingEta,
      deliveryCity: [address?.city, address?.state].filter(Boolean).join(', '),
      timeline,
      items: order.items.map((item) => ({ id: item.id, productName: item.productName, quantity: item.quantity, unit: item.unit, shippedQuantity: item.shippedQuantity, deliveredQuantity: item.deliveredQuantity })),
      shipments,
    };
  }

  return {
    access: 'full',
    shipments,
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
    escrowLedger: order.escrowLedger ? {
      ...order.escrowLedger,
      amountHeld: Number(order.escrowLedger.amountHeld),
      commissionRate: Number(order.escrowLedger.commissionRate),
      commissionFee: Number(order.escrowLedger.commissionFee),
      payoutAmount: Number(order.escrowLedger.payoutAmount),
    } : null,
    dispute: order.dispute || null,
    review: order.review || null,
  };
}

