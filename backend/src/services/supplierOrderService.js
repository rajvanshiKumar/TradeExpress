import prisma from '../config/db.js';
import { createNotification } from './notificationService.js';
import { availabilitySnapshot, publishInventoryChanges, transitionOrderInventory } from './inventoryLifecycleService.js';

export async function getSupplierOrders(supplierUser) {
  const companyId = supplierUser.companyId || supplierUser.company || supplierUser.id;

  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { supplierId: supplierUser.id },
        ...(companyId ? [{ supplierCompanyId: String(companyId) }] : []),
        {
          items: {
            some: {
              product: {
                OR: [
                  { supplierId: supplierUser.id },
                  ...(companyId ? [{ companyId: String(companyId) }] : []),
                ],
              },
            },
          },
        },
      ],
    },
    include: {
      items: true,
      payments: true,
      statusHistory: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return orders.map((o) => ({
    ...o,
    subtotal: Number(o.subtotal),
    shippingFee: Number(o.shippingFee),
    tax: Number(o.tax),
    cgst: Number(o.cgst),
    sgst: Number(o.sgst),
    igst: Number(o.igst),
    total: Number(o.total),
    advanceAmount: Number(o.advanceAmount),
    balanceDue: Number(o.balanceDue),
    items: o.items.map((i) => ({
      ...i,
      unitPrice: Number(i.unitPrice),
      lineTotal: Number(i.lineTotal),
    })),
  }));
}

const ORDER_TX = { maxWait: 15000, timeout: 30000 };

/**
 * Loads an order the supplier is allowed to act on: their own orders (or ones containing their products).
 * Admins may act on any order.
 */
async function findSupplierOrder(supplierUser, orderId, include) {
  const isStaff = supplierUser.role === 'ADMIN' || supplierUser.role === 'SUPER_ADMIN';
  const order = await prisma.order.findFirst({
    where: isStaff
      ? { id: orderId }
      : {
          id: orderId,
          OR: [
            { supplierId: supplierUser.id },
            { items: { some: { product: { supplierId: supplierUser.id } } } },
          ],
        },
    include,
  });

  if (!order) {
    const error = new Error('Order not found.');
    error.statusCode = 404;
    throw error;
  }
  return order;
}

function supplierActor(supplierUser) {
  return { id: supplierUser.id, name: supplierUser.name || 'Supplier' };
}

export async function acceptSupplierOrder(supplierUser, orderId) {
  const order = await findSupplierOrder(supplierUser, orderId);

  if (order.orderStatus !== 'ORDER_PLACED') {
    const error = new Error(`Order cannot be accepted in "${order.orderStatus}" state.`);
    error.statusCode = 400;
    throw error;
  }

  const supplierInvoiceSeries = `TS-INV-${(order.supplierCompanyId || 'SUP').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-6)}`;

  // Accepting does not move stock: it stays reserved until payment (or is already committed for COD),
  // and leaves on hand when the order ships.
  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.order.update({
      where: { id: orderId },
      data: {
        orderStatus: 'ORDER_CONFIRMED',
        supplierInvoiceNumber: order.supplierInvoiceNumber || supplierInvoiceSeries,
      },
      include: { items: true, statusHistory: { orderBy: { createdAt: 'desc' } } },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: 'ORDER_CONFIRMED',
        notes: `Order accepted by supplier (${supplierUser.name}). Invoice #${supplierInvoiceSeries} assigned.`,
        changedBy: 'Supplier',
      },
    });

    return res;
  });

  if (order.userId) {
    createNotification({
      userId: order.userId,
      title: `Order Confirmed: #${order.orderNumber}`,
      message: `Your wholesale order #${order.orderNumber} has been accepted and confirmed by the supplier.`,
      type: 'ORDER',
      link: `/track/${order.orderNumber}`,
    }).catch(() => {});
  }

  return updated;
}

export async function rejectSupplierOrder(supplierUser, orderId, reason = '') {
  const order = await findSupplierOrder(supplierUser, orderId, { items: true });

  // Supplier can only reject before Confirmed
  if (['ORDER_CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED'].includes(order.orderStatus)) {
    const error = new Error('Order has already been confirmed/processed and cannot be rejected. Please contact support or request cancellation.');
    error.statusCode = 400;
    throw error;
  }

  const stockBefore = await availabilitySnapshot(order.items.map((i) => i.productId));
  let released = { touched: [] };

  const updated = await prisma.$transaction(async (tx) => {
    // Give the held stock back (once)
    released = await transitionOrderInventory(tx, orderId, 'RELEASE', {
      reason: 'ORDER_CANCELLED',
      notes: `Supplier rejected Order #${order.orderNumber}: ${reason || 'Capacity constraints'}`,
      actor: supplierActor(supplierUser),
    });

    const res = await tx.order.update({
      where: { id: orderId },
      data: {
        orderStatus: 'CANCELLED',
        rejectionReason: reason || 'Rejected by supplier before confirmation.',
      },
      include: { items: true, statusHistory: { orderBy: { createdAt: 'desc' } } },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: 'CANCELLED',
        notes: `Order rejected by supplier: ${reason || 'Capacity/inventory constraints.'}`,
        changedBy: 'Supplier',
      },
    });

    return res;
  }, ORDER_TX);

  publishInventoryChanges(released.touched, stockBefore);

  if (order.userId) {
    createNotification({
      userId: order.userId,
      title: `Order Rejected: #${order.orderNumber}`,
      message: `Supplier was unable to accept order #${order.orderNumber}: ${reason || 'Capacity constraints'}.`,
      type: 'ORDER',
      link: `/buyer/orders`,
    }).catch(() => {});
  }

  return updated;
}

export async function updateSupplierOrderStatus(supplierUser, orderId, { status, notes = '' }) {
  const order = await findSupplierOrder(supplierUser, orderId, { items: { select: { productId: true } } });

  // Shipped / delivered come only from Transport & Delivery (dispatch and the buyer's delivery confirmation)
  const ALLOWED_STATUSES = ['ORDER_CONFIRMED', 'PROCESSING', 'PACKED'];
  if (!ALLOWED_STATUSES.includes(status)) {
    const error = new Error(`Status ${status} cannot be set here. Shipping and delivery are recorded in Transport & Delivery Management.`);
    error.statusCode = 400;
    throw error;
  }
  if (['CANCELLED', 'REFUNDED'].includes(order.orderStatus)) {
    const error = new Error(`Order is ${order.orderStatus.toLowerCase()} and can no longer be updated.`);
    error.statusCode = 400;
    throw error;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.order.update({
      where: { id: orderId },
      data: { orderStatus: status },
      include: { items: true, statusHistory: { orderBy: { createdAt: 'desc' } } },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status,
        notes: notes || `Order status updated to ${status} by supplier.`,
        changedBy: 'Supplier',
      },
    });

    return res;
  }, ORDER_TX);

  if (order.userId) {
    createNotification({
      userId: order.userId,
      title: `Order Status: ${status}`,
      message: `Order #${order.orderNumber} is now marked as ${status}.`,
      type: 'ORDER',
      link: `/track/${order.orderNumber}`,
    }).catch(() => {});
  }

  return updated;
}

