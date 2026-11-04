import prisma from '../config/db.js';
import { createNotification } from './notificationService.js';
import { broadcastInventoryUpdate, broadcastProductStock, broadcastAdminInventory } from './socketService.js';

/**
 * Single source of truth for how orders move stock.
 *
 *   On hand   (Product.stock)          physical units in the warehouse
 *   Reserved  (Product.reservedStock)  held for orders awaiting payment (expires)
 *   Committed (Product.committedStock) paid / confirmed orders not yet shipped
 *   Available = on hand - reserved - committed
 *
 * Every order carries Order.inventoryState. A transition first claims the order row with a conditional update on
 * that state, so repeated webhooks, double clicks or parallel cancels apply it once only. Product rows are locked
 * (SELECT ... FOR UPDATE) before they change, so two buyers can never both take the last unit.
 */

export const INVENTORY_STATES = {
  RESERVED: 'RESERVED',
  COMMITTED: 'COMMITTED',
  FULFILLED: 'FULFILLED',
  RELEASED: 'RELEASED',
  RETURNED: 'RETURNED',
};

export const RESERVATION_MINUTES = Math.max(1, Number(process.env.INVENTORY_RESERVATION_MINUTES) || 30);

const TX_OPTIONS = { maxWait: 15000, timeout: 30000 };

// What each transition does to a product row, given the state the order is leaving
const TRANSITIONS = {
  COMMIT: { from: ['RESERVED'], to: 'COMMITTED' },
  RELEASE: { from: ['RESERVED', 'COMMITTED'], to: 'RELEASED' },
  FULFIL: { from: ['RESERVED', 'COMMITTED'], to: 'FULFILLED' },
  RETURN: { from: ['FULFILLED'], to: 'RETURNED' },
};

const DEFAULT_REASONS = {
  COMMIT: 'ORDER_COMMITTED',
  RELEASE: 'ORDER_CANCELLED',
  FULFIL: 'ORDER_FULFILLED',
  RETURN: 'RETURN_RESTOCKED',
};

export function availableOf(product) {
  return Math.max(0, (product.stock || 0) - (product.reservedStock || 0) - (product.committedStock || 0));
}

function inventoryError(message, statusCode = 409) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/**
 * Sums quantities per product (an order may list the same product on several lines). Units already dispatched on a
 * shipment have left the order's hold, so normally only the unshipped remainder is counted; a return counts the
 * units that were shipped.
 */
function quantitiesByProduct(items, { shipped = false } = {}) {
  const totals = new Map();
  for (const item of items || []) {
    const quantity = shipped ? (item.shippedQuantity || 0) : (item.quantity || 0) - (item.shippedQuantity || 0);
    if (!item.productId || !(quantity > 0)) continue;
    totals.set(item.productId, (totals.get(item.productId) || 0) + quantity);
  }
  // Fixed lock order avoids deadlocks between orders that share products
  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b));
}

async function lockProduct(tx, productId) {
  const rows = await tx.$queryRaw`
    SELECT id, sku, name, supplierId, stock, reservedStock, committedStock, lowStockThreshold
    FROM products WHERE id = ${productId} FOR UPDATE
  `;
  return rows[0] || null;
}

async function writeProduct(tx, product, next, log) {
  await tx.$executeRaw`
    UPDATE products
    SET stock = ${next.stock}, reservedStock = ${next.reservedStock}, committedStock = ${next.committedStock}
    WHERE id = ${product.id}
  `;
  await tx.inventoryLog.create({
    data: {
      productId: product.id,
      supplierId: product.supplierId,
      previousStock: product.stock,
      newStock: next.stock,
      changeAmount: next.stock - product.stock,
      previousReserved: product.reservedStock,
      newReserved: next.reservedStock,
      previousCommitted: product.committedStock,
      newCommitted: next.committedStock,
      reason: log.reason,
      notes: log.notes,
      orderId: log.orderNumber || null,
      actorId: log.actor?.id || null,
      actorName: log.actor?.name || null,
    },
  });
  return { ...product, ...next };
}

/**
 * Reserves (or, for orders confirmed at once such as COD, commits) stock for a new order inside the caller's
 * transaction. Throws 409 if any line is short; the caller's transaction then rolls everything back.
 */
export async function reserveForNewOrder(tx, { orderNumber, items, commit = false, actor }) {
  // Lock and check every line before writing any, so a short line leaves nothing half-applied
  const lines = [];
  for (const [productId, quantity] of quantitiesByProduct(items)) {
    const product = await lockProduct(tx, productId);
    if (!product) throw inventoryError('A product in this order is no longer available.', 404);
    if (availableOf(product) < quantity) {
      throw inventoryError(`Insufficient available stock for "${product.name}". Only ${availableOf(product)} unit(s) can be ordered right now.`);
    }
    lines.push([product, quantity]);
  }

  const touched = [];
  for (const [product, quantity] of lines) {
    const next = {
      stock: product.stock,
      reservedStock: product.reservedStock + (commit ? 0 : quantity),
      committedStock: product.committedStock + (commit ? quantity : 0),
    };
    touched.push(await writeProduct(tx, product, next, {
      reason: commit ? 'ORDER_COMMITTED' : 'ORDER_RESERVED',
      notes: `${commit ? 'Committed' : 'Reserved'} ${quantity} unit(s) for Order #${orderNumber}`,
      orderNumber,
      actor,
    }));
  }
  return {
    inventoryState: commit ? INVENTORY_STATES.COMMITTED : INVENTORY_STATES.RESERVED,
    reservationExpiresAt: commit ? null : new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000),
    touched,
  };
}

export function nextForTransition(action, fromState, product, quantity) {
  const fromReserved = fromState === INVENTORY_STATES.RESERVED;
  const take = (value) => Math.max(0, value - quantity);
  switch (action) {
    case 'COMMIT':
      return { stock: product.stock, reservedStock: take(product.reservedStock), committedStock: product.committedStock + quantity };
    case 'RELEASE':
      return fromReserved
        ? { stock: product.stock, reservedStock: take(product.reservedStock), committedStock: product.committedStock }
        : { stock: product.stock, reservedStock: product.reservedStock, committedStock: take(product.committedStock) };
    case 'FULFIL':
      return fromReserved
        ? { stock: take(product.stock), reservedStock: take(product.reservedStock), committedStock: product.committedStock }
        : { stock: take(product.stock), reservedStock: product.reservedStock, committedStock: take(product.committedStock) };
    case 'RETURN':
      return { stock: product.stock + quantity, reservedStock: product.reservedStock, committedStock: product.committedStock };
    default:
      throw new Error(`Unknown inventory action ${action}`);
  }
}

/**
 * Moves an order's stock to the next state inside the caller's transaction. Returns { applied: false } when the
 * order is not in a state this action applies to (already done, or an order placed before tracking existed).
 */
export async function transitionOrderInventory(tx, orderId, action, { reason, notes, actor } = {}) {
  const rule = TRANSITIONS[action];
  if (!rule) throw new Error(`Unknown inventory action ${action}`);

  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, inventoryState: true, items: { select: { id: true, productId: true, quantity: true, shippedQuantity: true } } },
  });
  if (!order || !rule.from.includes(order.inventoryState)) {
    return { applied: false, state: order?.inventoryState ?? null, touched: [] };
  }

  // Claim the order: only one caller can move it out of its current state
  const claimed = await tx.order.updateMany({
    where: { id: orderId, inventoryState: order.inventoryState },
    data: { inventoryState: rule.to, reservationExpiresAt: null },
  });
  if (claimed.count === 0) return { applied: false, state: rule.to, touched: [] };

  const touched = [];
  for (const [productId, quantity] of quantitiesByProduct(order.items, { shipped: action === 'RETURN' })) {
    const product = await lockProduct(tx, productId);
    if (!product) continue; // product deleted since the order was placed
    const next = nextForTransition(action, order.inventoryState, product, quantity);
    touched.push(await writeProduct(tx, product, next, {
      reason: reason || DEFAULT_REASONS[action],
      notes: notes || `${DEFAULT_REASONS[action].replace(/_/g, ' ').toLowerCase()}: ${quantity} unit(s) for Order #${order.orderNumber}`,
      orderNumber: order.orderNumber,
      actor,
    }));
  }
  // A whole-order dispatch ships every remaining unit, so shipments can no longer be created for it
  if (action === 'FULFIL') {
    for (const item of order.items) {
      if (item.shippedQuantity < item.quantity) {
        await tx.orderItem.update({ where: { id: item.id }, data: { shippedQuantity: item.quantity, allocatedQuantity: item.quantity } });
      }
    }
  }
  return { applied: true, from: order.inventoryState, state: rule.to, touched };
}

/**
 * A shipment left the warehouse: its units come off on-hand stock and out of the order's committed hold, once per
 * shipment (the caller claims the shipment status first). When every line of the order has shipped, the order's
 * hold is complete. Orders placed before stock tracking only lose on-hand units.
 */
export async function shipShipmentItems(tx, { orderId, orderNumber, items, actor, shipmentNumber }) {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { inventoryState: true } });
  const tracked = order?.inventoryState === INVENTORY_STATES.COMMITTED;

  // Record shipped quantities first; the conditional update refuses to ship more than was ordered
  for (const item of items) {
    const updated = await tx.$executeRaw`
      UPDATE order_items SET shippedQuantity = shippedQuantity + ${item.quantity}
      WHERE id = ${item.orderItemId} AND shippedQuantity + ${item.quantity} <= quantity
    `;
    if (updated === 0) throw inventoryError(`${item.productName}: this would ship more units than the order contains.`);
  }

  const totals = new Map();
  for (const item of items) {
    if (item.productId) totals.set(item.productId, (totals.get(item.productId) || 0) + item.quantity);
  }
  const touched = [];
  for (const [productId, quantity] of [...totals.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const product = await lockProduct(tx, productId);
    if (!product) continue;
    const next = {
      stock: Math.max(0, product.stock - quantity),
      reservedStock: product.reservedStock,
      committedStock: tracked ? Math.max(0, product.committedStock - quantity) : product.committedStock,
    };
    touched.push(await writeProduct(tx, product, next, {
      reason: 'ORDER_FULFILLED',
      notes: `Shipment ${shipmentNumber} dispatched: ${quantity} unit(s) for Order #${orderNumber}`,
      orderNumber,
      actor,
    }));
  }

  if (tracked) {
    const [{ remaining }] = await tx.$queryRaw`
      SELECT COUNT(*) AS remaining FROM order_items WHERE orderId = ${orderId} AND shippedQuantity < quantity
    `;
    if (Number(remaining) === 0) {
      await tx.order.updateMany({ where: { id: orderId, inventoryState: INVENTORY_STATES.COMMITTED }, data: { inventoryState: INVENTORY_STATES.FULFILLED } });
    }
  }
  return { touched };
}

/**
 * A shipment came back to the supplier (physically received): its units return to on-hand stock and, for a tracked
 * order, back into the order's committed hold so the order can be shipped again or cancelled.
 */
export async function restockReturnedShipment(tx, { orderId, orderNumber, items, actor, shipmentNumber }) {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { inventoryState: true } });
  const tracked = order?.inventoryState === INVENTORY_STATES.COMMITTED || order?.inventoryState === INVENTORY_STATES.FULFILLED;

  for (const item of items) {
    await tx.$executeRaw`
      UPDATE order_items
      SET shippedQuantity = GREATEST(0, shippedQuantity - ${item.quantity}),
          allocatedQuantity = GREATEST(0, allocatedQuantity - ${item.quantity})
      WHERE id = ${item.orderItemId}
    `;
  }

  const totals = new Map();
  for (const item of items) {
    if (item.productId) totals.set(item.productId, (totals.get(item.productId) || 0) + item.quantity);
  }
  const touched = [];
  for (const [productId, quantity] of [...totals.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const product = await lockProduct(tx, productId);
    if (!product) continue;
    const next = {
      stock: product.stock + quantity,
      reservedStock: product.reservedStock,
      committedStock: tracked ? product.committedStock + quantity : product.committedStock,
    };
    touched.push(await writeProduct(tx, product, next, {
      reason: 'RETURN_RESTOCKED',
      notes: `Shipment ${shipmentNumber} returned to the warehouse: ${quantity} unit(s) for Order #${orderNumber}`,
      orderNumber,
      actor,
    }));
  }
  if (tracked) {
    await tx.order.updateMany({ where: { id: orderId, inventoryState: INVENTORY_STATES.FULFILLED }, data: { inventoryState: INVENTORY_STATES.COMMITTED } });
  }
  return { touched };
}

/**
 * Payment arrived. Commits a live reservation; if the reservation already lapsed, tries to take the stock again.
 * Returns { committed, unavailable }.
 */
export async function commitForPayment(tx, orderId, actor) {
  const result = await transitionOrderInventory(tx, orderId, 'COMMIT', { actor, reason: 'PAYMENT_CONFIRMED' });
  if (result.applied) return { committed: true, touched: result.touched };

  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true, inventoryState: true, items: { select: { productId: true, quantity: true, shippedQuantity: true } } },
  });
  if (order?.inventoryState !== INVENTORY_STATES.RELEASED) return { committed: false, touched: [] };

  try {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, inventoryState: INVENTORY_STATES.RELEASED },
      data: { inventoryState: INVENTORY_STATES.COMMITTED },
    });
    if (claimed.count === 0) return { committed: false, touched: [] };
    const { touched } = await reserveForNewOrder(tx, { orderNumber: order.orderNumber, items: order.items, commit: true, actor });
    return { committed: true, restored: true, touched };
  } catch (error) {
    if (error.statusCode !== 409 && error.statusCode !== 404) throw error;
    // Keep the payment; the order stays released and needs a refund. Undo the claim.
    await tx.order.updateMany({ where: { id: orderId }, data: { inventoryState: INVENTORY_STATES.RELEASED } });
    return { committed: false, unavailable: true, touched: [] };
  }
}

/**
 * After a transaction commits: push live figures to the product's supplier, to admins, and the public
 * availability to buyers. Raises a low-stock alert when a product crosses its threshold.
 */
export function publishInventoryChanges(touched = [], previous = new Map()) {
  for (const product of touched) {
    const availableStock = availableOf(product);
    const payload = {
      productId: product.id,
      sku: product.sku,
      stock: product.stock,
      reservedStock: product.reservedStock,
      committedStock: product.committedStock,
      availableStock,
      lowStockThreshold: product.lowStockThreshold,
    };
    if (product.supplierId) broadcastInventoryUpdate(product.supplierId, payload);
    broadcastAdminInventory({ ...payload, supplierId: product.supplierId });
    broadcastProductStock(product.id, { sku: product.sku, availableStock, inStock: availableStock > 0 });

    const before = previous.get(product.id);
    const threshold = product.lowStockThreshold ?? 10;
    if (product.supplierId && before !== undefined && before > threshold && availableStock <= threshold) {
      createNotification({
        userId: product.supplierId,
        title: availableStock <= 0 ? `Out of stock: ${product.name}` : `Low stock: ${product.name}`,
        message: availableStock <= 0
          ? `${product.sku} has no units left to sell. Restock to keep it orderable.`
          : `${product.sku} has ${availableStock} unit(s) available (alert level ${threshold}).`,
        type: 'INVENTORY',
        link: `/supplier/inventory?product=${product.id}`,
      }).catch(() => {});
    }
  }
}

/** Snapshot of available units before a change, for threshold-crossing alerts. */
export async function availabilitySnapshot(productIds) {
  const ids = [...new Set(productIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, stock: true, reservedStock: true, committedStock: true },
  });
  return new Map(rows.map((p) => [p.id, availableOf(p)]));
}

/**
 * Runs a stand-alone order transition in its own transaction and publishes the result.
 */
export async function runOrderTransition(orderId, action, options = {}) {
  const items = await prisma.orderItem.findMany({ where: { orderId }, select: { productId: true } });
  const before = await availabilitySnapshot(items.map((i) => i.productId));
  const result = await prisma.$transaction((tx) => transitionOrderInventory(tx, orderId, action, options), TX_OPTIONS);
  publishInventoryChanges(result.touched, before);
  return result;
}

/**
 * Cancels unpaid online orders whose reservation lapsed and gives the stock back. Safe to run on several servers:
 * each order is claimed once.
 */
export async function expireStaleReservations({ now = new Date(), limit = 50 } = {}) {
  const stale = await prisma.order.findMany({
    where: {
      inventoryState: INVENTORY_STATES.RESERVED,
      reservationExpiresAt: { lt: now },
      paymentStatus: { in: ['PENDING', 'FAILED'] },
    },
    select: { id: true, orderNumber: true, userId: true, supplierId: true, orderStatus: true, items: { select: { productId: true } } },
    take: limit,
  });

  let expired = 0;
  for (const order of stale) {
    const before = await availabilitySnapshot(order.items.map((i) => i.productId));
    const result = await prisma.$transaction(async (tx) => {
      const moved = await transitionOrderInventory(tx, order.id, 'RELEASE', {
        reason: 'RESERVATION_EXPIRED',
        notes: `Payment not completed within ${RESERVATION_MINUTES} minutes; reservation for Order #${order.orderNumber} released.`,
        actor: { id: 'SYSTEM', name: 'Reservation expiry' },
      });
      if (moved.applied && ['ORDER_PLACED', 'ORDER_CONFIRMED'].includes(order.orderStatus)) {
        await tx.order.update({
          where: { id: order.id },
          data: { orderStatus: 'CANCELLED', rejectionReason: 'Payment was not completed in time.' },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: 'CANCELLED',
            notes: `Cancelled automatically: payment was not completed within ${RESERVATION_MINUTES} minutes and the reserved stock was released.`,
            changedBy: 'System',
          },
        });
      }
      return moved;
    }, TX_OPTIONS);

    if (!result.applied) continue;
    expired += 1;
    publishInventoryChanges(result.touched, before);
    if (order.userId) {
      createNotification({
        userId: order.userId,
        title: `Order #${order.orderNumber} cancelled`,
        message: 'Payment was not completed in time, so the reserved stock was released. You can place the order again.',
        type: 'ORDER',
        link: '/buyer/orders',
      }).catch(() => {});
    }
  }
  return { checked: stale.length, expired };
}

let sweeper = null;

/** Starts the background reservation sweeper (once per process). */
export function startReservationSweeper(intervalMs = 60 * 1000) {
  if (sweeper) return sweeper;
  sweeper = setInterval(() => {
    expireStaleReservations().catch((err) => console.error('[Inventory] Reservation sweep failed:', err.message));
  }, intervalMs);
  sweeper.unref?.();
  return sweeper;
}

/**
 * Admin check: compares each product's stored reserved/committed figures with the open orders that hold them.
 * Read-only.
 */
export async function getInventoryReconciliation() {
  const openOrders = await prisma.order.findMany({
    where: { inventoryState: { in: [INVENTORY_STATES.RESERVED, INVENTORY_STATES.COMMITTED] } },
    select: { inventoryState: true, items: { select: { productId: true, quantity: true, shippedQuantity: true } } },
  });
  const expected = new Map();
  for (const order of openOrders) {
    for (const [productId, quantity] of quantitiesByProduct(order.items)) {
      const row = expected.get(productId) || { reserved: 0, committed: 0 };
      if (order.inventoryState === INVENTORY_STATES.RESERVED) row.reserved += quantity;
      else row.committed += quantity;
      expected.set(productId, row);
    }
  }

  const products = await prisma.product.findMany({
    where: { OR: [{ reservedStock: { gt: 0 } }, { committedStock: { gt: 0 } }, { id: { in: [...expected.keys()] } }] },
    select: { id: true, sku: true, name: true, supplierId: true, stock: true, reservedStock: true, committedStock: true },
  });

  const mismatches = products
    .map((p) => {
      const want = expected.get(p.id) || { reserved: 0, committed: 0 };
      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        supplierId: p.supplierId,
        stock: p.stock,
        storedReserved: p.reservedStock,
        expectedReserved: want.reserved,
        storedCommitted: p.committedStock,
        expectedCommitted: want.committed,
        negativeAvailable: p.stock - p.reservedStock - p.committedStock < 0,
      };
    })
    .filter((r) => r.storedReserved !== r.expectedReserved || r.storedCommitted !== r.expectedCommitted || r.negativeAvailable);

  return { checkedProducts: products.length, openOrders: openOrders.length, mismatches };
}
