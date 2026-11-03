import * as escrowService from '../services/escrowService.js';

export async function getSummary(req, res, next) {
  try {
    const summary = await escrowService.getEscrowSummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
}

export async function listLedgers(req, res, next) {
  try {
    const { status, supplierId } = req.query;
    // Suppliers only ever see their own ledgers; staff may filter by supplier
    const isStaff = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
    const ledgers = await escrowService.listEscrowLedgers({
      status,
      supplierId: isStaff ? supplierId : req.user.id,
    });
    res.json({ success: true, count: ledgers.length, data: ledgers });
  } catch (error) {
    next(error);
  }
}

export async function releasePayout(req, res, next) {
  try {
    const result = await escrowService.releaseEscrow(req.params.orderId, {
      adminNote: req.body.note,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}
