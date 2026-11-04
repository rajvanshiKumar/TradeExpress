/**
 * Shipment lifecycle for Transport & Delivery Management.
 *
 * Every status change goes through assertTransition(), which checks the move is allowed from the current status and
 * that the acting role may make it. Shipment services then claim the change with a conditional update on the current
 * status, so a double click or two people acting at once can only apply it once.
 */

export const SHIPMENT_STATUS = {
  AWAITING_TRANSPORT: 'AWAITING_TRANSPORT',
  TRANSPORT_REQUESTED: 'TRANSPORT_REQUESTED',
  TRANSPORT_ASSIGNED: 'TRANSPORT_ASSIGNED',
  PICKUP_SCHEDULED: 'PICKUP_SCHEDULED',
  LOADING_IN_PROGRESS: 'LOADING_IN_PROGRESS',
  LOADED: 'LOADED',
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED_PENDING_CONFIRMATION: 'DELIVERED_PENDING_CONFIRMATION',
  DELIVERED: 'DELIVERED',
  DELIVERY_FAILED: 'DELIVERY_FAILED',
  RETURN_IN_TRANSIT: 'RETURN_IN_TRANSIT',
  RETURNED: 'RETURNED',
  CANCELLED: 'CANCELLED',
};

const S = SHIPMENT_STATUS;
const SUPPLIER = 'SUPPLIER';
const ADMIN = 'ADMIN'; // ADMIN and SUPER_ADMIN
const BUYER = 'BUYER';

// from -> { to: roles allowed to make that move }
const TRANSITIONS = {
  [S.AWAITING_TRANSPORT]: {
    [S.TRANSPORT_REQUESTED]: [SUPPLIER],
    [S.TRANSPORT_ASSIGNED]: [SUPPLIER, ADMIN],
    [S.CANCELLED]: [SUPPLIER, ADMIN],
  },
  [S.TRANSPORT_REQUESTED]: {
    [S.TRANSPORT_ASSIGNED]: [ADMIN],
    [S.AWAITING_TRANSPORT]: [SUPPLIER, ADMIN], // request cancelled or rejected
    [S.CANCELLED]: [SUPPLIER, ADMIN],
  },
  [S.TRANSPORT_ASSIGNED]: {
    [S.PICKUP_SCHEDULED]: [SUPPLIER, ADMIN],
    [S.LOADING_IN_PROGRESS]: [SUPPLIER, ADMIN],
    [S.AWAITING_TRANSPORT]: [SUPPLIER, ADMIN], // truck released for reassignment
    [S.CANCELLED]: [SUPPLIER, ADMIN],
  },
  [S.PICKUP_SCHEDULED]: {
    [S.LOADING_IN_PROGRESS]: [SUPPLIER, ADMIN],
    [S.AWAITING_TRANSPORT]: [SUPPLIER, ADMIN],
    [S.CANCELLED]: [SUPPLIER, ADMIN],
  },
  [S.LOADING_IN_PROGRESS]: {
    [S.LOADED]: [SUPPLIER, ADMIN],
    [S.CANCELLED]: [SUPPLIER, ADMIN],
  },
  [S.LOADED]: {
    [S.PICKED_UP]: [SUPPLIER, ADMIN],
    [S.CANCELLED]: [SUPPLIER, ADMIN],
  },
  [S.PICKED_UP]: {
    [S.IN_TRANSIT]: [SUPPLIER, ADMIN],
  },
  [S.IN_TRANSIT]: {
    [S.OUT_FOR_DELIVERY]: [SUPPLIER, ADMIN],
    [S.DELIVERY_FAILED]: [SUPPLIER, ADMIN],
    [S.RETURN_IN_TRANSIT]: [SUPPLIER, ADMIN],
  },
  [S.OUT_FOR_DELIVERY]: {
    [S.DELIVERED_PENDING_CONFIRMATION]: [SUPPLIER, ADMIN],
    [S.DELIVERY_FAILED]: [SUPPLIER, ADMIN],
  },
  [S.DELIVERED_PENDING_CONFIRMATION]: {
    [S.DELIVERED]: [BUYER, ADMIN], // buyer with the delivery code; admin only through dispute resolution
    [S.DELIVERY_FAILED]: [SUPPLIER, ADMIN],
  },
  [S.DELIVERY_FAILED]: {
    [S.OUT_FOR_DELIVERY]: [SUPPLIER, ADMIN], // another attempt
    [S.RETURN_IN_TRANSIT]: [SUPPLIER, ADMIN],
  },
  [S.RETURN_IN_TRANSIT]: {
    [S.RETURNED]: [SUPPLIER, ADMIN],
  },
  [S.DELIVERED]: {},
  [S.RETURNED]: {},
  [S.CANCELLED]: {},
};

// Statuses in which a truck is booked for the shipment
export const VEHICLE_BUSY_STATUSES = [
  S.TRANSPORT_ASSIGNED, S.PICKUP_SCHEDULED, S.LOADING_IN_PROGRESS, S.LOADED, S.PICKED_UP, S.IN_TRANSIT,
  S.OUT_FOR_DELIVERY, S.DELIVERED_PENDING_CONFIRMATION, S.DELIVERY_FAILED, S.RETURN_IN_TRANSIT,
];
// Goods have left the warehouse
export const DISPATCHED_STATUSES = [
  S.PICKED_UP, S.IN_TRANSIT, S.OUT_FOR_DELIVERY, S.DELIVERED_PENDING_CONFIRMATION, S.DELIVERED, S.DELIVERY_FAILED,
  S.RETURN_IN_TRANSIT, S.RETURNED,
];
// Before a truck is loaded the shipment's quantities and transport can still change
export const PRE_LOADING_STATUSES = [S.AWAITING_TRANSPORT, S.TRANSPORT_REQUESTED, S.TRANSPORT_ASSIGNED, S.PICKUP_SCHEDULED];
export const TERMINAL_STATUSES = [S.DELIVERED, S.RETURNED, S.CANCELLED];
export const ACTIVE_STATUSES = Object.values(S).filter((status) => !TERMINAL_STATUSES.includes(status));

export const STATUS_LABELS = {
  AWAITING_TRANSPORT: 'Awaiting transport',
  TRANSPORT_REQUESTED: 'Transport requested',
  TRANSPORT_ASSIGNED: 'Truck assigned',
  PICKUP_SCHEDULED: 'Pickup scheduled',
  LOADING_IN_PROGRESS: 'Loading',
  LOADED: 'Loaded',
  PICKED_UP: 'Picked up',
  IN_TRANSIT: 'In transit',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED_PENDING_CONFIRMATION: 'Arrived, awaiting confirmation',
  DELIVERED: 'Delivered',
  DELIVERY_FAILED: 'Delivery failed',
  RETURN_IN_TRANSIT: 'Returning to supplier',
  RETURNED: 'Returned',
  CANCELLED: 'Cancelled',
};

export function roleGroup(role) {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return ADMIN;
  if (role === 'SUPPLIER') return SUPPLIER;
  if (role === 'BUYER') return BUYER;
  return null;
}

export function canTransition(from, to, role) {
  const allowed = TRANSITIONS[from]?.[to];
  return Boolean(allowed && allowed.includes(roleGroup(role)));
}

/** Throws a 409 (wrong state) or 403 (role may not make this move) error. */
export function assertTransition(from, to, role) {
  const allowed = TRANSITIONS[from]?.[to];
  if (!allowed) {
    const error = new Error(`A shipment that is "${STATUS_LABELS[from] || from}" cannot move to "${STATUS_LABELS[to] || to}".`);
    error.statusCode = 409;
    throw error;
  }
  if (!allowed.includes(roleGroup(role))) {
    const error = new Error(`Your account cannot move a shipment to "${STATUS_LABELS[to] || to}".`);
    error.statusCode = 403;
    throw error;
  }
}

export function nextStatuses(from, role) {
  return Object.entries(TRANSITIONS[from] || {})
    .filter(([, roles]) => roles.includes(roleGroup(role)))
    .map(([to]) => to);
}
