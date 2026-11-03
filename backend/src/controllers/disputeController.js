import * as disputeService from '../services/disputeService.js';

// Identity and role always come from the authenticated user, never from the request body or query.
const isStaff = (user) => user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

function forbidden(message = 'You do not have access to this dispute.') {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
}

/** Buyer of the order, supplier of the order, or staff. */
function assertDisputeAccess(dispute, user) {
  if (isStaff(user)) return 'ADMIN';
  if (dispute.buyerId === user.id) return 'BUYER';
  if (dispute.order?.supplierId && dispute.order.supplierId === user.id) return 'SUPPLIER';
  throw forbidden();
}

export async function createDispute(req, res, next) {
  try {
    const { reason, description, photoProof, requestedResolution } = req.body;
    const dispute = await disputeService.createDispute({
      orderId: req.params.orderId || req.body.orderId,
      buyerId: req.user.id,
      reason,
      description,
      photoProof,
      requestedResolution,
    });

    res.status(201).json({
      success: true,
      message: 'Dispute submitted successfully. Escrow funds have been frozen for inspection review.',
      data: dispute,
    });
  } catch (error) {
    next(error);
  }
}

export async function getDispute(req, res, next) {
  try {
    const dispute = await disputeService.getDispute(req.params.id);
    assertDisputeAccess(dispute, req.user);
    res.json({ success: true, data: dispute });
  } catch (error) {
    next(error);
  }
}

export async function listDisputes(req, res, next) {
  try {
    // Staff see every dispute; suppliers see disputes on their orders; everyone else sees their own
    const role = isStaff(req.user) ? '' : req.user.role === 'SUPPLIER' ? 'SUPPLIER' : 'BUYER';
    const disputes = await disputeService.listDisputes({
      status: req.query.status,
      role,
      userId: req.user.id,
    });
    res.json({ success: true, count: disputes.length, data: disputes });
  } catch (error) {
    next(error);
  }
}

export async function addMessage(req, res, next) {
  try {
    const dispute = await disputeService.getDispute(req.params.id);
    const senderRole = assertDisputeAccess(dispute, req.user);
    const msg = await disputeService.addDisputeMessage(dispute.id, {
      senderRole,
      message: req.body.message,
      fileUrl: req.body.fileUrl,
    });
    res.status(201).json({ success: true, data: msg });
  } catch (error) {
    next(error);
  }
}

export async function resolveDispute(req, res, next) {
  try {
    const { action, resolutionNote, refundAmount } = req.body;
    const resolved = await disputeService.resolveDispute(req.params.id, { action, resolutionNote, refundAmount });
    res.json({
      success: true,
      message: 'Dispute resolution recorded successfully.',
      data: resolved,
    });
  } catch (error) {
    next(error);
  }
}
