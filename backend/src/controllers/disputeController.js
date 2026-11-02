import * as disputeService from '../services/disputeService.js';

export async function createDispute(req, res, next) {
  try {
    const dispute = await disputeService.createDispute({
      ...req.body,
      orderId: req.params.orderId || req.body.orderId,
      buyerId: req.user?.id || req.body.buyerId,
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
    res.json({ success: true, data: dispute });
  } catch (error) {
    next(error);
  }
}

export async function listDisputes(req, res, next) {
  try {
    const { status, role } = req.query;
    const disputes = await disputeService.listDisputes({
      status,
      role: role || req.user?.role,
      userId: req.user?.id,
    });
    res.json({ success: true, count: disputes.length, data: disputes });
  } catch (error) {
    next(error);
  }
}

export async function addMessage(req, res, next) {
  try {
    const msg = await disputeService.addDisputeMessage(req.params.id, {
      ...req.body,
      senderRole: req.user?.role || req.body.senderRole || 'BUYER',
    });
    res.status(201).json({ success: true, data: msg });
  } catch (error) {
    next(error);
  }
}

export async function resolveDispute(req, res, next) {
  try {
    const resolved = await disputeService.resolveDispute(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Dispute resolution recorded successfully.',
      data: resolved,
    });
  } catch (error) {
    next(error);
  }
}
