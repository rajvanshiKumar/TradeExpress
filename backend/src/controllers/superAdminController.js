import * as superAdminService from '../services/superAdminService.js';
import * as auditService from '../services/auditService.js';

// Dashboard
export async function getDashboard(req, res, next) {
  try {
    const data = await superAdminService.getDashboardStats(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Users
export async function listUsers(req, res, next) {
  try {
    const data = await superAdminService.getUsers(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getUserDetails(req, res, next) {
  try {
    const data = await superAdminService.getUserDetails(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateUserStatus(req, res, next) {
  try {
    const { status, isActive, reason } = req.body;
    const data = await superAdminService.updateUserStatus({
      userId: req.params.id,
      status,
      isActive,
      reason,
      req,
    });
    res.json({ success: true, message: 'User status updated successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function resetUserPassword(req, res, next) {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }
    const data = await superAdminService.resetUserPassword({
      userId: req.params.id,
      newPassword,
      req,
    });
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function exportUsersCsv(req, res, next) {
  try {
    const result = await superAdminService.getUsers({ limit: 1000, ...req.query });
    const header = 'ID,Name,Email,Role,Status,Company,Phone,City,Country,KYC Status,Verified,Joined At\n';
    const rows = result.users.map((u) => {
      const clean = (val) => `"${String(val || '').replace(/"/g, '""')}"`;
      return [
        clean(u.id),
        clean(u.name),
        clean(u.email),
        clean(u.role),
        clean(u.status),
        clean(u.company),
        clean(u.phone),
        clean(u.city),
        clean(u.country),
        clean(u.kycStatus),
        clean(u.isVerified ? 'YES' : 'NO'),
        clean(u.createdAt ? new Date(u.createdAt).toISOString() : ''),
      ].join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=users_export_${Date.now()}.csv`);
    res.status(200).send(header + rows);
  } catch (err) {
    next(err);
  }
}

// Supplier KYC
export async function listSuppliersKyc(req, res, next) {
  try {
    const data = await superAdminService.getSuppliersKyc(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function reviewSupplierKyc(req, res, next) {
  try {
    const { status, rejectionReason, notes } = req.body;
    const data = await superAdminService.reviewSupplierKyc({
      supplierId: req.params.id,
      status,
      rejectionReason,
      notes,
      req,
    });
    res.json({ success: true, message: `Supplier KYC status set to ${status}.`, data });
  } catch (err) {
    next(err);
  }
}

// Products
export async function listProducts(req, res, next) {
  try {
    const data = await superAdminService.getProducts(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function moderateProduct(req, res, next) {
  try {
    const data = await superAdminService.moderateProduct({
      productId: req.params.id,
      ...req.body,
      req,
    });
    res.json({ success: true, message: 'Product moderation updated.', data });
  } catch (err) {
    next(err);
  }
}

// Categories
export async function listCategories(req, res, next) {
  try {
    const data = await superAdminService.getCategories();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req, res, next) {
  try {
    const data = await superAdminService.createCategory(req.body, req);
    res.status(201).json({ success: true, message: 'Category created.', data });
  } catch (err) {
    next(err);
  }
}

export async function updateCategory(req, res, next) {
  try {
    const data = await superAdminService.updateCategory(req.params.id, req.body, req);
    res.json({ success: true, message: 'Category updated.', data });
  } catch (err) {
    next(err);
  }
}

export async function deleteCategory(req, res, next) {
  try {
    const data = await superAdminService.deleteCategory(req.params.id, req);
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

// RFQs
export async function listRfqs(req, res, next) {
  try {
    const data = await superAdminService.getRfqs(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getRfqDetails(req, res, next) {
  try {
    const data = await superAdminService.getRfqDetails(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateRfqStatus(req, res, next) {
  try {
    const data = await superAdminService.updateRfqStatus(req.params.id, {
      status: req.body.status,
      req,
    });
    res.json({ success: true, message: 'RFQ status updated.', data });
  } catch (err) {
    next(err);
  }
}

// Orders
export async function listOrders(req, res, next) {
  try {
    const data = await superAdminService.getOrders(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getOrderDetails(req, res, next) {
  try {
    const data = await superAdminService.getOrderDetails(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateOrderAdmin(req, res, next) {
  try {
    const data = await superAdminService.updateOrderAdmin({
      orderId: req.params.id,
      ...req.body,
      req,
    });
    res.json({ success: true, message: 'Order updated successfully.', data });
  } catch (err) {
    next(err);
  }
}

// Payments & Commissions
export async function listPayments(req, res, next) {
  try {
    const data = await superAdminService.getPayments(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getCommissionSettings(req, res, next) {
  try {
    const data = await superAdminService.getCommissionSettings();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getCommissionMetrics(req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    const data = await superAdminService.getCommissionMetrics({ startDate, endDate });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateCommissionSetting(req, res, next) {
  try {
    const data = await superAdminService.updateCommissionSetting({
      ...req.body,
      req,
    });
    res.json({ success: true, message: 'Commission setting saved.', data });
  } catch (err) {
    next(err);
  }
}

export async function processRefund(req, res, next) {
  try {
    const { amount, reason } = req.body;
    const data = await superAdminService.processRefund({
      orderId: req.params.orderId,
      amount,
      reason,
      req,
    });
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

// Disputes & Support
export async function listDisputes(req, res, next) {
  try {
    const data = await superAdminService.getDisputes(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getDisputeDetails(req, res, next) {
  try {
    const data = await superAdminService.getDisputeDetails(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function addDisputeMessage(req, res, next) {
  try {
    const { message, fileUrl } = req.body;
    const data = await superAdminService.addDisputeMessage({
      disputeId: req.params.id,
      message,
      fileUrl,
      req,
    });
    res.status(201).json({ success: true, message: 'Message sent.', data });
  } catch (err) {
    next(err);
  }
}

export async function resolveDispute(req, res, next) {
  try {
    const { resolution, action, refundAmount } = req.body;
    const data = await superAdminService.resolveDispute({
      disputeId: req.params.id,
      resolution,
      action,
      refundAmount,
      req,
    });
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function listSupportTickets(req, res, next) {
  try {
    const data = await superAdminService.getSupportTickets(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getSupportTicketDetails(req, res, next) {
  try {
    const data = await superAdminService.getTicketDetails(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function replySupportTicket(req, res, next) {
  try {
    const { message, status } = req.body;
    const data = await superAdminService.replySupportTicket({
      ticketId: req.params.id,
      message,
      status,
      req,
    });
    res.status(201).json({ success: true, message: 'Reply sent.', data });
  } catch (err) {
    next(err);
  }
}

// Sub-admins
export async function listAdminUsers(req, res, next) {
  try {
    const data = await superAdminService.getAdminUsers();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createSubAdmin(req, res, next) {
  try {
    const data = await superAdminService.createSubAdmin({
      ...req.body,
      req,
    });
    res.status(201).json({ success: true, message: 'Sub-admin created successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function updateSubAdmin(req, res, next) {
  try {
    const data = await superAdminService.updateSubAdmin({
      adminId: req.params.id,
      ...req.body,
      req,
    });
    res.json({ success: true, message: 'Sub-admin updated successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function deleteSubAdmin(req, res, next) {
  try {
    const data = await superAdminService.deleteSubAdmin({
      adminId: req.params.id,
      req,
    });
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

// Platform Settings & Integrations
export async function getPlatformSettings(req, res, next) {
  try {
    const data = await superAdminService.getPlatformSettings();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updatePlatformSetting(req, res, next) {
  try {
    const { key, value, description, category } = req.body;
    const data = await superAdminService.updatePlatformSetting({
      key,
      value,
      description,
      category,
      req,
    });
    res.json({ success: true, message: 'Setting updated successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function getSystemIntegrations(req, res, next) {
  try {
    const data = superAdminService.getSystemIntegrations();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Audit Logs
export async function listAuditLogs(req, res, next) {
  try {
    const data = await auditService.getAuditLogs(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Financial Report
export async function getFinancialReport(req, res, next) {
  try {
    const data = await superAdminService.getFinancialReport(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
