import prisma from '../config/db.js';
import { createNotification } from './notificationService.js';
import { broadcastInventoryUpdate, broadcastProductStock } from './socketService.js';

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

export async function acceptSupplierOrder(supplierUser, orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    const error = new Error('Order not found.');
    error.statusCode = 404;
    throw error;
  }

  if (order.orderStatus !== 'ORDER_PLACED') {
    const error = new Error(`Order cannot be accepted in "${order.orderStatus}" state.`);
    error.statusCode = 400;
    throw error;
  }

  const supplierInvoiceSeries = `TS-INV-${(order.supplierCompanyId || 'SUP').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-6)}`;

  const updated = await prisma.$transaction(async (tx) => {
    // Fulfill inventory commitment from physical stock and release reserved stock
    for (const item of order.items || []) {
      if (item.productId) {
        await tx.$executeRaw`
          UPDATE products
          SET stock = GREATEST(0, stock - ${item.quantity}),
              reservedStock = GREATEST(0, reservedStock - ${item.quantity})
          WHERE id = ${item.productId}
        `;

        const current = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, stock: true, reservedStock: true, supplierId: true, sku: true },
        });

        if (current) {
          await tx.inventoryLog.create({
            data: {
              productId: item.productId,
              supplierId: current.supplierId || supplierUser.id,
              previousStock: current.stock + item.quantity,
              newStock: current.stock,
              changeAmount: -item.quantity,
              previousReserved: current.reservedStock + item.quantity,
              newReserved: current.reservedStock,
              reason: 'ORDER_FULFILLED',
              notes: `Fulfilled & dispatched ${item.quantity} unit(s) for Order #${order.orderNumber}. Carrier: ${carrierName || 'Freight'}. AWB: ${trackingNumber || 'N/A'}`,
              orderId: order.orderNumber,
              actorId: supplierUser.id,
              actorName: supplierUser.name || 'Supplier',
            },
          });
        }
      }
    }

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
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    const error = new Error('Order not found.');
    error.statusCode = 404;
    throw error;
  }

  // Supplier can only reject before Confirmed
  if (order.orderStatus === 'ORDER_CONFIRMED' || order.orderStatus === 'PROCESSING' || order.orderStatus === 'PACKED' || order.orderStatus === 'SHIPPED') {
    const error = new Error('Order has already been confirmed/processed and cannot be rejected. Please contact support or request cancellation.');
    error.statusCode = 400;
    throw error;
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Release reserved inventory
    for (const item of order.items) {
      if (item.productId) {
        await tx.$executeRaw`
          UPDATE products
          SET reservedStock = GREATEST(0, reservedStock - ${item.quantity})
          WHERE id = ${item.productId}
        `;

        const current = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, stock: true, reservedStock: true, supplierId: true, sku: true },
        });

        if (current) {
          await tx.inventoryLog.create({
            data: {
              productId: item.productId,
              supplierId: current.supplierId || supplierUser.id,
              previousStock: current.stock,
              newStock: current.stock,
              changeAmount: 0,
              previousReserved: current.reservedStock + item.quantity,
              newReserved: current.reservedStock,
              reason: 'ORDER_CANCELLED',
              notes: `Released ${item.quantity} reserved unit(s) due to Supplier rejection: ${reason || 'Capacity constraints'}`,
              orderId: order.orderNumber,
              actorId: supplierUser.id,
              actorName: supplierUser.name || 'Supplier',
            },
          });
        }
      }
    }

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
  });

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
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    const error = new Error('Order not found.');
    error.statusCode = 404;
    throw error;
  }

  const ALLOWED_STATUSES = ['ORDER_CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
  if (!ALLOWED_STATUSES.includes(status)) {
    const error = new Error(`Status ${status} is not allowed via supplier flow.`);
    error.statusCode = 400;
    throw error;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.order.update({
      where: { id: orderId },
      data: {
        orderStatus: status,
        ...(status === 'DELIVERED' ? { deliveryAcceptedAt: new Date() } : {}),
      },
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
  });

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

export async function dispatchSupplierOrder(supplierUser, orderId, { carrierName, trackingNumber, invoiceUrl, ewayBillUrl }) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    const error = new Error('Order not found.');
    error.statusCode = 404;
    throw error;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.order.update({
      where: { id: orderId },
      data: {
        orderStatus: 'SHIPPED',
        carrierName: carrierName || order.carrierName || 'Freight Carrier',
        trackingNumber: trackingNumber || order.trackingNumber,
        invoiceUrl: invoiceUrl || order.invoiceUrl,
        ewayBillUrl: ewayBillUrl || order.ewayBillUrl,
      },
      include: { items: true, statusHistory: { orderBy: { createdAt: 'desc' } } },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: 'SHIPPED',
        notes: `Dispatched with ${carrierName || 'carrier'}. Tracking/LR: ${trackingNumber || 'N/A'}. Invoice & E-Way Bill uploaded.`,
        changedBy: 'Supplier',
      },
    });

    return res;
  });

  if (order.userId) {
    createNotification({
      userId: order.userId,
      title: `Shipment Dispatched: #${order.orderNumber}`,
      message: `Order #${order.orderNumber} has been dispatched with ${carrierName || 'Carrier'}. Tracking Number: ${trackingNumber || 'N/A'}.`,
      type: 'ORDER',
      link: `/track/${order.orderNumber}`,
    }).catch(() => {});
  }

  return updated;
}
