import { Router } from 'express';
import { body } from 'express-validator';
import * as supplierDashboardController from '../controllers/supplierDashboardController.js';
import { authenticateJWT, requireRole } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Protect all supplier dashboard endpoints
router.use(authenticateJWT, requireRole('SUPPLIER', 'ADMIN'));

// 1. Dashboard Overview / Stats
router.get('/dashboard', supplierDashboardController.getOverview);
router.get('/overview', supplierDashboardController.getOverview);

// 2. Quotations
router.get('/quotations', supplierDashboardController.listQuotations);
router.post(
  '/quotations',
  validate([
    body('rfqId').notEmpty().withMessage('RFQ ID is required.'),
    body('unitPrice').isFloat({ min: 0.01 }).withMessage('Unit price must be greater than 0.'),
    body('leadTimeDays').isInt({ min: 1 }).withMessage('Lead time days must be at least 1.'),
  ]),
  supplierDashboardController.createQuotation
);

// 3. Payments & Earnings
router.get('/payments', supplierDashboardController.getPayments);
router.get('/financials', supplierDashboardController.getPayments);

// 4. Analytics
router.get('/analytics', supplierDashboardController.getAnalytics);

// 5. Shipping & Logistics
router.get('/shipping', supplierDashboardController.getShipping);
router.post(
  '/shipping/:orderId/dispatch',
  validate([
    body('carrierName').trim().notEmpty().withMessage('Carrier name is required.'),
    body('trackingNumber').trim().notEmpty().withMessage('Tracking / AWB number is required.'),
  ]),
  supplierDashboardController.dispatchOrder
);

// 6. Orders Workflow (Step 2: Supplier confirms or rejects)
router.post('/orders/:orderId/accept', supplierDashboardController.acceptOrder);
router.post('/orders/:orderId/reject', supplierDashboardController.rejectOrder);
router.put('/orders/:orderId/status', supplierDashboardController.updateOrderStatus);

// 7. Profile
router.get('/profile', supplierDashboardController.getProfile);
router.put('/profile', supplierDashboardController.updateProfile);

export default router;
