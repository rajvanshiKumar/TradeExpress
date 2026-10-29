import { Router } from 'express';
import { body } from 'express-validator';
import * as controller from '../controllers/superAdminController.js';
import { authenticateJWT, requireRole } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Protect all Super Admin endpoints with JWT and Super Admin role
router.use(authenticateJWT, requireRole('SUPER_ADMIN'));

// Dashboard
router.get('/dashboard', controller.getDashboard);

// Users
router.get('/users', controller.listUsers);
router.get('/users/export/csv', controller.exportUsersCsv);
router.get('/users/:id', controller.getUserDetails);
router.patch('/users/:id/status', controller.updateUserStatus);
router.post('/users/:id/reset-password', controller.resetUserPassword);

// Suppliers & KYC
router.get('/suppliers/kyc', controller.listSuppliersKyc);
router.post('/suppliers/:id/kyc/review', controller.reviewSupplierKyc);

// Products & Categories
router.get('/products', controller.listProducts);
router.patch('/products/:id/moderate', controller.moderateProduct);
router.get('/categories', controller.listCategories);
router.post(
  '/categories',
  validate([body('name').notEmpty().withMessage('Category name is required.')]),
  controller.createCategory
);
router.put('/categories/:id', controller.updateCategory);
router.delete('/categories/:id', controller.deleteCategory);

// RFQs & Quotes
router.get('/rfqs', controller.listRfqs);
router.get('/rfqs/:id', controller.getRfqDetails);
router.patch('/rfqs/:id/status', controller.updateRfqStatus);

// Orders & Shipping
router.get('/orders', controller.listOrders);
router.get('/orders/:id', controller.getOrderDetails);
router.patch('/orders/:id', controller.updateOrderAdmin);

// Payments & Commissions
router.get('/payments', controller.listPayments);
router.get('/commission', controller.getCommissionSettings);
router.get('/commission/metrics', controller.getCommissionMetrics);
router.post('/commission', controller.updateCommissionSetting);
router.post('/refunds/:orderId', controller.processRefund);

// Disputes & Tickets
router.get('/disputes', controller.listDisputes);
router.get('/disputes/:id', controller.getDisputeDetails);
router.post('/disputes/:id/messages', controller.addDisputeMessage);
router.post('/disputes/:id/resolve', controller.resolveDispute);
router.get('/tickets', controller.listSupportTickets);
router.get('/tickets/:id', controller.getSupportTicketDetails);
router.post('/tickets/:id/reply', controller.replySupportTicket);

// Sub-admins
router.get('/admins', controller.listAdminUsers);
router.post(
  '/admins',
  validate([
    body('name').notEmpty().withMessage('Name is required.'),
    body('email').isEmail().withMessage('Valid email is required.'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
  ]),
  controller.createSubAdmin
);
router.patch('/admins/:id', controller.updateSubAdmin);
router.delete('/admins/:id', controller.deleteSubAdmin);

// Settings & Integrations
router.get('/settings', controller.getPlatformSettings);
router.post('/settings', controller.updatePlatformSetting);
router.get('/integrations', controller.getSystemIntegrations);

// Audit Logs & Reports
router.get('/audit-logs', controller.listAuditLogs);
router.get('/reports/financial', controller.getFinancialReport);

export default router;
