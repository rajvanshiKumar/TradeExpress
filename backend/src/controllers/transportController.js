import * as fleet from '../services/transport/fleetService.js';
import * as shipments from '../services/transport/shipmentService.js';
import { listTransportProviders } from '../services/transport/providers/index.js';
import { STATUS_LABELS } from '../services/transport/shipmentStateMachine.js';

/** Wraps a service call in the standard { success, data } response. */
const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    const data = await fn(req);
    res.status(status).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getMeta = handle(() => ({
  statuses: STATUS_LABELS,
  vehicleTypes: fleet.VEHICLE_TYPES,
  bodyTypes: fleet.BODY_TYPES,
  ownershipTypes: fleet.OWNERSHIP_TYPES,
  licenceClasses: fleet.LICENSE_CLASSES,
  driverStatuses: fleet.DRIVER_STATUSES,
  providers: listTransportProviders(),
}));

export const getOverview = handle((req) => shipments.getOverview(req.user));

// Providers (Super Admin)
export const listProviders = handle(() => fleet.listProviders());
export const createProvider = handle((req) => fleet.createProvider(req.user, req.body, req), 201);
export const updateProvider = handle((req) => fleet.updateProvider(req.user, req.params.id, req.body, req));

// Vehicles
export const listVehicles = handle((req) => fleet.listVehicles(req.user, req.query));
export const createVehicle = handle((req) => fleet.createVehicle(req.user, req.body, req), 201);
export const updateVehicle = handle((req) => fleet.updateVehicle(req.user, req.params.id, req.body, req));
export const setVehicleStatus = handle((req) => fleet.setVehicleStatus(req.user, req.params.id, req.body, req));
export const verifyVehicle = handle((req) => fleet.verifyVehicle(req.user, req.params.id, req.body, req));
export const getVehicleHistory = handle((req) => fleet.getVehicleHistory(req.user, req.params.id));

// Drivers
export const listDrivers = handle((req) => fleet.listDrivers(req.user, req.query));
export const createDriver = handle((req) => fleet.createDriver(req.user, req.body, req), 201);
export const updateDriver = handle((req) => fleet.updateDriver(req.user, req.params.id, req.body, req));
export const verifyDriver = handle((req) => fleet.verifyDriver(req.user, req.params.id, req.body, req));

// Orders
export const listShippableOrders = handle((req) => shipments.listShippableOrders(req.user, req.query));
export const getOrderShipments = handle((req) => shipments.getOrderShipments(req.user, req.params.orderId));

// Shipments
export const listShipments = handle((req) => shipments.listShipments(req.user, req.query));
export const getShipment = handle((req) => shipments.getShipment(req.user, req.params.id));
export const createShipment = handle((req) => shipments.createShipment(req.user, req.body, req), 201);
export const assignTruck = handle((req) => shipments.assignOwnTruck(req.user, req.params.id, req.body, req));
export const requestTransport = handle((req) => shipments.requestTransport(req.user, req.params.id, req.body));
export const releaseTruck = handle((req) => shipments.releaseTransport(req.user, req.params.id, req.body, req));
export const changeTruck = handle((req) => shipments.changeTransport(req.user, req.params.id, req.body, req));
export const schedulePickup = handle((req) => shipments.confirmPickupSchedule(req.user, req.params.id, req.body));
export const startLoading = handle((req) => shipments.startLoading(req.user, req.params.id));
export const confirmLoading = handle((req) => shipments.confirmLoading(req.user, req.params.id, req.body));
export const dispatch = handle((req) => shipments.dispatchShipment(req.user, req.params.id, req.body));
export const addTrackingUpdate = handle((req) => shipments.addTrackingUpdate(req.user, req.params.id, req.body));
export const outForDelivery = handle((req) => shipments.markOutForDelivery(req.user, req.params.id, req.body));
export const arrived = handle((req) => shipments.markArrived(req.user, req.params.id, req.body));
export const deliveryFailed = handle((req) => shipments.markDeliveryFailed(req.user, req.params.id, req.body));
export const startReturn = handle((req) => shipments.startReturn(req.user, req.params.id, req.body));
export const returned = handle((req) => shipments.markReturned(req.user, req.params.id, req.body));
export const cancel = handle((req) => shipments.cancelShipment(req.user, req.params.id, req.body, req));
export const addDocument = handle((req) => shipments.addDocument(req.user, req.params.id, req.body));
export const confirmDelivery = handle((req) => shipments.confirmDelivery(req.user, req.params.id, req.body));
export const resendDeliveryCode = handle((req) => shipments.resendDeliveryCode(req.user, req.params.id));
export const reportIssue = handle((req) => shipments.reportIssue(req.user, req.params.id, req.body), 201);
export const updateFreight = handle((req) => shipments.updateFreightPayment(req.user, req.params.id, req.body, req));

// Transport requests
export const listRequests = handle((req) => shipments.listRequests(req.user, req.query));
export const approveRequest = handle((req) => shipments.approveRequest(req.user, req.params.id, req.body, req));
export const rejectRequest = handle((req) => shipments.rejectRequest(req.user, req.params.id, req.body, req));
export const cancelRequest = handle((req) => shipments.cancelRequest(req.user, req.params.id));

// Issues, reports, audit
export const listIssues = handle((req) => shipments.listIssues(req.user, req.query));
export const resolveIssue = handle((req) => shipments.resolveIssue(req.user, req.params.id, req.body, req));
export const getReports = handle((req) => shipments.getReports(req.query));
export const getAuditTrail = handle((req) => shipments.getAuditTrail(req.query));
