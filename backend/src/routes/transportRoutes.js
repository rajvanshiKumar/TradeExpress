import { Router } from 'express';
import { param } from 'express-validator';
import * as transport from '../controllers/transportController.js';
import { authenticateJWT, requirePermission, requireRole } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

/**
 * Transport & Delivery Management.
 *   Supplier: own trucks/drivers, shipments for their orders, request a truck from TradeExpress.
 *   Super Admin (and admins with transport.manage): requests, platform fleet, providers, all shipments, issues.
 *   Buyer: read their shipments, confirm delivery with the delivery code, report issues.
 * Services re-check ownership on every record (a supplier only reaches their own shipments and fleet).
 */
const router = Router();
const supplierOrAdmin = requireRole('SUPPLIER', 'ADMIN');
const buyer = requireRole('BUYER');
const admin = requirePermission('transport.manage');
const anyRole = requireRole('BUYER', 'SUPPLIER', 'ADMIN');
const idParam = validate([param('id').isLength({ min: 1, max: 64 }).withMessage('Invalid id.')]);

router.use(authenticateJWT);

router.get('/meta', anyRole, transport.getMeta);
router.get('/overview', anyRole, transport.getOverview);

// Transport providers (external transporters and the TradeExpress fleet)
router.get('/providers', admin, transport.listProviders);
router.post('/providers', admin, transport.createProvider);
router.patch('/providers/:id', admin, idParam, transport.updateProvider);

// Trucks
router.get('/vehicles', supplierOrAdmin, transport.listVehicles);
router.post('/vehicles', supplierOrAdmin, transport.createVehicle);
router.patch('/vehicles/:id', supplierOrAdmin, idParam, transport.updateVehicle);
router.post('/vehicles/:id/status', supplierOrAdmin, idParam, transport.setVehicleStatus);
router.get('/vehicles/:id/history', supplierOrAdmin, idParam, transport.getVehicleHistory);
router.post('/vehicles/:id/verify', admin, idParam, transport.verifyVehicle);

// Drivers
router.get('/drivers', supplierOrAdmin, transport.listDrivers);
router.post('/drivers', supplierOrAdmin, transport.createDriver);
router.patch('/drivers/:id', supplierOrAdmin, idParam, transport.updateDriver);
router.post('/drivers/:id/verify', admin, idParam, transport.verifyDriver);

// Orders
router.get('/orders/shippable', supplierOrAdmin, transport.listShippableOrders);
router.get('/orders/:orderId/shipments', anyRole, transport.getOrderShipments);

// Shipments
router.get('/shipments', anyRole, transport.listShipments);
router.post('/shipments', supplierOrAdmin, transport.createShipment);
router.get('/shipments/:id', anyRole, idParam, transport.getShipment);
router.post('/shipments/:id/assign-truck', supplierOrAdmin, idParam, transport.assignTruck);
router.post('/shipments/:id/request-transport', requireRole('SUPPLIER'), idParam, transport.requestTransport);
router.post('/shipments/:id/release-truck', supplierOrAdmin, idParam, transport.releaseTruck);
router.post('/shipments/:id/change-truck', supplierOrAdmin, idParam, transport.changeTruck);
router.post('/shipments/:id/schedule-pickup', supplierOrAdmin, idParam, transport.schedulePickup);
router.post('/shipments/:id/start-loading', supplierOrAdmin, idParam, transport.startLoading);
router.post('/shipments/:id/confirm-loading', supplierOrAdmin, idParam, transport.confirmLoading);
router.post('/shipments/:id/dispatch', supplierOrAdmin, idParam, transport.dispatch);
router.post('/shipments/:id/tracking', supplierOrAdmin, idParam, transport.addTrackingUpdate);
router.post('/shipments/:id/out-for-delivery', supplierOrAdmin, idParam, transport.outForDelivery);
router.post('/shipments/:id/arrived', supplierOrAdmin, idParam, transport.arrived);
router.post('/shipments/:id/delivery-failed', supplierOrAdmin, idParam, transport.deliveryFailed);
router.post('/shipments/:id/return', supplierOrAdmin, idParam, transport.startReturn);
router.post('/shipments/:id/returned', supplierOrAdmin, idParam, transport.returned);
router.post('/shipments/:id/cancel', supplierOrAdmin, idParam, transport.cancel);
router.post('/shipments/:id/documents', supplierOrAdmin, idParam, transport.addDocument);
router.patch('/shipments/:id/freight', admin, idParam, transport.updateFreight);
router.post('/shipments/:id/confirm-delivery', buyer, idParam, transport.confirmDelivery);
router.post('/shipments/:id/resend-delivery-code', buyer, idParam, transport.resendDeliveryCode);
router.post('/shipments/:id/issues', anyRole, idParam, transport.reportIssue);

// Supplier transport requests
router.get('/requests', supplierOrAdmin, transport.listRequests);
router.post('/requests/:id/approve', admin, idParam, transport.approveRequest);
router.post('/requests/:id/reject', admin, idParam, transport.rejectRequest);
router.post('/requests/:id/cancel', supplierOrAdmin, idParam, transport.cancelRequest);

// Delivery issues, reports, audit
router.get('/issues', anyRole, transport.listIssues);
router.patch('/issues/:id', admin, idParam, transport.resolveIssue);
router.get('/reports', admin, transport.getReports);
router.get('/audit', admin, transport.getAuditTrail);

export default router;
