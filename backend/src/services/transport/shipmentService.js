import crypto from 'node:crypto';
import prisma from '../../config/db.js';
import { ENV } from '../../config/env.js';
import { createNotification } from '../notificationService.js';
import { sendDeliveryCodeEmail } from '../emailService.js';
import { isDevOtpAllowed } from '../otpService.js';
import { auditTransport } from './transportAudit.js';
import { getIO } from '../socketService.js';
import { publishInventoryChanges, restockReturnedShipment, shipShipmentItems } from '../inventoryLifecycleService.js';
import { getTransportProvider } from './providers/index.js';
import { driverProblems, loadAssignableFleet, maskLicence, vehicleProblems } from './fleetService.js';
import {
  ACTIVE_STATUSES,
  DISPATCHED_STATUSES,
  PRE_LOADING_STATUSES,
  SHIPMENT_STATUS as S,
  STATUS_LABELS,
  VEHICLE_BUSY_STATUSES,
  assertTransition,
  nextStatuses,
} from './shipmentStateMachine.js';

const TX = { maxWait: 15000, timeout: 30000 };
const OTP_MINUTES = 30;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_SENDS = 5;
const OTP_RESEND_SECONDS = 60;
const DEFAULT_TRIP_HOURS = 48;
const SHIPPABLE_ORDER_STATUSES = ['ORDER_CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY'];
const ISSUE_TYPES = ['DAMAGED', 'MISSING', 'SHORTAGE', 'DELAY', 'BREAKDOWN', 'DELIVERY_FAILED', 'OTHER'];
const DOC_TYPES = ['LR_BILTY', 'EWAY_BILL', 'COMMERCIAL_INVOICE', 'PACKING_LIST', 'WEIGHT_SLIP', 'PICKUP_PROOF', 'POD', 'OTHER'];

const isStaff = (user) => user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

function fail(message, statusCode = 400, extra = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
}

function code(prefix) {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `${prefix}-${date}-${crypto.randomInt(100000, 999999)}`;
}

const actorOf = (user) => ({ id: user.id, name: user.name || user.email || user.role, role: user.role });
const text = (value, max = 2000) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null);

function dateOrNull(value, label) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw fail(`${label} is not a valid date.`);
  return date;
}

function wholeNumber(value, label, { min = 0, max = 1e9 } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw fail(`${label} must be a whole number between ${min} and ${max}.`);
  return number;
}

const hashOtp = (shipmentId, otp) => crypto.createHmac('sha256', ENV.JWT_SECRET).update(`delivery:${shipmentId}:${otp}`).digest('hex');

function otpMatches(shipment, otp) {
  if (!shipment.deliveryOtpHash || !/^\d{6}$/.test(String(otp || ''))) return false;
  const expected = Buffer.from(shipment.deliveryOtpHash, 'hex');
  const actual = Buffer.from(hashOtp(shipment.id, String(otp)), 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// ---------------------------------------------------------------------------
// Loading, access and shared helpers
// ---------------------------------------------------------------------------

const shipmentInclude = {
  items: true,
  order: { select: { id: true, orderNumber: true, orderStatus: true, paymentStatus: true, paymentMethod: true, buyerName: true, buyerEmail: true, buyerPhone: true, buyerCompany: true, userId: true, inventoryState: true } },
  supplier: { select: { id: true, name: true, company: true, phone: true, email: true } },
  vehicle: { include: { company: { select: { id: true, name: true, companyType: true, ownerId: true, status: true } } } },
  driver: true,
  transporter: { select: { id: true, name: true, companyType: true, phone: true } },
  request: true,
  events: { orderBy: { timestamp: 'asc' } },
  documents: { orderBy: { createdAt: 'asc' } },
  deliveryProof: true,
  issues: { orderBy: { createdAt: 'desc' } },
};

function accessWhere(user) {
  if (isStaff(user)) return {};
  if (user.role === 'SUPPLIER') return { supplierId: user.id };
  if (user.role === 'BUYER') return { buyerId: user.id };
  return { id: '__none__' };
}

async function loadShipment(user, shipmentId, tx = prisma) {
  const shipment = await tx.shipment.findFirst({ where: { id: String(shipmentId), ...accessWhere(user) }, include: shipmentInclude });
  if (!shipment) throw fail('Shipment not found.', 404);
  return shipment;
}

/** Moves the shipment from its current status, once. Throws if someone else changed it first. */
async function claimStatus(tx, shipment, to, user, data = {}) {
  assertTransition(shipment.status, to, user.role);
  const claimed = await tx.shipment.updateMany({ where: { id: shipment.id, status: shipment.status }, data: { status: to, ...data } });
  if (claimed.count === 0) throw fail('This shipment was just updated by someone else. Refresh to see its latest status.', 409);
}

async function addEvent(tx, shipment, { status, title, description, location, eventAt, user, eventType = 'STATUS_CHANGE', documents }) {
  return tx.shipmentEvent.create({
    data: {
      shipmentId: shipment.id,
      status: status || shipment.status,
      title,
      description: description || null,
      location: location || null,
      timestamp: eventAt || new Date(),
      recordedAt: new Date(),
      eventType,
      source: shipment.providerCode || 'MANUAL',
      actorId: user?.id || null,
      actorRole: user?.role || 'SYSTEM',
      actorName: user?.name || user?.email || 'System',
      documents: documents?.length ? documents : undefined,
    },
  });
}

/** Window a truck is busy for: from pickup until expected delivery (or two days after pickup). */
function tripWindow(pickupAt, deliveryAt) {
  const start = pickupAt ? new Date(pickupAt) : new Date();
  const end = deliveryAt ? new Date(deliveryAt) : new Date(start.getTime() + DEFAULT_TRIP_HOURS * 3600 * 1000);
  return { start, end };
}

async function assertNoDoubleBooking(tx, { vehicleId, driverId, start, end, excludeShipmentId }) {
  const others = await tx.shipment.findMany({
    where: {
      id: { not: excludeShipmentId },
      status: { in: VEHICLE_BUSY_STATUSES },
      OR: [{ vehicleId }, { driverId }],
    },
    select: { shipmentNumber: true, vehicleId: true, driverId: true, pickupScheduledAt: true, estimatedDeliveryAt: true },
  });
  for (const other of others) {
    const window = tripWindow(other.pickupScheduledAt, other.estimatedDeliveryAt);
    if (window.start < end && start < window.end) {
      const what = other.vehicleId === vehicleId ? 'This truck' : 'This driver';
      throw fail(`${what} is already booked on shipment ${other.shipmentNumber} for an overlapping trip (${window.start.toISOString().slice(0, 16).replace('T', ' ')} to ${window.end.toISOString().slice(0, 16).replace('T', ' ')} UTC).`, 409);
    }
  }
}

/** Marks a truck and driver free again when they have no other booked shipment. */
async function freeFleetIfIdle(tx, vehicleId, driverId, excludeShipmentId) {
  if (vehicleId) {
    const busy = await tx.shipment.count({ where: { vehicleId, id: { not: excludeShipmentId }, status: { in: VEHICLE_BUSY_STATUSES } } });
    if (!busy) await tx.transportVehicle.updateMany({ where: { id: vehicleId, status: { in: ['ASSIGNED', 'IN_TRANSIT'] } }, data: { status: 'AVAILABLE' } });
  }
  if (driverId) {
    const busy = await tx.shipment.count({ where: { driverId, id: { not: excludeShipmentId }, status: { in: VEHICLE_BUSY_STATUSES } } });
    if (!busy) await tx.transportDriver.updateMany({ where: { id: driverId, status: { in: ['ASSIGNED', 'ON_DUTY'] } }, data: { status: 'AVAILABLE' } });
  }
}

/**
 * Keeps the order status in line with its shipments: SHIPPED once anything has left the warehouse, DELIVERED only
 * when every unit of every line has been confirmed received. Never moves an order backwards or out of a closed state.
 */
async function syncOrderStatus(tx, orderId, changedBy) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, orderStatus: true, items: { select: { quantity: true, shippedQuantity: true, deliveredQuantity: true } } },
  });
  if (!order || ['CANCELLED', 'REFUNDED', 'DELIVERED'].includes(order.orderStatus)) return null;
  const allDelivered = order.items.length > 0 && order.items.every((i) => i.deliveredQuantity >= i.quantity);
  const anyShipped = order.items.some((i) => i.shippedQuantity > 0);

  let next = null;
  let notes = '';
  if (allDelivered) {
    next = 'DELIVERED';
    notes = 'All items confirmed received by the buyer.';
  } else if (anyShipped && ['ORDER_PLACED', 'ORDER_CONFIRMED', 'PROCESSING', 'PACKED'].includes(order.orderStatus)) {
    next = 'SHIPPED';
    const fully = order.items.every((i) => i.shippedQuantity >= i.quantity);
    notes = fully ? 'All items dispatched.' : 'First shipment dispatched; the rest of the order will follow in further shipments.';
  }
  if (!next) return null;

  await tx.order.update({ where: { id: orderId }, data: { orderStatus: next, ...(next === 'DELIVERED' ? { deliveryAcceptedAt: new Date() } : {}) } });
  await tx.orderStatusHistory.create({ data: { orderId, status: next, notes, changedBy: changedBy || 'Transport & Delivery' } });
  return { orderNumber: order.orderNumber, status: next };
}

function notify(userId, title, message, link) {
  if (!userId) return;
  createNotification({ userId, title, message, type: 'SHIPMENT', link }).catch(() => {});
}

async function notifyAdmins(title, message, link) {
  const admins = await prisma.user.findMany({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, isActive: true }, select: { id: true } });
  for (const admin of admins) notify(admin.id, title, message, link);
}

function emitShipment(shipment) {
  const io = getIO();
  if (!io || !shipment) return;
  const payload = { shipmentId: shipment.id, shipmentNumber: shipment.shipmentNumber, status: shipment.status, orderId: shipment.orderId, updatedAt: new Date().toISOString() };
  if (shipment.supplierId) io.to(`user:${shipment.supplierId}`).emit('shipment:updated', payload);
  if (shipment.buyerId) io.to(`user:${shipment.buyerId}`).emit('shipment:updated', payload);
  io.to('staff:inventory').emit('shipment:updated', payload);
}

const shipmentLink = (role, shipment) => {
  if (role === 'BUYER') return `/buyer/orders?order=${shipment.order?.orderNumber || ''}&shipment=${shipment.shipmentNumber}`;
  if (role === 'SUPPLIER') return `/supplier/transport?shipment=${shipment.shipmentNumber}`;
  return `/super-admin/transport?shipment=${shipment.shipmentNumber}`;
};

// ---------------------------------------------------------------------------
// Formatting (what each role may see)
// ---------------------------------------------------------------------------

const BUYER_DRIVER_CONTACT_STATUSES = [S.OUT_FOR_DELIVERY, S.DELIVERED_PENDING_CONFIRMATION, S.DELIVERY_FAILED];

export function formatShipment(shipment, viewer, { detail = false } = {}) {
  const buyerView = viewer.role === 'BUYER';
  const delayed = Boolean(
    shipment.estimatedDeliveryAt && ACTIVE_STATUSES.includes(shipment.status) && new Date(shipment.estimatedDeliveryAt) < new Date(),
  );
  const items = (shipment.items || []).map((item) => ({
    id: item.id,
    orderItemId: item.orderItemId,
    productId: item.productId,
    productName: item.productName,
    productSku: item.productSku,
    unit: item.unit,
    quantity: item.quantity,
    loadedQuantity: item.loadedQuantity,
    deliveredQuantity: item.deliveredQuantity,
    damagedQuantity: item.damagedQuantity,
    missingQuantity: item.missingQuantity,
  }));
  const showFreight = !buyerView || shipment.freightPayer === 'BUYER';
  const base = {
    id: shipment.id,
    shipmentNumber: shipment.shipmentNumber,
    trackingNumber: shipment.trackingNumber,
    bookingNumber: shipment.bookingNumber,
    status: shipment.status,
    statusLabel: STATUS_LABELS[shipment.status] || shipment.status,
    delayed,
    transportMethod: shipment.transportMethod,
    providerCode: shipment.providerCode,
    order: shipment.order ? {
      id: shipment.order.id,
      orderNumber: shipment.order.orderNumber,
      orderStatus: shipment.order.orderStatus,
      paymentStatus: shipment.order.paymentStatus,
      buyer: buyerView ? undefined : (shipment.order.buyerCompany || shipment.order.buyerName),
    } : null,
    supplier: shipment.supplier ? { id: shipment.supplier.id, name: shipment.supplier.company || shipment.supplier.name, phone: buyerView ? undefined : shipment.supplier.phone } : null,
    pickupAddress: buyerView ? { city: shipment.pickupAddress?.city, state: shipment.pickupAddress?.state, postalCode: shipment.pickupAddress?.postalCode } : shipment.pickupAddress,
    deliveryAddress: shipment.deliveryAddress,
    items,
    totalQuantity: items.reduce((sum, i) => sum + (i.loadedQuantity ?? i.quantity), 0),
    totalWeightKg: shipment.totalWeightKg === null ? null : Number(shipment.totalWeightKg),
    totalPackages: shipment.totalPackages,
    cargoDimensions: shipment.cargoDimensions,
    handlingRequirements: shipment.handlingRequirements,
    vehicle: shipment.vehicle ? {
      id: buyerView ? undefined : shipment.vehicle.id,
      vehicleNumber: shipment.vehicle.vehicleNumber,
      vehicleType: shipment.vehicle.vehicleType,
      capacityKg: buyerView ? undefined : Math.round(Number(shipment.vehicle.capacityTons) * 1000),
    } : (shipment.vehicleNumber ? { vehicleNumber: shipment.vehicleNumber } : null),
    driver: shipment.driverName ? {
      id: buyerView ? undefined : shipment.driverId,
      name: shipment.driverName,
      phone: buyerView && !BUYER_DRIVER_CONTACT_STATUSES.includes(shipment.status) ? null : shipment.driverPhone,
      licence: buyerView || !shipment.driver ? undefined : maskLicence(shipment.driver.licenseNumber),
    } : null,
    transporter: shipment.transporter ? { name: shipment.transporter.name, type: shipment.transporter.companyType === 'SUPPLIER_FLEET' ? 'SUPPLIER_FLEET' : shipment.transporter.companyType === 'TRADEEXPRESS_PARTNER' ? 'TRADEEXPRESS' : 'EXTERNAL' } : null,
    lrNumber: shipment.lrNumber,
    ewayBillNumber: shipment.ewayBillNumber,
    freight: showFreight ? {
      charges: Number(shipment.freightCharges || 0),
      payer: shipment.freightPayer,
      paymentStatus: shipment.freightPaymentStatus,
    } : null,
    pickupScheduledAt: shipment.pickupScheduledAt,
    loadedAt: shipment.loadedAt,
    dispatchedAt: shipment.dispatchedAt,
    estimatedDeliveryAt: shipment.estimatedDeliveryAt,
    deliveryRequiredBy: shipment.deliveryRequiredBy,
    arrivedAt: shipment.arrivedAt,
    deliveredAt: shipment.deliveredAt,
    cancelledAt: shipment.cancelledAt,
    lastReportedLocation: shipment.lastReportedLocation,
    lastReportedAt: shipment.lastReportedAt,
    deliveryFailedReason: shipment.deliveryFailedReason,
    awaitingDeliveryCode: shipment.status === S.DELIVERED_PENDING_CONFIRMATION,
    deliveryCodeExpiresAt: shipment.status === S.DELIVERED_PENDING_CONFIRMATION ? shipment.deliveryOtpExpiresAt : null,
    openIssues: (shipment.issues || []).filter((i) => ['OPEN', 'IN_REVIEW'].includes(i.status)).length,
    createdAt: shipment.createdAt,
    updatedAt: shipment.updatedAt,
  };
  if (!detail) return base;

  return {
    ...base,
    nextStatuses: nextStatuses(shipment.status, viewer.role),
    request: shipment.request && !buyerView ? {
      id: shipment.request.id,
      requestNumber: shipment.request.requestNumber,
      status: shipment.request.status,
      rejectionReason: shipment.request.rejectionReason,
      pickupDate: shipment.request.pickupDate,
      approvedFreight: shipment.request.approvedFreight === null ? null : Number(shipment.request.approvedFreight),
    } : null,
    events: (shipment.events || []).map((e) => ({
      id: e.id,
      status: e.status,
      statusLabel: STATUS_LABELS[e.status] || e.status,
      eventType: e.eventType,
      title: e.title,
      description: e.description,
      location: e.location,
      eventAt: e.timestamp,
      recordedAt: e.recordedAt,
      source: e.source,
      by: buyerView ? (e.actorRole === 'BUYER' ? 'You' : e.actorRole === 'SUPPLIER' ? 'Supplier' : e.actorRole === 'SYSTEM' ? 'TradeExpress' : 'TradeExpress operations') : `${e.actorName || 'System'} (${e.actorRole || 'SYSTEM'})`,
      documents: e.documents || [],
    })),
    documents: (shipment.documents || []).map((d) => ({ id: d.id, docType: d.docType, docNumber: d.docNumber, title: d.title, fileUrl: d.fileUrl, fileName: d.fileName, uploadedByRole: d.uploadedByRole, createdAt: d.createdAt })),
    deliveryProof: shipment.deliveryProof ? {
      recipientName: shipment.deliveryProof.recipientName,
      otpVerified: shipment.deliveryProof.otpVerified,
      condition: shipment.deliveryProof.condition,
      receiverNotes: shipment.deliveryProof.receiverNotes,
      photoProofUrls: shipment.deliveryProof.photoProofUrls || [],
      receivedAt: shipment.deliveryProof.receivedAt,
    } : null,
    issues: (shipment.issues || []).map((i) => ({ id: i.id, issueType: i.issueType, description: i.description, quantity: i.quantity, photoUrls: i.photoUrls || [], status: i.status, resolution: i.resolution, reportedByRole: i.reportedByRole, createdAt: i.createdAt, resolvedAt: i.resolvedAt })),
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listShipments(user, { status, search, orderId, supplierId, delayed, page = 1, limit = 20 } = {}) {
  const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * take;
  const where = { AND: [accessWhere(user)] };
  if (status) where.AND.push({ status: { in: String(status).split(',') } });
  if (orderId) where.AND.push({ orderId: String(orderId) });
  if (supplierId && isStaff(user)) where.AND.push({ supplierId: String(supplierId) });
  if (delayed === 'true') where.AND.push({ status: { in: ACTIVE_STATUSES }, estimatedDeliveryAt: { lt: new Date() } });
  if (search) {
    const q = String(search).trim();
    where.AND.push({ OR: [{ shipmentNumber: { contains: q } }, { trackingNumber: { contains: q } }, { bookingNumber: { contains: q } }, { vehicleNumber: { contains: q.toUpperCase().replace(/[\s-]/g, '') } }, { order: { orderNumber: { contains: q } } }] });
  }
  const listInclude = { items: true, order: shipmentInclude.order, supplier: shipmentInclude.supplier, vehicle: shipmentInclude.vehicle, driver: true, transporter: shipmentInclude.transporter, issues: { where: { status: { in: ['OPEN', 'IN_REVIEW'] } }, select: { id: true, status: true } } };
  const [total, rows] = await Promise.all([
    prisma.shipment.count({ where }),
    prisma.shipment.findMany({ where, include: listInclude, orderBy: { updatedAt: 'desc' }, skip, take }),
  ]);
  return { shipments: rows.map((row) => formatShipment(row, user)), pagination: { total, page: Math.floor(skip / take) + 1, limit: take, totalPages: Math.ceil(total / take) || 1 } };
}

export async function getShipment(user, shipmentId) {
  return formatShipment(await loadShipment(user, shipmentId), user, { detail: true });
}

/** All shipments of one order (a buyer sees each shipment separately under the same order). */
export async function getOrderShipments(user, orderIdOrNumber) {
  const order = await prisma.order.findFirst({
    where: { OR: [{ id: String(orderIdOrNumber) }, { orderNumber: String(orderIdOrNumber) }] },
    select: { id: true, orderNumber: true, userId: true, supplierId: true, orderStatus: true, items: { select: { id: true, productName: true, productSku: true, unit: true, quantity: true, allocatedQuantity: true, shippedQuantity: true, deliveredQuantity: true } } },
  });
  if (!order) throw fail('Order not found.', 404);
  if (!isStaff(user)) {
    const own = user.role === 'BUYER' ? order.userId === user.id : order.supplierId === user.id || (await prisma.shipment.count({ where: { orderId: order.id, supplierId: user.id } })) > 0;
    if (!own) throw fail('Order not found.', 404);
  }
  const shipments = await prisma.shipment.findMany({ where: { orderId: order.id, ...accessWhere(user) }, include: shipmentInclude, orderBy: { createdAt: 'asc' } });
  return {
    order: { id: order.id, orderNumber: order.orderNumber, orderStatus: order.orderStatus, items: order.items },
    shipments: shipments.map((s) => formatShipment(s, user, { detail: true })),
  };
}

/** Orders the supplier (or an admin) can still create shipments for, with the unallocated quantity per line. */
export async function listShippableOrders(user, { search } = {}) {
  const supplierFilter = isStaff(user) ? {} : { OR: [{ supplierId: user.id }, { items: { some: { product: { supplierId: user.id } } } }] };
  const orders = await prisma.order.findMany({
    where: {
      orderStatus: { in: SHIPPABLE_ORDER_STATUSES },
      ...supplierFilter,
      OR: [{ inventoryState: 'COMMITTED' }, { inventoryState: null, paymentStatus: { in: ['PAID', 'PARTIALLY_PAID', 'COD'] } }],
      ...(search ? { orderNumber: { contains: String(search) } } : {}),
    },
    select: {
      id: true, orderNumber: true, orderStatus: true, paymentStatus: true, paymentMethod: true, buyerName: true, buyerCompany: true, deliveryAddress: true, createdAt: true, supplierId: true,
      items: { select: { id: true, productId: true, productName: true, productSku: true, unit: true, quantity: true, allocatedQuantity: true, shippedQuantity: true, product: { select: { supplierId: true, weightKg: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return orders
    .map((order) => {
      const items = order.items
        .filter((item) => isStaff(user) || (item.product ? item.product.supplierId === user.id : order.supplierId === user.id))
        .map((item) => ({
          orderItemId: item.id,
          productId: item.productId,
          productName: item.productName,
          productSku: item.productSku,
          unit: item.unit,
          quantity: item.quantity,
          allocatedQuantity: item.allocatedQuantity,
          remainingQuantity: item.quantity - item.allocatedQuantity,
          unitWeightKg: item.product?.weightKg ? Number(item.product.weightKg) : null,
          supplierId: item.product?.supplierId || order.supplierId,
        }));
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        buyer: order.buyerCompany || order.buyerName,
        deliveryAddress: order.deliveryAddress,
        createdAt: order.createdAt,
        items,
        remainingQuantity: items.reduce((sum, i) => sum + i.remainingQuantity, 0),
      };
    })
    .filter((order) => order.remainingQuantity > 0);
}

export async function getOverview(user) {
  const scope = accessWhere(user);
  const [byStatus, delayed, requests, openIssues] = await Promise.all([
    prisma.shipment.groupBy({ by: ['status'], where: scope, _count: true }),
    prisma.shipment.count({ where: { ...scope, status: { in: ACTIVE_STATUSES }, estimatedDeliveryAt: { lt: new Date() } } }),
    prisma.transportRequest.groupBy({ by: ['status'], where: isStaff(user) ? {} : { supplierId: user.id }, _count: true }),
    prisma.shipmentIssue.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] }, shipment: scope } }),
  ]);
  const counts = Object.fromEntries(Object.values(S).map((status) => [status, 0]));
  for (const row of byStatus) counts[row.status] = row._count;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const requestCounts = Object.fromEntries(requests.map((r) => [r.status, r._count]));
  const result = {
    total,
    byStatus: counts,
    awaitingTransport: counts.AWAITING_TRANSPORT,
    transportRequested: counts.TRANSPORT_REQUESTED,
    truckAssigned: counts.TRANSPORT_ASSIGNED,
    readyForPickup: counts.PICKUP_SCHEDULED + counts.LOADING_IN_PROGRESS + counts.LOADED,
    inTransit: counts.PICKED_UP + counts.IN_TRANSIT + counts.OUT_FOR_DELIVERY + counts.DELIVERED_PENDING_CONFIRMATION,
    delivered: counts.DELIVERED,
    delayed,
    failed: counts.DELIVERY_FAILED,
    returning: counts.RETURN_IN_TRANSIT + counts.RETURNED,
    pendingRequests: requestCounts.PENDING || 0,
    openIssues,
  };
  if (user.role === 'SUPPLIER') {
    result.shippableOrders = (await listShippableOrders(user)).length;
  }
  if (isStaff(user)) {
    const charges = await prisma.shipment.aggregate({ where: { status: { not: S.CANCELLED } }, _sum: { freightCharges: true } });
    result.freightCharges = Number(charges._sum.freightCharges || 0);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/** Pickup defaults to the supplier's warehouse address, then their business address. */
function pickupFromProfile(profile, input = {}) {
  const useWarehouse = Boolean(profile?.warehouseAddress);
  const pickup = {
    line1: text(input.line1, 200) || (useWarehouse ? profile.warehouseAddress : profile?.businessAddress) || null,
    city: text(input.city, 100) || profile?.city || null,
    state: text(input.state, 100) || (useWarehouse ? profile.warehouseState : null) || profile?.state || null,
    postalCode: text(input.postalCode, 10) || (useWarehouse ? profile.warehousePincode : null) || profile?.postalCode || null,
    country: 'India',
    contactName: text(input.contactName, 100) || profile?.name || null,
    contactPhone: text(input.contactPhone, 20) || profile?.phone || null,
    warehouse: text(input.warehouse, 120),
  };
  if (!pickup.line1 || !pickup.city || !pickup.postalCode) throw fail('Pickup address (street, city and PIN code) is required. Add it here or in your company profile.');
  if (!/^\d{6}$/.test(String(pickup.postalCode))) throw fail('Pickup PIN code must be 6 digits.');
  if (!pickup.contactPhone) throw fail('A pickup contact phone number is required.');
  return pickup;
}

/**
 * Creates a shipment for some (or all) of an order's remaining quantities. Allocation is claimed with a conditional
 * update per line, so the same units can never be put on two shipments and an order can never be overshipped.
 */
export async function createShipment(user, data, req) {
  if (!data?.orderId) throw fail('Choose the order to ship.');
  const requested = (Array.isArray(data.items) ? data.items : []).filter((i) => Number(i.quantity) > 0);
  if (!requested.length) throw fail('Add at least one product and quantity to this shipment.');

  const order = await prisma.order.findFirst({
    where: { OR: [{ id: String(data.orderId) }, { orderNumber: String(data.orderId) }] },
    include: { items: { include: { product: { select: { supplierId: true, weightKg: true } } } } },
  });
  if (!order) throw fail('Order not found.', 404);

  const lineSupplier = (item) => item.product?.supplierId || order.supplierId;
  const lines = requested.map((r) => {
    const item = order.items.find((i) => i.id === r.orderItemId);
    if (!item) throw fail('One of the products is not part of this order.');
    if (!isStaff(user) && lineSupplier(item) !== user.id) throw fail('Order not found.', 404);
    const quantity = wholeNumber(r.quantity, `Quantity for ${item.productName}`, { min: 1, max: item.quantity });
    if (quantity > item.quantity - item.allocatedQuantity) {
      throw fail(`${item.productName}: only ${item.quantity - item.allocatedQuantity} ${item.unit}(s) are left to ship on this order.`, 409);
    }
    return { item, quantity };
  });
  const supplierIds = [...new Set(lines.map(({ item }) => lineSupplier(item)))];
  if (supplierIds.length !== 1 || !supplierIds[0]) throw fail('A shipment can only carry one supplier\'s products. Create one shipment per supplier.');
  const supplierId = supplierIds[0];

  if (!SHIPPABLE_ORDER_STATUSES.includes(order.orderStatus)) {
    throw fail(order.orderStatus === 'ORDER_PLACED' ? 'Confirm the order before arranging its shipment.' : `An order that is ${order.orderStatus.toLowerCase().replace(/_/g, ' ')} cannot be shipped.`, 409);
  }
  const paid = order.inventoryState === 'COMMITTED' || (!order.inventoryState && ['PAID', 'PARTIALLY_PAID', 'COD'].includes(order.paymentStatus));
  if (!paid) throw fail('This order is not paid yet. Shipments can be arranged once payment is confirmed (or for Cash on Delivery orders).', 409);

  const profile = await prisma.user.findUnique({ where: { id: supplierId }, select: { name: true, phone: true, businessAddress: true, warehouseAddress: true, warehouseState: true, warehousePincode: true, city: true, state: true, postalCode: true } });
  const pickupAddress = pickupFromProfile(profile, data.pickupAddress);
  const delivery = typeof order.deliveryAddress === 'object' ? order.deliveryAddress : {};
  const deliveryAddress = { ...delivery, contactName: delivery.contactName || order.buyerName, contactPhone: delivery.phone || delivery.contactPhone || order.buyerPhone, company: order.buyerCompany || null };

  const estimatedWeight = lines.reduce((sum, { item, quantity }) => sum + (item.product?.weightKg ? Number(item.product.weightKg) * quantity : 0), 0);
  const totalWeightKg = data.totalWeightKg !== undefined && data.totalWeightKg !== '' ? Number(data.totalWeightKg) : (estimatedWeight || null);
  if (totalWeightKg !== null && (!Number.isFinite(totalWeightKg) || totalWeightKg <= 0 || totalWeightKg > 60000)) throw fail('Cargo weight must be between 1 and 60,000 kg.');
  const totalPackages = data.totalPackages ? wholeNumber(data.totalPackages, 'Number of packages', { min: 1, max: 100000 }) : null;

  const shipment = await prisma.$transaction(async (tx) => {
    for (const { item, quantity } of lines) {
      const claimed = await tx.$executeRaw`
        UPDATE order_items SET allocatedQuantity = allocatedQuantity + ${quantity}
        WHERE id = ${item.id} AND allocatedQuantity + ${quantity} <= quantity
      `;
      if (claimed === 0) throw fail(`${item.productName}: these units were just put on another shipment. Refresh and try again.`, 409);
    }
    const created = await tx.shipment.create({
      data: {
        shipmentNumber: code('SH'),
        trackingNumber: code('TRK'),
        orderId: order.id,
        transportMethod: 'UNDECIDED',
        supplierId,
        buyerId: order.userId,
        pickupAddress,
        deliveryAddress,
        cargoDetails: {
          description: lines.map(({ item, quantity }) => `${quantity} ${item.unit} ${item.productName}`).join(', '),
          lines: lines.map(({ item, quantity }) => ({ orderItemId: item.id, quantity })),
        },
        totalWeightKg,
        totalPackages,
        cargoDimensions: data.cargoDimensions || undefined,
        handlingRequirements: text(data.handlingRequirements),
        deliveryRequiredBy: dateOrNull(data.deliveryRequiredBy, 'Delivery required by'),
        notes: text(data.notes),
        status: S.AWAITING_TRANSPORT,
        createdById: user.id,
        items: {
          create: lines.map(({ item, quantity }) => ({
            orderItemId: item.id,
            productId: item.productId,
            productName: item.productName,
            productSku: item.productSku,
            unit: item.unit,
            quantity,
          })),
        },
      },
    });
    await addEvent(tx, created, { status: S.AWAITING_TRANSPORT, title: 'Shipment created', description: `${lines.map(({ item, quantity }) => `${quantity} ${item.unit} of ${item.productName}`).join(', ')} prepared for transport.`, user });
    return created;
  }, TX);

  if (isStaff(user)) await auditTransport({ req, action: 'SHIPMENT_CREATED', targetId: shipment.id, details: { orderNumber: order.orderNumber } });
  const full = await loadShipment(user, shipment.id);
  emitShipment(full);
  return formatShipment(full, user, { detail: true });
}

// ---------------------------------------------------------------------------
// Transport arrangement
// ---------------------------------------------------------------------------

/**
 * Validates and books a truck and driver for a shipment (inside the caller's transaction) and moves it to
 * TRANSPORT_ASSIGNED. Used by suppliers for their own trucks and by admins arranging transport.
 */
async function assignTransportTx(tx, user, shipment, input) {
  const pickupAt = dateOrNull(input.pickupScheduledAt, 'Pickup date and time');
  if (!pickupAt) throw fail('Choose the pickup date and time.');
  if (pickupAt.getTime() < Date.now() - 3600 * 1000) throw fail('Pickup time cannot be in the past.');
  const deliveryAt = dateOrNull(input.estimatedDeliveryAt, 'Estimated delivery');
  if (deliveryAt && deliveryAt <= pickupAt) throw fail('Estimated delivery must be after pickup.');
  const { start, end } = tripWindow(pickupAt, deliveryAt);

  const { vehicle, driver } = await loadAssignableFleet(user, { vehicleId: input.vehicleId, driverId: input.driverId, shipmentSupplierId: shipment.supplierId }, tx);
  const problems = [...vehicleProblems(vehicle, end), ...driverProblems(driver, end)];
  if (problems.length) throw fail(`This truck or driver cannot be used: ${problems.join(' ')}`, 409, { problems });
  const capacityKg = Number(vehicle.capacityTons) * 1000;
  if (shipment.totalWeightKg && Number(shipment.totalWeightKg) > capacityKg) {
    throw fail(`The cargo (${Number(shipment.totalWeightKg).toLocaleString('en-IN')} kg) is heavier than this truck can carry (${capacityKg.toLocaleString('en-IN')} kg). Choose a bigger truck or split the order into more shipments.`, 409);
  }
  await assertNoDoubleBooking(tx, { vehicleId: vehicle.id, driverId: driver.id, start, end, excludeShipmentId: shipment.id });

  const freightCharges = input.freightCharges !== undefined && input.freightCharges !== '' ? Number(input.freightCharges) : Number(shipment.freightCharges || 0);
  if (!Number.isFinite(freightCharges) || freightCharges < 0 || freightCharges > 10000000) throw fail('Freight charges must be a positive amount.');
  const freightPayer = input.freightPayer || shipment.freightPayer || 'SUPPLIER';
  if (!['SUPPLIER', 'BUYER', 'PLATFORM'].includes(freightPayer)) throw fail('Freight payer must be supplier, buyer or TradeExpress.');

  const provider = getTransportProvider(shipment.providerCode || 'MANUAL');
  const booking = await provider.bookVehicle({ shipment, vehicle, driver, pickupAt });
  const ownFleet = vehicle.company.companyType === 'SUPPLIER_FLEET';

  await claimStatus(tx, shipment, S.TRANSPORT_ASSIGNED, user, {
    vehicleId: vehicle.id,
    driverId: driver.id,
    transporterId: vehicle.companyId,
    vehicleNumber: vehicle.vehicleNumber,
    driverName: driver.name,
    driverPhone: driver.phone,
    bookingNumber: shipment.bookingNumber || code('BK'),
    externalReference: booking?.externalReference || null,
    transportMethod: ownFleet ? 'SUPPLIER_MANAGED' : 'TRADEEXPRESS_MANAGED',
    pickupScheduledAt: pickupAt,
    estimatedDeliveryAt: deliveryAt,
    freightCharges,
    freightPayer,
    freightPaymentStatus: freightCharges > 0 ? 'PENDING' : 'NOT_APPLICABLE',
  });
  await tx.transportVehicle.update({ where: { id: vehicle.id }, data: { status: 'ASSIGNED', lastAssignedAt: new Date() } });
  await tx.transportDriver.update({ where: { id: driver.id }, data: { status: 'ASSIGNED', assignedVehicleId: vehicle.id } });
  await addEvent(tx, shipment, {
    status: S.TRANSPORT_ASSIGNED,
    title: 'Truck assigned',
    description: `${vehicle.vehicleNumber} (${vehicle.vehicleType.replace(/_/g, ' ').toLowerCase()}) with driver ${driver.name} from ${vehicle.company.name}. Pickup ${pickupAt.toISOString().slice(0, 16).replace('T', ' ')} UTC.`,
    user,
  });
  return { vehicle, driver };
}

/** Supplier assigns a truck from their own fleet (or an admin assigns one directly). */
export async function assignOwnTruck(user, shipmentId, input, req) {
  const shipment = await loadShipment(user, shipmentId);
  if (shipment.status !== S.AWAITING_TRANSPORT) throw fail(`Transport can be assigned while the shipment is awaiting transport (it is ${STATUS_LABELS[shipment.status].toLowerCase()}).`, 409);
  await prisma.$transaction((tx) => assignTransportTx(tx, user, shipment, input), TX);
  if (isStaff(user)) {
    await auditTransport({ req, action: 'SHIPMENT_TRUCK_ASSIGNED', targetId: shipment.id, details: { vehicleId: input.vehicleId, driverId: input.driverId } });
    notify(shipment.supplierId, `Truck assigned: ${shipment.shipmentNumber}`, 'TradeExpress assigned a truck to your shipment.', shipmentLink('SUPPLIER', shipment));
  }
  const full = await loadShipment(user, shipmentId);
  emitShipment(full);
  notify(full.buyerId, `Truck assigned for order #${full.order?.orderNumber}`, `Shipment ${full.shipmentNumber} has a truck booked for pickup.`, shipmentLink('BUYER', full));
  return formatShipment(full, user, { detail: true });
}

/** Supplier has no truck: ask TradeExpress to arrange one. */
export async function requestTransport(user, shipmentId, input) {
  const shipment = await loadShipment(user, shipmentId);
  const pickupDate = dateOrNull(input.pickupDate, 'Requested pickup date');
  if (!pickupDate) throw fail('Choose the date the goods will be ready for pickup.');
  if (pickupDate.getTime() < Date.now() - 24 * 3600 * 1000) throw fail('Requested pickup date cannot be in the past.');
  const expectedDeliveryDate = dateOrNull(input.expectedDeliveryDate, 'Required delivery date');
  const targetFreight = input.targetFreight !== undefined && input.targetFreight !== '' ? Number(input.targetFreight) : null;
  if (targetFreight !== null && (!Number.isFinite(targetFreight) || targetFreight < 0)) throw fail('Target freight must be a positive amount.');

  const request = await prisma.$transaction(async (tx) => {
    await claimStatus(tx, shipment, S.TRANSPORT_REQUESTED, user);
    const created = await tx.transportRequest.create({
      data: {
        requestNumber: code('TR'),
        orderId: shipment.orderId,
        supplierId: shipment.supplierId,
        pickupAddress: shipment.pickupAddress,
        deliveryAddress: shipment.deliveryAddress,
        cargoDetails: {
          ...(shipment.cargoDetails || {}),
          totalWeightKg: shipment.totalWeightKg === null ? null : Number(shipment.totalWeightKg),
          totalPackages: shipment.totalPackages,
          preferredVehicleType: text(input.preferredVehicleType, 40),
        },
        pickupDate,
        expectedDeliveryDate,
        targetFreight,
        loadingRequirements: text(input.loadingRequirements),
        status: 'PENDING',
      },
    });
    await tx.shipment.update({ where: { id: shipment.id }, data: { requestId: created.id } });
    await addEvent(tx, shipment, { status: S.TRANSPORT_REQUESTED, title: 'Transport requested from TradeExpress', description: `Request ${created.requestNumber}: goods ready on ${pickupDate.toISOString().slice(0, 10)}.`, user });
    return created;
  }, TX);

  notifyAdmins(`Transport request ${request.requestNumber}`, `${shipment.supplier?.company || shipment.supplier?.name} needs a truck for shipment ${shipment.shipmentNumber}.`, `/super-admin/transport?request=${request.requestNumber}`);
  const full = await loadShipment(user, shipmentId);
  emitShipment(full);
  return formatShipment(full, user, { detail: true });
}

function formatRequest(r) {
  return {
    id: r.id,
    requestNumber: r.requestNumber,
    status: r.status,
    pickupDate: r.pickupDate,
    expectedDeliveryDate: r.expectedDeliveryDate,
    pickupAddress: r.pickupAddress,
    deliveryAddress: r.deliveryAddress,
    cargoDetails: r.cargoDetails,
    targetFreight: r.targetFreight === null ? null : Number(r.targetFreight),
    approvedFreight: r.approvedFreight === null ? null : Number(r.approvedFreight),
    freightPayer: r.freightPayer,
    loadingRequirements: r.loadingRequirements,
    rejectionReason: r.rejectionReason,
    reviewedAt: r.reviewedAt,
    notes: r.notes,
    supplier: r.supplier ? { id: r.supplier.id, name: r.supplier.company || r.supplier.name } : null,
    order: r.order ? { id: r.order.id, orderNumber: r.order.orderNumber } : null,
    shipment: r.shipment ? { id: r.shipment.id, shipmentNumber: r.shipment.shipmentNumber, status: r.shipment.status, totalWeightKg: r.shipment.totalWeightKg === null ? null : Number(r.shipment.totalWeightKg) } : null,
    createdAt: r.createdAt,
  };
}

export async function listRequests(user, { status } = {}) {
  const requests = await prisma.transportRequest.findMany({
    where: { ...(isStaff(user) ? {} : { supplierId: user.id }), ...(status ? { status: { in: String(status).split(',') } } : {}) },
    include: { supplier: { select: { id: true, name: true, company: true } }, order: { select: { id: true, orderNumber: true } }, shipment: { select: { id: true, shipmentNumber: true, status: true, totalWeightKg: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return requests.map(formatRequest);
}

async function loadPendingRequest(requestId) {
  const request = await prisma.transportRequest.findUnique({ where: { id: String(requestId) }, include: { shipment: { select: { id: true } } } });
  if (!request) throw fail('Transport request not found.', 404);
  if (request.status !== 'PENDING') throw fail(`This request is already ${request.status.toLowerCase()}.`, 409);
  if (!request.shipment) throw fail('This request is no longer linked to a shipment.', 409);
  return request;
}

/** Super Admin approves a supplier's request and assigns a truck, driver and freight in one step. */
export async function approveRequest(adminUser, requestId, input, req) {
  const request = await loadPendingRequest(requestId);
  const shipment = await loadShipment(adminUser, request.shipment.id);
  const approvedFreight = input.approvedFreight !== undefined && input.approvedFreight !== '' ? Number(input.approvedFreight) : null;
  if (approvedFreight === null || !Number.isFinite(approvedFreight) || approvedFreight < 0) throw fail('Enter the approved freight charges (0 if TradeExpress covers it).');
  const freightPayer = input.freightPayer || 'SUPPLIER';

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.transportRequest.updateMany({
      where: { id: request.id, status: 'PENDING' },
      data: { status: 'APPROVED', reviewedById: adminUser.id, reviewedAt: new Date(), approvedFreight, freightPayer, notes: text(input.notes) },
    });
    if (claimed.count === 0) throw fail('This request was just reviewed by someone else.', 409);
    await assignTransportTx(tx, adminUser, shipment, { ...input, freightCharges: approvedFreight, freightPayer });
  }, TX);

  await auditTransport({ req, action: 'TRANSPORT_REQUEST_APPROVED', targetId: request.id, details: { requestNumber: request.requestNumber, vehicleId: input.vehicleId, driverId: input.driverId, approvedFreight, freightPayer } });
  const full = await loadShipment(adminUser, shipment.id);
  emitShipment(full);
  notify(full.supplierId, `Truck arranged: ${request.requestNumber}`, `TradeExpress assigned ${full.vehicleNumber} (driver ${full.driverName}) to shipment ${full.shipmentNumber}.`, shipmentLink('SUPPLIER', full));
  notify(full.buyerId, `Truck assigned for order #${full.order?.orderNumber}`, `Shipment ${full.shipmentNumber} has a truck booked for pickup.`, shipmentLink('BUYER', full));
  return formatShipment(full, adminUser, { detail: true });
}

export async function rejectRequest(adminUser, requestId, { reason }, req) {
  const why = text(reason, 1000);
  if (!why || why.length < 5) throw fail('Give the supplier a reason for rejecting the request.');
  const request = await loadPendingRequest(requestId);
  const shipment = await loadShipment(adminUser, request.shipment.id);
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.transportRequest.updateMany({ where: { id: request.id, status: 'PENDING' }, data: { status: 'REJECTED', rejectionReason: why, reviewedById: adminUser.id, reviewedAt: new Date() } });
    if (claimed.count === 0) throw fail('This request was just reviewed by someone else.', 409);
    await claimStatus(tx, shipment, S.AWAITING_TRANSPORT, adminUser);
    await addEvent(tx, shipment, { status: S.AWAITING_TRANSPORT, title: 'Transport request rejected', description: why, user: adminUser });
  }, TX);
  await auditTransport({ req, action: 'TRANSPORT_REQUEST_REJECTED', targetId: request.id, details: { requestNumber: request.requestNumber, reason: why } });
  notify(shipment.supplierId, `Transport request ${request.requestNumber} rejected`, why, shipmentLink('SUPPLIER', shipment));
  emitShipment(shipment);
  return listRequests(adminUser, {}).then((rows) => rows.find((r) => r.id === request.id));
}

/** Supplier withdraws a pending request; the shipment goes back to awaiting transport. */
export async function cancelRequest(user, requestId) {
  const request = await loadPendingRequest(requestId);
  if (!isStaff(user) && request.supplierId !== user.id) throw fail('Transport request not found.', 404);
  const shipment = await loadShipment(user, request.shipment.id);
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.transportRequest.updateMany({ where: { id: request.id, status: 'PENDING' }, data: { status: 'CANCELLED', reviewedAt: new Date() } });
    if (claimed.count === 0) throw fail('This request was just reviewed.', 409);
    await claimStatus(tx, shipment, S.AWAITING_TRANSPORT, user);
    await addEvent(tx, shipment, { status: S.AWAITING_TRANSPORT, title: 'Transport request withdrawn', user });
  }, TX);
  emitShipment(shipment);
  return { success: true };
}

/** Releases the booked truck before loading (breakdown, reassignment); the shipment needs transport again. */
export async function releaseTransport(user, shipmentId, { reason }, req) {
  const why = text(reason, 1000);
  if (!why) throw fail('Give a reason for releasing the truck.');
  const shipment = await loadShipment(user, shipmentId);
  if (![S.TRANSPORT_ASSIGNED, S.PICKUP_SCHEDULED].includes(shipment.status)) throw fail('A truck can only be released before loading starts. After dispatch, use Change truck.', 409);
  await prisma.$transaction(async (tx) => {
    await claimStatus(tx, shipment, S.AWAITING_TRANSPORT, user, { vehicleId: null, driverId: null, transporterId: null, vehicleNumber: null, driverName: null, driverPhone: null, transportMethod: 'UNDECIDED' });
    await freeFleetIfIdle(tx, shipment.vehicleId, shipment.driverId, shipment.id);
    await addEvent(tx, shipment, { status: S.AWAITING_TRANSPORT, title: 'Truck released', description: why, user });
  }, TX);
  if (isStaff(user)) await auditTransport({ req, action: 'SHIPMENT_TRUCK_RELEASED', targetId: shipment.id, details: { reason: why } });
  const full = await loadShipment(user, shipmentId);
  emitShipment(full);
  return formatShipment(full, user, { detail: true });
}

/**
 * Replaces the truck and/or driver without changing the shipment status, e.g. after a breakdown in transit.
 * Same document, capacity and double-booking checks as a new assignment.
 */
export async function changeTransport(user, shipmentId, input, req) {
  const why = text(input.reason, 1000);
  if (!why) throw fail('Give a reason for changing the truck or driver.');
  const shipment = await loadShipment(user, shipmentId);
  const allowed = [S.TRANSPORT_ASSIGNED, S.PICKUP_SCHEDULED, S.LOADING_IN_PROGRESS, S.LOADED, S.PICKED_UP, S.IN_TRANSIT, S.DELIVERY_FAILED];
  if (!allowed.includes(shipment.status)) throw fail('The truck cannot be changed at this stage.', 409);
  if (!isStaff(user) && shipment.transportMethod === 'TRADEEXPRESS_MANAGED') throw fail('TradeExpress arranged this truck. Report the problem and the operations team will reassign it.', 403);

  const { start, end } = tripWindow(shipment.pickupScheduledAt, shipment.estimatedDeliveryAt);
  await prisma.$transaction(async (tx) => {
    const { vehicle, driver } = await loadAssignableFleet(user, { vehicleId: input.vehicleId, driverId: input.driverId, shipmentSupplierId: shipment.supplierId }, tx);
    const problems = [...vehicleProblems(vehicle, end), ...driverProblems(driver, end)];
    if (problems.length) throw fail(`This truck or driver cannot be used: ${problems.join(' ')}`, 409, { problems });
    if (shipment.totalWeightKg && Number(shipment.totalWeightKg) > Number(vehicle.capacityTons) * 1000) throw fail('The cargo is heavier than this truck can carry.', 409);
    await assertNoDoubleBooking(tx, { vehicleId: vehicle.id, driverId: driver.id, start, end, excludeShipmentId: shipment.id });
    const updated = await tx.shipment.updateMany({
      where: { id: shipment.id, status: shipment.status },
      data: { vehicleId: vehicle.id, driverId: driver.id, transporterId: vehicle.companyId, vehicleNumber: vehicle.vehicleNumber, driverName: driver.name, driverPhone: driver.phone },
    });
    if (updated.count === 0) throw fail('This shipment was just updated by someone else. Refresh and try again.', 409);
    const moving = DISPATCHED_STATUSES.includes(shipment.status);
    await tx.transportVehicle.update({ where: { id: vehicle.id }, data: { status: moving ? 'IN_TRANSIT' : 'ASSIGNED', lastAssignedAt: new Date() } });
    await tx.transportDriver.update({ where: { id: driver.id }, data: { status: moving ? 'ON_DUTY' : 'ASSIGNED', assignedVehicleId: vehicle.id } });
    await freeFleetIfIdle(tx, shipment.vehicleId !== vehicle.id ? shipment.vehicleId : null, shipment.driverId !== driver.id ? shipment.driverId : null, shipment.id);
    await addEvent(tx, shipment, { title: 'Truck or driver changed', description: `${shipment.vehicleNumber || '—'} / ${shipment.driverName || '—'} replaced by ${vehicle.vehicleNumber} / ${driver.name}. Reason: ${why}`, user, eventType: 'NOTE', location: text(input.location, 200) });
  }, TX);
  if (isStaff(user)) await auditTransport({ req, action: 'SHIPMENT_TRUCK_CHANGED', targetId: shipment.id, details: { reason: why, vehicleId: input.vehicleId, driverId: input.driverId } });
  const full = await loadShipment(user, shipmentId);
  emitShipment(full);
  notify(full.buyerId, `Truck changed for shipment ${full.shipmentNumber}`, `Your goods are now on ${full.vehicleNumber}.`, shipmentLink('BUYER', full));
  return formatShipment(full, user, { detail: true });
}

// ---------------------------------------------------------------------------
// Pickup, loading and dispatch
// ---------------------------------------------------------------------------

async function simpleTransition(user, shipmentId, to, { title, description, data = {}, location } = {}) {
  const shipment = await loadShipment(user, shipmentId);
  await prisma.$transaction(async (tx) => {
    await claimStatus(tx, shipment, to, user, data);
    await addEvent(tx, shipment, { status: to, title, description, user, location });
  }, TX);
  const full = await loadShipment(user, shipmentId);
  emitShipment(full);
  return full;
}

export async function confirmPickupSchedule(user, shipmentId, { pickupScheduledAt, notes }) {
  const shipment = await loadShipment(user, shipmentId);
  const pickupAt = dateOrNull(pickupScheduledAt, 'Pickup date and time') || shipment.pickupScheduledAt;
  if (!pickupAt) throw fail('Choose the pickup date and time.');
  if (shipment.vehicleId && pickupAt.getTime() !== new Date(shipment.pickupScheduledAt).getTime()) {
    const { start, end } = tripWindow(pickupAt, shipment.estimatedDeliveryAt);
    await assertNoDoubleBooking(prisma, { vehicleId: shipment.vehicleId, driverId: shipment.driverId, start, end, excludeShipmentId: shipment.id });
  }
  const full = await simpleTransition(user, shipmentId, S.PICKUP_SCHEDULED, { title: 'Pickup scheduled', description: `Pickup confirmed for ${pickupAt.toISOString().slice(0, 16).replace('T', ' ')} UTC.${notes ? ` ${text(notes, 500)}` : ''}`, data: { pickupScheduledAt: pickupAt } });
  return formatShipment(full, user, { detail: true });
}

export async function startLoading(user, shipmentId) {
  const shipment = await loadShipment(user, shipmentId);
  if (!shipment.vehicle || !shipment.driver) throw fail('Assign a truck and driver before loading.', 409);
  const { end } = tripWindow(shipment.pickupScheduledAt, shipment.estimatedDeliveryAt);
  const problems = [...vehicleProblems(shipment.vehicle, end), ...driverProblems(shipment.driver, end)];
  if (problems.length) throw fail(`Loading cannot start: ${problems.join(' ')}`, 409, { problems });
  const full = await simpleTransition(user, shipmentId, S.LOADING_IN_PROGRESS, { title: 'Loading started', description: `Loading onto ${shipment.vehicleNumber}.`, data: { loadingStartedAt: new Date() } });
  return formatShipment(full, user, { detail: true });
}

/**
 * Records what was actually loaded. Loading fewer units than planned frees the difference so it can go on another
 * shipment; loading more than planned is refused.
 */
export async function confirmLoading(user, shipmentId, input) {
  const shipment = await loadShipment(user, shipmentId);
  if (shipment.status !== S.LOADING_IN_PROGRESS) throw fail('Start loading before confirming it.', 409);
  const loaded = new Map((Array.isArray(input.items) ? input.items : []).map((i) => [i.shipmentItemId, i.loadedQuantity]));
  const lines = shipment.items.map((item) => {
    const raw = loaded.has(item.id) ? loaded.get(item.id) : item.quantity;
    const loadedQuantity = wholeNumber(raw, `Loaded quantity for ${item.productName}`, { min: 0, max: item.quantity });
    return { item, loadedQuantity };
  });
  if (lines.every((l) => l.loadedQuantity === 0)) throw fail('Nothing was loaded. Cancel the shipment instead.');
  const totalPackages = wholeNumber(input.totalPackages, 'Number of packages', { min: 1, max: 100000 });
  const totalWeightKg = Number(input.totalWeightKg);
  if (!Number.isFinite(totalWeightKg) || totalWeightKg <= 0) throw fail('Enter the loaded cargo weight in kg.');
  const capacityKg = Number(shipment.vehicle.capacityTons) * 1000;
  if (totalWeightKg > capacityKg) throw fail(`Loaded weight (${totalWeightKg.toLocaleString('en-IN')} kg) is more than the truck's permitted load (${capacityKg.toLocaleString('en-IN')} kg).`, 409);
  const documents = (Array.isArray(input.documents) ? input.documents : []).filter((d) => d?.fileUrl).slice(0, 10);

  await prisma.$transaction(async (tx) => {
    await claimStatus(tx, shipment, S.LOADED, user, {
      loadedAt: new Date(),
      totalPackages,
      totalWeightKg,
      lrNumber: text(input.lrNumber, 60) || shipment.lrNumber,
      ewayBillNumber: text(input.ewayBillNumber, 30) || shipment.ewayBillNumber,
    });
    for (const { item, loadedQuantity } of lines) {
      await tx.shipmentItem.update({ where: { id: item.id }, data: { loadedQuantity } });
      const shortfall = item.quantity - loadedQuantity;
      if (shortfall > 0) await tx.$executeRaw`UPDATE order_items SET allocatedQuantity = GREATEST(0, allocatedQuantity - ${shortfall}) WHERE id = ${item.orderItemId}`;
    }
    for (const doc of documents) {
      await tx.shipmentDocument.create({
        data: {
          shipmentId: shipment.id,
          docType: DOC_TYPES.includes(doc.docType) ? doc.docType : 'PICKUP_PROOF',
          docNumber: text(doc.docNumber, 60),
          title: text(doc.title, 120) || 'Loading proof',
          fileUrl: String(doc.fileUrl).slice(0, 2000),
          fileName: text(doc.fileName, 200) || 'document',
          uploadedByUserId: user.id,
          uploadedByRole: user.role,
        },
      });
    }
    const short = lines.filter((l) => l.loadedQuantity < l.item.quantity);
    await addEvent(tx, shipment, {
      status: S.LOADED,
      title: 'Goods loaded',
      description: `${lines.map((l) => `${l.loadedQuantity} ${l.item.unit} ${l.item.productName}`).join(', ')}; ${totalPackages} package(s), ${totalWeightKg.toLocaleString('en-IN')} kg.${short.length ? ' Units not loaded are free for another shipment.' : ''}`,
      user,
      documents: documents.map((d) => ({ title: d.title || 'Loading proof', url: d.fileUrl })),
    });
  }, TX);
  const full = await loadShipment(user, shipmentId);
  emitShipment(full);
  return formatShipment(full, user, { detail: true });
}

/**
 * Goods leave the warehouse: pickup is acknowledged and the shipment goes in transit. Stock for the loaded units
 * comes off on-hand inventory once, and the order moves to SHIPPED.
 */
export async function dispatchShipment(user, shipmentId, input = {}) {
  const shipment = await loadShipment(user, shipmentId);
  if (shipment.status !== S.LOADED) throw fail('Confirm loading before dispatch.', 409);
  if (!shipment.vehicle || !shipment.driver) throw fail('A shipment cannot be dispatched without a valid truck and driver.', 409);
  const { end } = tripWindow(new Date(), shipment.estimatedDeliveryAt);
  const problems = [...vehicleProblems(shipment.vehicle, end), ...driverProblems(shipment.driver, end)];
  if (problems.length) throw fail(`Dispatch blocked: ${problems.join(' ')}`, 409, { problems });
  assertTransition(S.LOADED, S.PICKED_UP, user.role);
  const estimatedDeliveryAt = dateOrNull(input.estimatedDeliveryAt, 'Estimated delivery') || shipment.estimatedDeliveryAt;
  const location = text(input.location, 200) || [shipment.pickupAddress?.city, shipment.pickupAddress?.state].filter(Boolean).join(', ');

  const itemsToShip = shipment.items
    .map((item) => ({ orderItemId: item.orderItemId, productId: item.productId, productName: item.productName, quantity: item.loadedQuantity ?? item.quantity }))
    .filter((item) => item.quantity > 0);

  let stock = { touched: [] };
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await claimStatus(tx, shipment, S.PICKED_UP, user, { pickedUpAt: now });
    await addEvent(tx, { ...shipment, status: S.PICKED_UP }, { status: S.PICKED_UP, title: 'Picked up', description: `Pickup acknowledged for ${shipment.vehicleNumber}, driver ${shipment.driverName}.`, user, location });
    const claimed = await tx.shipment.updateMany({ where: { id: shipment.id, status: S.PICKED_UP }, data: { status: S.IN_TRANSIT, dispatchedAt: now, estimatedDeliveryAt, lastReportedLocation: location || null, lastReportedAt: now } });
    if (claimed.count === 0) throw fail('This shipment was just updated by someone else.', 409);
    await addEvent(tx, { ...shipment, status: S.IN_TRANSIT }, { status: S.IN_TRANSIT, title: 'Dispatched — in transit', description: estimatedDeliveryAt ? `Expected delivery ${new Date(estimatedDeliveryAt).toISOString().slice(0, 10)}.` : null, user, location });
    stock = await shipShipmentItems(tx, { orderId: shipment.orderId, orderNumber: shipment.order?.orderNumber, items: itemsToShip, actor: actorOf(user), shipmentNumber: shipment.shipmentNumber });
    await tx.transportVehicle.update({ where: { id: shipment.vehicleId }, data: { status: 'IN_TRANSIT' } });
    await tx.transportDriver.update({ where: { id: shipment.driverId }, data: { status: 'ON_DUTY' } });
    await syncOrderStatus(tx, shipment.orderId, user.name || 'Supplier');
  }, TX);

  publishInventoryChanges(stock.touched);
  const full = await loadShipment(user, shipmentId);
  emitShipment(full);
  notify(full.buyerId, `Shipment dispatched: ${full.shipmentNumber}`, `Order #${full.order?.orderNumber} is on its way on ${full.vehicleNumber}.`, shipmentLink('BUYER', full));
  if (isStaff(user)) notify(full.supplierId, `Shipment dispatched: ${full.shipmentNumber}`, 'TradeExpress recorded the dispatch of your shipment.', shipmentLink('SUPPLIER', full));
  return formatShipment(full, user, { detail: true });
}

// ---------------------------------------------------------------------------
// Tracking
// ---------------------------------------------------------------------------

const TRACKABLE_STATUSES = [S.PICKED_UP, S.IN_TRANSIT, S.OUT_FOR_DELIVERY, S.DELIVERED_PENDING_CONFIRMATION, S.DELIVERY_FAILED, S.RETURN_IN_TRANSIT];

/** A manually reported location / progress note. It never claims to be GPS. */
export async function addTrackingUpdate(user, shipmentId, input) {
  const shipment = await loadShipment(user, shipmentId);
  if (!TRACKABLE_STATUSES.includes(shipment.status)) throw fail('Location updates can be recorded once the shipment is dispatched and until it is delivered.', 409);
  const location = text(input.location, 200);
  if (!location) throw fail('Enter the reported location (for example "Vadodara toll plaza, NH48").');
  const eventAt = dateOrNull(input.eventAt, 'Reported time') || new Date();
  if (eventAt > new Date(Date.now() + 5 * 60 * 1000)) throw fail('Reported time cannot be in the future.');
  if (shipment.dispatchedAt && eventAt < new Date(shipment.dispatchedAt)) throw fail('Reported time cannot be before dispatch.');
  const estimatedDeliveryAt = dateOrNull(input.estimatedDeliveryAt, 'Estimated delivery');
  const delayReason = text(input.delayReason, 1000);

  await prisma.$transaction(async (tx) => {
    const update = { lastReportedLocation: location, lastReportedAt: eventAt, ...(estimatedDeliveryAt ? { estimatedDeliveryAt } : {}) };
    const claimed = await tx.shipment.updateMany({ where: { id: shipment.id, status: shipment.status }, data: update });
    if (claimed.count === 0) throw fail('This shipment was just updated by someone else.', 409);
    await addEvent(tx, shipment, {
      eventType: 'LOCATION_UPDATE',
      title: delayReason ? 'Delay reported' : 'Location update',
      description: [text(input.remarks, 1000), delayReason ? `Delay: ${delayReason}` : null, estimatedDeliveryAt ? `New expected delivery ${estimatedDeliveryAt.toISOString().slice(0, 10)}.` : null].filter(Boolean).join(' ') || null,
      location,
      eventAt,
      user,
    });
    if (delayReason) {
      await tx.shipmentIssue.create({ data: { shipmentId: shipment.id, issueType: 'DELAY', description: delayReason, reportedById: user.id, reportedByRole: user.role } });
    }
  }, TX);
  const full = await loadShipment(user, shipmentId);
  emitShipment(full);
  if (delayReason) {
    notify(full.buyerId, `Delay on shipment ${full.shipmentNumber}`, delayReason, shipmentLink('BUYER', full));
    if (!isStaff(user)) notifyAdmins(`Delay reported: ${full.shipmentNumber}`, delayReason, shipmentLink('ADMIN', full));
  }
  return formatShipment(full, user, { detail: true });
}

export async function markOutForDelivery(user, shipmentId, { location } = {}) {
  const full = await simpleTransition(user, shipmentId, S.OUT_FOR_DELIVERY, { title: 'Out for delivery', location: text(location, 200) });
  notify(full.buyerId, `Out for delivery: ${full.shipmentNumber}`, `Order #${full.order?.orderNumber} will reach you soon. Driver ${full.driverName}, ${full.driverPhone}.`, shipmentLink('BUYER', full));
  return formatShipment(full, user, { detail: true });
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

async function issueDeliveryCode(shipmentId) {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId }, include: { order: { select: { orderNumber: true, buyerEmail: true, buyerName: true } }, buyer: { select: { email: true, name: true } } } });
  const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await prisma.shipment.update({
    where: { id: shipmentId },
    data: { deliveryOtpHash: hashOtp(shipmentId, otp), deliveryOtpExpiresAt: new Date(Date.now() + OTP_MINUTES * 60 * 1000), deliveryOtpAttempts: 0, deliveryOtpSentCount: { increment: 1 }, deliveryOtpSentAt: new Date() },
  });
  const email = shipment.buyer?.email || shipment.order?.buyerEmail;
  const sent = email ? await sendDeliveryCodeEmail({ email, name: shipment.buyer?.name || shipment.order?.buyerName, otp, shipmentNumber: shipment.shipmentNumber, orderNumber: shipment.order?.orderNumber, expiresInMinutes: OTP_MINUTES }) : { success: false };
  return { emailed: Boolean(sent.success) };
}

/** Delivery attempt at the buyer's address. The buyer receives a single-use code to confirm what arrived. */
export async function markArrived(user, shipmentId, { location, notes } = {}) {
  const shipment = await loadShipment(user, shipmentId);
  await prisma.$transaction(async (tx) => {
    await claimStatus(tx, shipment, S.DELIVERED_PENDING_CONFIRMATION, user, { arrivedAt: new Date(), deliveryOtpSentCount: 0 });
    await addEvent(tx, shipment, { status: S.DELIVERED_PENDING_CONFIRMATION, title: 'Arrived at delivery address', description: `Waiting for the buyer to check the goods and confirm with their delivery code.${notes ? ` ${text(notes, 500)}` : ''}`, location: text(location, 200) || [shipment.deliveryAddress?.city, shipment.deliveryAddress?.state].filter(Boolean).join(', '), user });
  }, TX);
  const { emailed } = await issueDeliveryCode(shipment.id);
  const full = await loadShipment(user, shipmentId);
  emitShipment(full);
  notify(full.buyerId, `Delivery arrived: ${full.shipmentNumber}`, `Check the goods, then confirm the received quantity in Track Delivery with the code ${emailed ? 'we emailed you' : 'from your email'}.`, shipmentLink('BUYER', full));
  return { ...formatShipment(full, user, { detail: true }), deliveryCodeEmailed: emailed };
}

/** Buyer asks for a new delivery code (rate-limited). */
export async function resendDeliveryCode(user, shipmentId) {
  const shipment = await loadShipment(user, shipmentId);
  if (shipment.status !== S.DELIVERED_PENDING_CONFIRMATION) throw fail('A delivery code is only available once the shipment has arrived.', 409);
  if (shipment.deliveryOtpSentCount >= OTP_MAX_SENDS) throw fail('The maximum number of delivery codes has been sent. Contact TradeExpress support.', 429);
  const wait = shipment.deliveryOtpSentAt ? OTP_RESEND_SECONDS - Math.floor((Date.now() - new Date(shipment.deliveryOtpSentAt).getTime()) / 1000) : 0;
  if (wait > 0) throw fail(`Please wait ${wait} seconds before requesting another code.`, 429, { errorCode: 'OTP_COOLDOWN', cooldownRemaining: wait });
  const { emailed } = await issueDeliveryCode(shipment.id);
  if (!emailed) throw fail('The delivery code could not be emailed right now. Please try again shortly.', 502);
  return { success: true, expiresInMinutes: OTP_MINUTES };
}

/**
 * Buyer confirms receipt with the delivery code: received and damaged quantities per product, condition and receiver
 * name. Shortages and damage are recorded as issues. The shipment is completed exactly once.
 */
export async function confirmDelivery(user, shipmentId, input) {
  if (user.role !== 'BUYER') throw fail('Only the buyer can confirm delivery with the delivery code.', 403);
  const shipment = await loadShipment(user, shipmentId);
  if (shipment.status === S.DELIVERED) throw fail('This shipment is already confirmed as delivered.', 409);
  if (shipment.status !== S.DELIVERED_PENDING_CONFIRMATION) throw fail('Delivery can be confirmed once the shipment has arrived at your address.', 409);

  // Delivery code: single use, expiring, limited attempts
  if (!shipment.deliveryOtpHash || !shipment.deliveryOtpExpiresAt) throw fail('No delivery code is active. Request a new code.', 400, { errorCode: 'OTP_MISSING' });
  if (new Date(shipment.deliveryOtpExpiresAt) < new Date()) throw fail('The delivery code has expired. Request a new code.', 400, { errorCode: 'OTP_EXPIRED' });
  if (shipment.deliveryOtpAttempts >= OTP_MAX_ATTEMPTS) throw fail('Too many incorrect codes. Request a new code.', 429, { errorCode: 'OTP_LOCKED' });
  const codeOk = otpMatches(shipment, input.otp) || isDevOtpAllowed(input.otp);
  if (!codeOk) {
    const updated = await prisma.shipment.update({ where: { id: shipment.id }, data: { deliveryOtpAttempts: { increment: 1 } }, select: { deliveryOtpAttempts: true } });
    const left = Math.max(0, OTP_MAX_ATTEMPTS - updated.deliveryOtpAttempts);
    throw fail(left ? `Incorrect delivery code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many incorrect codes. Request a new code.', left ? 400 : 429, { errorCode: left ? 'OTP_INVALID' : 'OTP_LOCKED' });
  }

  const receiverName = text(input.receiverName, 100);
  if (!receiverName || receiverName.length < 2) throw fail('Enter the name of the person who received the goods.');
  const condition = input.condition || 'GOOD';
  if (!['GOOD', 'DAMAGED', 'PARTIAL'].includes(condition)) throw fail('Condition must be good, damaged or partial.');
  const reported = new Map((Array.isArray(input.items) ? input.items : []).map((i) => [i.shipmentItemId, i]));
  const lines = shipment.items.map((item) => {
    const shipped = item.loadedQuantity ?? item.quantity;
    const row = reported.get(item.id) || {};
    const received = row.receivedQuantity === undefined ? shipped : wholeNumber(row.receivedQuantity, `Received quantity for ${item.productName}`, { min: 0, max: shipped });
    const damaged = row.damagedQuantity === undefined || row.damagedQuantity === '' ? 0 : wholeNumber(row.damagedQuantity, `Damaged quantity for ${item.productName}`, { min: 0, max: shipped });
    if (received + damaged > shipped) throw fail(`${item.productName}: received plus damaged (${received + damaged}) is more than was shipped (${shipped}).`);
    return { item, shipped, received, damaged, missing: shipped - received - damaged };
  });
  const photoUrls = (Array.isArray(input.photoUrls) ? input.photoUrls : []).filter((u) => typeof u === 'string' && u.trim()).slice(0, 10);
  const hasProblem = lines.some((l) => l.damaged > 0 || l.missing > 0);
  const finalCondition = hasProblem && condition === 'GOOD' ? (lines.some((l) => l.damaged > 0) ? 'DAMAGED' : 'PARTIAL') : condition;

  let orderChange = null;
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    // Clearing the code and moving status in one conditional update makes the code single-use
    const claimed = await tx.shipment.updateMany({
      where: { id: shipment.id, status: S.DELIVERED_PENDING_CONFIRMATION, deliveryOtpHash: shipment.deliveryOtpHash },
      data: { status: S.DELIVERED, deliveredAt: now, deliveryOtpHash: null, deliveryOtpExpiresAt: null },
    });
    if (claimed.count === 0) throw fail('This delivery was just confirmed.', 409);
    await tx.deliveryProof.create({
      data: { shipmentId: shipment.id, recipientName: receiverName, recipientPhone: text(input.receiverPhone, 20), otpVerified: true, condition: finalCondition, receiverNotes: text(input.notes, 2000), photoProofUrls: photoUrls.length ? photoUrls : undefined, receivedAt: now },
    });
    for (const line of lines) {
      await tx.shipmentItem.update({ where: { id: line.item.id }, data: { deliveredQuantity: line.received, damagedQuantity: line.damaged, missingQuantity: line.missing } });
      await tx.$executeRaw`UPDATE order_items SET deliveredQuantity = LEAST(quantity, deliveredQuantity + ${line.received + line.damaged}) WHERE id = ${line.item.orderItemId}`;
      if (line.damaged > 0) await tx.shipmentIssue.create({ data: { shipmentId: shipment.id, issueType: 'DAMAGED', quantity: line.damaged, description: `${line.damaged} ${line.item.unit} of ${line.item.productName} received damaged.${input.notes ? ` ${text(input.notes, 500)}` : ''}`, photoUrls: photoUrls.length ? photoUrls : undefined, reportedById: user.id, reportedByRole: 'BUYER' } });
      if (line.missing > 0) await tx.shipmentIssue.create({ data: { shipmentId: shipment.id, issueType: 'SHORTAGE', quantity: line.missing, description: `${line.missing} ${line.item.unit} of ${line.item.productName} not received.`, reportedById: user.id, reportedByRole: 'BUYER' } });
    }
    await addEvent(tx, shipment, {
      status: S.DELIVERED,
      title: hasProblem ? 'Delivered with issues reported' : 'Delivered and confirmed by buyer',
      description: `Received by ${receiverName}: ${lines.map((l) => `${l.received} ${l.item.unit} ${l.item.productName}${l.damaged ? `, ${l.damaged} damaged` : ''}${l.missing ? `, ${l.missing} missing` : ''}`).join('; ')}. Confirmed with delivery code.`,
      user,
      location: [shipment.deliveryAddress?.city, shipment.deliveryAddress?.state].filter(Boolean).join(', '),
    });
    await freeFleetIfIdle(tx, shipment.vehicleId, shipment.driverId, shipment.id);
    orderChange = await syncOrderStatus(tx, shipment.orderId, 'Buyer');
  }, TX);

  const full = await loadShipment(user, shipmentId);
  emitShipment(full);
  notify(full.supplierId, hasProblem ? `Delivered with issues: ${full.shipmentNumber}` : `Delivered: ${full.shipmentNumber}`, hasProblem ? 'The buyer reported damaged or missing goods. TradeExpress will review.' : `The buyer confirmed receipt of shipment ${full.shipmentNumber}.`, shipmentLink('SUPPLIER', full));
  if (hasProblem) notifyAdmins(`Delivery issue: ${full.shipmentNumber}`, 'Damaged or missing goods were reported at delivery.', shipmentLink('ADMIN', full));
  return { ...formatShipment(full, user, { detail: true }), orderStatus: orderChange?.status || full.order?.orderStatus };
}

/** The delivery attempt did not succeed (buyer unavailable, refused, address problem...). */
export async function markDeliveryFailed(user, shipmentId, { reason, location }) {
  const why = text(reason, 1000);
  if (!why) throw fail('Give the reason the delivery failed.');
  const shipment = await loadShipment(user, shipmentId);
  await prisma.$transaction(async (tx) => {
    await claimStatus(tx, shipment, S.DELIVERY_FAILED, user, { deliveryFailedReason: why, deliveryOtpHash: null, deliveryOtpExpiresAt: null });
    await tx.shipmentIssue.create({ data: { shipmentId: shipment.id, issueType: 'DELIVERY_FAILED', description: why, reportedById: user.id, reportedByRole: user.role } });
    await addEvent(tx, shipment, { status: S.DELIVERY_FAILED, title: 'Delivery attempt failed', description: why, location: text(location, 200), user });
  }, TX);
  const full = await loadShipment(user, shipmentId);
  emitShipment(full);
  notify(full.buyerId, `Delivery attempt failed: ${full.shipmentNumber}`, why, shipmentLink('BUYER', full));
  if (!isStaff(user)) notifyAdmins(`Delivery failed: ${full.shipmentNumber}`, why, shipmentLink('ADMIN', full));
  return formatShipment(full, user, { detail: true });
}

export async function startReturn(user, shipmentId, { reason }) {
  const why = text(reason, 1000);
  if (!why) throw fail('Give the reason the goods are being returned.');
  const full = await simpleTransition(user, shipmentId, S.RETURN_IN_TRANSIT, { title: 'Returning to supplier', description: why });
  notify(full.buyerId, `Shipment returning: ${full.shipmentNumber}`, why, shipmentLink('BUYER', full));
  return formatShipment(full, user, { detail: true });
}

/** Returned goods physically received back: units go back on hand (and into the order's hold for re-shipping). */
export async function markReturned(user, shipmentId, { notes } = {}) {
  const shipment = await loadShipment(user, shipmentId);
  const items = shipment.items
    .map((item) => ({ orderItemId: item.orderItemId, productId: item.productId, quantity: (item.loadedQuantity ?? item.quantity) - item.deliveredQuantity - item.damagedQuantity }))
    .filter((item) => item.quantity > 0);
  let stock = { touched: [] };
  await prisma.$transaction(async (tx) => {
    await claimStatus(tx, shipment, S.RETURNED, user);
    stock = await restockReturnedShipment(tx, { orderId: shipment.orderId, orderNumber: shipment.order?.orderNumber, items, actor: actorOf(user), shipmentNumber: shipment.shipmentNumber });
    await freeFleetIfIdle(tx, shipment.vehicleId, shipment.driverId, shipment.id);
    await addEvent(tx, shipment, { status: S.RETURNED, title: 'Returned goods received', description: `Received back at the warehouse and restocked.${notes ? ` ${text(notes, 500)}` : ''}`, user });
  }, TX);
  publishInventoryChanges(stock.touched);
  const full = await loadShipment(user, shipmentId);
  emitShipment(full);
  return formatShipment(full, user, { detail: true });
}

/** Cancel before dispatch: the units are freed for another shipment and the truck is released. */
export async function cancelShipment(user, shipmentId, { reason }, req) {
  const why = text(reason, 1000);
  if (!why) throw fail('Give a reason for cancelling the shipment.');
  const shipment = await loadShipment(user, shipmentId);
  if (![...PRE_LOADING_STATUSES, S.LOADING_IN_PROGRESS, S.LOADED].includes(shipment.status)) throw fail('A shipment that has left the warehouse cannot be cancelled. Record a failed delivery or a return instead.', 409);
  await prisma.$transaction(async (tx) => {
    await claimStatus(tx, shipment, S.CANCELLED, user, { cancelledAt: new Date() });
    for (const item of shipment.items) {
      const held = item.loadedQuantity ?? item.quantity;
      await tx.$executeRaw`UPDATE order_items SET allocatedQuantity = GREATEST(0, allocatedQuantity - ${held}) WHERE id = ${item.orderItemId}`;
    }
    if (shipment.requestId) await tx.transportRequest.updateMany({ where: { id: shipment.requestId, status: 'PENDING' }, data: { status: 'CANCELLED', reviewedAt: new Date() } });
    await freeFleetIfIdle(tx, shipment.vehicleId, shipment.driverId, shipment.id);
    await addEvent(tx, shipment, { status: S.CANCELLED, title: 'Shipment cancelled', description: why, user });
  }, TX);
  if (isStaff(user)) await auditTransport({ req, action: 'SHIPMENT_CANCELLED', targetId: shipment.id, details: { reason: why } });
  const full = await loadShipment(user, shipmentId);
  emitShipment(full);
  return formatShipment(full, user, { detail: true });
}

// ---------------------------------------------------------------------------
// Documents and issues
// ---------------------------------------------------------------------------

export async function addDocument(user, shipmentId, input) {
  const shipment = await loadShipment(user, shipmentId);
  if (user.role === 'BUYER') throw fail('Buyers cannot upload shipping documents. Attach photos when reporting an issue.', 403);
  if (!input.fileUrl || !/^(https?:\/\/|\/uploads\/)/.test(String(input.fileUrl))) throw fail('Upload the document first.');
  const docType = DOC_TYPES.includes(input.docType) ? input.docType : 'OTHER';
  await prisma.$transaction(async (tx) => {
    await tx.shipmentDocument.create({
      data: { shipmentId: shipment.id, docType, docNumber: text(input.docNumber, 60), title: text(input.title, 120) || docType.replace(/_/g, ' '), fileUrl: String(input.fileUrl).slice(0, 2000), fileName: text(input.fileName, 200) || 'document', uploadedByUserId: user.id, uploadedByRole: user.role },
    });
    if (docType === 'EWAY_BILL' && input.docNumber) await tx.shipment.update({ where: { id: shipment.id }, data: { ewayBillNumber: text(input.docNumber, 30) } });
    if (docType === 'LR_BILTY' && input.docNumber) await tx.shipment.update({ where: { id: shipment.id }, data: { lrNumber: text(input.docNumber, 60) } });
    await addEvent(tx, shipment, { eventType: 'DOCUMENT', title: 'Document added', description: `${docType.replace(/_/g, ' ')}${input.docNumber ? ` ${text(input.docNumber, 60)}` : ''}`, user, documents: [{ title: text(input.title, 120) || docType, url: input.fileUrl }] });
  }, TX);
  return getShipment(user, shipmentId);
}

export async function reportIssue(user, shipmentId, input) {
  const shipment = await loadShipment(user, shipmentId);
  const issueType = input.issueType;
  if (!ISSUE_TYPES.includes(issueType)) throw fail('Choose the type of issue.');
  if (user.role === 'BUYER' && !DISPATCHED_STATUSES.includes(shipment.status)) throw fail('Issues can be reported once the shipment is on its way.', 409);
  const description = text(input.description, 2000);
  if (!description || description.length < 10) throw fail('Describe the issue in at least 10 characters.');
  const quantity = input.quantity === undefined || input.quantity === '' ? null : wholeNumber(input.quantity, 'Quantity', { min: 1, max: 1e7 });
  const photoUrls = (Array.isArray(input.photoUrls) ? input.photoUrls : []).filter((u) => typeof u === 'string' && u.trim()).slice(0, 10);
  await prisma.$transaction(async (tx) => {
    await tx.shipmentIssue.create({ data: { shipmentId: shipment.id, issueType, description, quantity, photoUrls: photoUrls.length ? photoUrls : undefined, reportedById: user.id, reportedByRole: user.role } });
    await addEvent(tx, shipment, { eventType: 'ISSUE', title: `${issueType.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())} reported`, description, user });
  }, TX);
  notifyAdmins(`Shipment issue: ${shipment.shipmentNumber}`, description, shipmentLink('ADMIN', shipment));
  if (user.role === 'BUYER') notify(shipment.supplierId, `Issue reported on ${shipment.shipmentNumber}`, description, shipmentLink('SUPPLIER', shipment));
  return getShipment(user, shipmentId);
}

export async function listIssues(user, { status } = {}) {
  const issues = await prisma.shipmentIssue.findMany({
    where: { shipment: accessWhere(user), ...(status ? { status: { in: String(status).split(',') } } : {}) },
    include: { shipment: { select: { id: true, shipmentNumber: true, status: true, supplier: { select: { name: true, company: true } }, order: { select: { orderNumber: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return issues.map((i) => ({
    id: i.id, issueType: i.issueType, description: i.description, quantity: i.quantity, photoUrls: i.photoUrls || [], status: i.status, resolution: i.resolution,
    reportedByRole: i.reportedByRole, createdAt: i.createdAt, resolvedAt: i.resolvedAt,
    shipment: { id: i.shipment.id, shipmentNumber: i.shipment.shipmentNumber, status: i.shipment.status, supplier: i.shipment.supplier?.company || i.shipment.supplier?.name, orderNumber: i.shipment.order?.orderNumber },
  }));
}

export async function resolveIssue(adminUser, issueId, { status, resolution }, req) {
  if (!['IN_REVIEW', 'RESOLVED', 'REJECTED'].includes(status)) throw fail('Status must be in review, resolved or rejected.');
  const note = text(resolution, 2000);
  if (status !== 'IN_REVIEW' && !note) throw fail('Record how the issue was resolved.');
  const issue = await prisma.shipmentIssue.findUnique({ where: { id: issueId }, include: { shipment: true } });
  if (!issue) throw fail('Issue not found.', 404);
  if (['RESOLVED', 'REJECTED'].includes(issue.status)) throw fail('This issue is already closed.', 409);
  await prisma.$transaction(async (tx) => {
    await tx.shipmentIssue.update({ where: { id: issueId }, data: { status, resolution: note, ...(status !== 'IN_REVIEW' ? { resolvedById: adminUser.id, resolvedAt: new Date() } : {}) } });
    await addEvent(tx, issue.shipment, { eventType: 'ISSUE', title: `Issue ${status === 'IN_REVIEW' ? 'under review' : status.toLowerCase()}`, description: note, user: adminUser });
  }, TX);
  await auditTransport({ req, action: 'SHIPMENT_ISSUE_UPDATED', targetId: issueId, details: { status, resolution: note } });
  const link = shipmentLink('BUYER', { ...issue.shipment, order: null });
  if (status !== 'IN_REVIEW') {
    notify(issue.shipment.buyerId, `Shipment issue ${status.toLowerCase()}: ${issue.shipment.shipmentNumber}`, note, link);
    notify(issue.shipment.supplierId, `Shipment issue ${status.toLowerCase()}: ${issue.shipment.shipmentNumber}`, note, shipmentLink('SUPPLIER', issue.shipment));
  }
  return { success: true };
}

/** Admin records the freight payment for a shipment. */
export async function updateFreightPayment(adminUser, shipmentId, { freightPaymentStatus, freightCharges }, req) {
  if (!['PENDING', 'PAID', 'NOT_APPLICABLE'].includes(freightPaymentStatus)) throw fail('Payment status must be pending, paid or not applicable.');
  const shipment = await loadShipment(adminUser, shipmentId);
  const data = { freightPaymentStatus };
  if (freightCharges !== undefined && freightCharges !== '') {
    const amount = Number(freightCharges);
    if (!Number.isFinite(amount) || amount < 0) throw fail('Freight charges must be a positive amount.');
    data.freightCharges = amount;
  }
  await prisma.shipment.update({ where: { id: shipment.id }, data });
  await auditTransport({ req, action: 'FREIGHT_PAYMENT_UPDATED', targetId: shipment.id, details: data });
  return getShipment(adminUser, shipmentId);
}

// ---------------------------------------------------------------------------
// Reports (Super Admin)
// ---------------------------------------------------------------------------

export async function getReports({ from, to } = {}) {
  const range = {};
  if (from) range.gte = dateOrNull(from, 'From');
  if (to) range.lte = dateOrNull(to, 'To');
  const where = Object.keys(range).length ? { createdAt: range } : {};
  const [byStatus, byMethod, delivered, freight, freightByStatus, issues, bySupplier] = await Promise.all([
    prisma.shipment.groupBy({ by: ['status'], where, _count: true }),
    prisma.shipment.groupBy({ by: ['transportMethod'], where, _count: true }),
    prisma.shipment.findMany({ where: { ...where, status: S.DELIVERED }, select: { deliveredAt: true, estimatedDeliveryAt: true, dispatchedAt: true } }),
    prisma.shipment.groupBy({ by: ['freightPayer'], where: { ...where, status: { not: S.CANCELLED } }, _sum: { freightCharges: true }, _count: true }),
    prisma.shipment.groupBy({ by: ['freightPaymentStatus'], where: { ...where, status: { not: S.CANCELLED } }, _sum: { freightCharges: true } }),
    prisma.shipmentIssue.groupBy({ by: ['issueType', 'status'], where: Object.keys(range).length ? { createdAt: range } : {}, _count: true }),
    prisma.shipment.groupBy({ by: ['supplierId'], where, _count: true, orderBy: { _count: { supplierId: 'desc' } }, take: 10 }),
  ]);
  const onTime = delivered.filter((d) => d.estimatedDeliveryAt && d.deliveredAt && new Date(d.deliveredAt) <= new Date(d.estimatedDeliveryAt)).length;
  const withEta = delivered.filter((d) => d.estimatedDeliveryAt).length;
  const transitHours = delivered.filter((d) => d.dispatchedAt && d.deliveredAt).map((d) => (new Date(d.deliveredAt) - new Date(d.dispatchedAt)) / 3600000);
  const suppliers = await prisma.user.findMany({ where: { id: { in: bySupplier.map((s) => s.supplierId) } }, select: { id: true, name: true, company: true } });
  const names = new Map(suppliers.map((s) => [s.id, s.company || s.name]));
  return {
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count])),
    byTransportMethod: Object.fromEntries(byMethod.map((r) => [r.transportMethod, r._count])),
    delivered: delivered.length,
    onTimeRate: withEta ? Math.round((onTime / withEta) * 100) : null,
    averageTransitHours: transitHours.length ? Math.round(transitHours.reduce((a, b) => a + b, 0) / transitHours.length) : null,
    freightByPayer: freight.map((r) => ({ payer: r.freightPayer, shipments: r._count, amount: Number(r._sum.freightCharges || 0) })),
    freightByPaymentStatus: freightByStatus.map((r) => ({ status: r.freightPaymentStatus, amount: Number(r._sum.freightCharges || 0) })),
    issues: issues.map((r) => ({ issueType: r.issueType, status: r.status, count: r._count })),
    topSuppliers: bySupplier.map((r) => ({ supplierId: r.supplierId, supplier: names.get(r.supplierId) || 'Unknown', shipments: r._count })),
  };
}

/** Transport audit trail: admin actions plus every recorded shipment event. */
export async function getAuditTrail({ limit = 100 } = {}) {
  const take = Math.min(300, Math.max(1, parseInt(limit, 10) || 100));
  const [actions, events] = await Promise.all([
    prisma.auditLog.findMany({ where: { resource: 'TRANSPORT' }, orderBy: { createdAt: 'desc' }, take }),
    prisma.shipmentEvent.findMany({ orderBy: { recordedAt: 'desc' }, take, include: { shipment: { select: { shipmentNumber: true } } } }),
  ]);
  return {
    adminActions: actions,
    shipmentEvents: events.map((e) => ({ id: e.id, shipmentNumber: e.shipment?.shipmentNumber, status: e.status, eventType: e.eventType, title: e.title, description: e.description, location: e.location, eventAt: e.timestamp, recordedAt: e.recordedAt, source: e.source, actorName: e.actorName, actorRole: e.actorRole })),
  };
}

/**
 * Shipments of an order for the order-tracking page. `publicView` (email lookup, not signed in) hides contact
 * numbers, documents and proof photos.
 */
export async function getShipmentsForOrderTracking(orderId, { publicView = false } = {}) {
  const shipments = await prisma.shipment.findMany({ where: { orderId }, include: shipmentInclude, orderBy: { createdAt: 'asc' } });
  return shipments.map((row) => {
    const view = formatShipment(row, { role: 'BUYER' }, { detail: true });
    if (!publicView) return view;
    return {
      ...view,
      deliveryAddress: { city: view.deliveryAddress?.city, state: view.deliveryAddress?.state, postalCode: view.deliveryAddress?.postalCode },
      driver: view.driver ? { name: view.driver.name, phone: null } : null,
      documents: [],
      deliveryProof: view.deliveryProof ? { ...view.deliveryProof, photoProofUrls: [], receiverNotes: null } : null,
      issues: [],
      freight: null,
      nextStatuses: [],
    };
  });
}
