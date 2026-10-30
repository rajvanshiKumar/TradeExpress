import { Router } from 'express';
import { body } from 'express-validator';
import * as logisticsController from '../controllers/logisticsController.js';
import { authenticateJWT, requireRole } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Public Tracking by AWB / Tracking number
router.get('/shipments/track/:trackingNumber', logisticsController.trackByNumber);

// All subsequent routes require JWT authentication
router.use(authenticateJWT);

// --- Metrics Overview ---
router.get('/metrics', logisticsController.getMetrics);

// --- Transport Companies ---
router.post(
  '/companies',
  validate([
    body('name').trim().notEmpty().withMessage('Company name is required.'),
    body('phone').trim().notEmpty().withMessage('Phone number is required.'),
  ]),
  logisticsController.createCompany
);
router.get('/companies', logisticsController.listCompanies);
router.get('/companies/:id', logisticsController.getCompanyById);
router.patch(
  '/companies/:id/verify',
  requireRole('ADMIN', 'SUPER_ADMIN'),
  validate([
    body('verificationStatus').isIn(['VERIFIED', 'REJECTED', 'PENDING']).withMessage('Invalid verification status.'),
  ]),
  logisticsController.verifyCompany
);

// --- Vehicles ---
router.post(
  '/vehicles',
  validate([
    body('companyId').notEmpty().withMessage('Company ID is required.'),
    body('vehicleNumber').trim().notEmpty().withMessage('Vehicle registration number is required.'),
    body('capacityTons').isFloat({ min: 0.1 }).withMessage('Valid capacity in tons is required.'),
  ]),
  logisticsController.addVehicle
);
router.get('/vehicles', logisticsController.listVehicles);
router.patch(
  '/vehicles/:id/verify',
  requireRole('ADMIN', 'SUPER_ADMIN'),
  logisticsController.verifyVehicle
);

// --- Drivers ---
router.post(
  '/drivers',
  validate([
    body('companyId').notEmpty().withMessage('Company ID is required.'),
    body('name').trim().notEmpty().withMessage('Driver name is required.'),
    body('phone').trim().notEmpty().withMessage('Driver phone number is required.'),
    body('licenseNumber').trim().notEmpty().withMessage('Commercial license number is required.'),
  ]),
  logisticsController.addDriver
);
router.get('/drivers', logisticsController.listDrivers);
router.patch(
  '/drivers/:id/verify',
  requireRole('ADMIN', 'SUPER_ADMIN'),
  logisticsController.verifyDriver
);

// --- Transport Requests (TradeExpress-Managed) ---
router.post(
  '/requests',
  requireRole('SUPPLIER', 'ADMIN', 'SUPER_ADMIN'),
  validate([
    body('pickupAddress').notEmpty().withMessage('Pickup address is required.'),
    body('deliveryAddress').notEmpty().withMessage('Delivery address is required.'),
    body('pickupDate').isISO8601().withMessage('Valid pickup date is required.'),
  ]),
  logisticsController.createTransportRequest
);
router.get('/requests', logisticsController.listTransportRequests);
router.get(
  '/requests/open',
  requireRole('TRANSPORT_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
  logisticsController.listOpenRequestsForPartners
);

// --- Freight Quotes ---
router.post(
  '/requests/:requestId/quotes',
  requireRole('TRANSPORT_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
  validate([
    body('baseFreight').isFloat({ min: 1 }).withMessage('Valid base freight amount is required.'),
  ]),
  logisticsController.submitFreightQuote
);
router.post(
  '/quotes/:quoteId/accept',
  requireRole('SUPPLIER', 'ADMIN', 'SUPER_ADMIN'),
  logisticsController.acceptFreightQuote
);

// --- Shipments ---
router.post(
  '/shipments/supplier-managed',
  requireRole('SUPPLIER', 'ADMIN', 'SUPER_ADMIN'),
  validate([
    body('pickupAddress').notEmpty().withMessage('Pickup address is required.'),
    body('deliveryAddress').notEmpty().withMessage('Delivery address is required.'),
  ]),
  logisticsController.createSupplierShipment
);
router.get('/shipments', logisticsController.listShipments);
router.get('/shipments/:id', logisticsController.getShipmentById);
router.patch(
  '/shipments/:id/status',
  validate([
    body('newStatus').notEmpty().withMessage('New status is required.'),
  ]),
  logisticsController.updateStatus
);
router.patch(
  '/shipments/:id/verify',
  requireRole('ADMIN', 'SUPER_ADMIN'),
  logisticsController.verifyShipment
);
router.post(
  '/shipments/:id/assign',
  validate([
    body('vehicleId').notEmpty().withMessage('Vehicle ID is required.'),
    body('driverId').notEmpty().withMessage('Driver ID is required.'),
  ]),
  logisticsController.assignVehicleAndDriver
);

// --- Documents ---
router.post(
  '/shipments/:id/documents',
  validate([
    body('fileUrl').notEmpty().withMessage('File URL is required.'),
    body('title').notEmpty().withMessage('Document title is required.'),
  ]),
  logisticsController.uploadDocument
);
router.patch(
  '/documents/:docId/verify',
  requireRole('TRANSPORT_PARTNER', 'ADMIN', 'SUPER_ADMIN'),
  logisticsController.verifyDocument
);

// --- Proof of Delivery (POD) ---
router.post(
  '/shipments/:id/delivery-proof',
  validate([
    body('recipientName').trim().notEmpty().withMessage('Recipient name is required.'),
  ]),
  logisticsController.recordDeliveryProof
);

// --- Disputes ---
router.post(
  '/shipments/:id/dispute',
  requireRole('BUYER', 'ADMIN', 'SUPER_ADMIN'),
  validate([
    body('description').trim().notEmpty().withMessage('Dispute description is required.'),
  ]),
  logisticsController.raiseDispute
);
router.patch(
  '/shipments/:id/resolve-dispute',
  requireRole('ADMIN', 'SUPER_ADMIN'),
  validate([
    body('resolution').trim().notEmpty().withMessage('Resolution summary is required.'),
  ]),
  logisticsController.resolveDispute
);

// --- Real GPS Telemetry ---
router.post(
  '/shipments/:id/telemetry',
  validate([
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required.'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required.'),
  ]),
  logisticsController.recordTelemetry
);
router.get('/shipments/:id/telemetry', logisticsController.getTelemetry);

// --- Freight Payments & Escrow ---
router.get('/freight-payments', logisticsController.listFreightPayments);
router.post(
  '/freight-payments/:id/release',
  requireRole('ADMIN', 'SUPER_ADMIN'),
  logisticsController.releaseFreightPayment
);

export default router;

