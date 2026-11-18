import * as deletionService from '../services/supplierDeletionService.js';

const handle = (fn, message) => async (req, res, next) => {
  try {
    const data = await fn(req);
    // Live obligations and decisions: never served from a browser or proxy cache
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, ...(message ? { message } : {}), data });
  } catch (error) {
    next(error);
  }
};

// Supplier (signed-in account only)
export const getMyRequest = handle((req) => deletionService.getSupplierRequest(req.user));
export const createMyRequest = handle((req) => deletionService.createSupplierRequest(req.user, req.body || {}), 'Your account deletion request was sent for review.');
export const cancelMyRequest = handle((req) => deletionService.cancelSupplierRequest(req.user), 'Your account deletion request was cancelled.');

// Super Admin
export const listRequests = handle((req) => {
  const { status, search, from, to, sort, order, page, limit } = req.query;
  return deletionService.listRequests({ status, search, from, to, sort, order, page, limit });
});
export const getRequest = handle((req) => deletionService.getRequestDetail(req.params.id));
export const decide = handle((req) => {
  const { action, note, internalNote, adminPassword, nextReviewAt, acknowledgeWarnings } = req.body || {};
  return deletionService.decideRequest({ admin: req.user, id: req.params.id, action, note, internalNote, adminPassword, nextReviewAt, acknowledgeWarnings: acknowledgeWarnings === true });
}, 'Decision saved.');
export const retry = handle((req) => deletionService.retryFailed({ admin: req.user, id: req.params.id }), 'Final deletion will be retried.');
