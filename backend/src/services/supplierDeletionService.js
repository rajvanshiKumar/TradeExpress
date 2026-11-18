import prisma from '../config/db.js';
import { consumeAccountGrant } from './accountSecurityService.js';
import { closeSupplierAccount, getDeletionBlockers } from './accountDeletionService.js';
import { createNotification, notifyUsersByRole } from './notificationService.js';
import { invalidateSessionCache } from './sessionService.js';
import { TERMINAL_STATUSES } from './transport/shipmentStateMachine.js';

/*
 * Supplier account deletion approval workflow (organisation closure; individual personal-data requests are separate).
 *
 *   Supplier: request (email code + DELETE)          -> PENDING
 *   Super Admin: approve (own password) / reject / hold (reason required)
 *     PENDING | ON_HOLD  -> APPROVED  public listings hidden, grace period starts (ACCOUNT_DELETION_GRACE_DAYS, default 30)
 *     PENDING | ON_HOLD  -> REJECTED | ON_HOLD
 *   Supplier: cancel  PENDING | ON_HOLD | APPROVED (during grace) -> CANCELLED (hidden listings restored)
 *   Worker:   APPROVED (grace over) -> PROCESSING -> fresh eligibility check
 *               clear      -> existing anonymising close (orders, payments, shipments kept) -> COMPLETED
 *               obligations -> ON_HOLD (admin + supplier notified)
 *               error      -> APPROVED again (retry), FAILED after 3 attempts (admin notified)
 *
 * Every transition is a conditional update (status must still be what was read), appended to the request history
 * and to the audit log. `activeKey` (unique) allows one active request per supplier.
 */

export const ACTIVE_STATUSES = ['PENDING', 'ON_HOLD', 'APPROVED', 'PROCESSING', 'FAILED'];
export const MAX_ATTEMPTS = 3;
const ADMIN_LINK = '/super-admin/deletion-requests';
const SUPPLIER_LINK = '/supplier/account-settings/delete';

export function graceDays() {
  const n = Number.parseInt(process.env.ACCOUNT_DELETION_GRACE_DAYS || '30', 10);
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : 30;
}

function fail(message, statusCode = 400, code = 'DELETION_REQUEST_ERROR', extra = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = code;
  Object.assign(error, extra);
  return error;
}

/** Table not created yet (before the database update): the feature is unavailable rather than broken. */
const notReady = () => fail('Account deletion requests are not available yet: the database update has not been applied.', 503, 'DELETION_REQUESTS_NOT_READY');
async function guard(run) {
  try {
    return await run();
  } catch (error) {
    if (error?.code === 'P2021') throw notReady();
    throw error;
  }
}

/**
 * History entries are only ever appended (earlier decisions are never changed). `note` is supplier-facing;
 * `internalNote`, `actorName` and `actorId` are shown to administrators only.
 */
const historyEntry = (status, actor, note = null, extra = {}) => ({
  at: new Date().toISOString(), status, actorId: actor?.id || null, actorRole: actor?.role || 'SYSTEM',
  ...(actor?.role === 'SUPER_ADMIN' ? { actorName: actor.name || actor.email || null } : {}),
  ...(note ? { note } : {}),
  ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== null && v !== undefined && v !== '')),
});
const append = (request, entry) => [...(Array.isArray(request.history) ? request.history : []), { fromStatus: request.status, ...entry }];

const audit = (db, actor, action, request, details = {}) => db.auditLog.create({
  data: {
    actorId: actor?.id || null, actorEmail: actor?.email || 'system', actorRole: actor?.role || 'SYSTEM', action, resource: 'SUPPLIERS',
    targetId: request.supplierId, details: { requestId: request.id, ...details }, result: 'SUCCESS',
  },
}).catch(() => {});

const notifySupplier = (supplierId, title, message) => createNotification({ userId: supplierId, type: 'SYSTEM', title, message, link: SUPPLIER_LINK }).catch(() => {});
const notifyAdmins = (title, message) => notifyUsersByRole('SUPER_ADMIN', { title, message, type: 'SYSTEM', link: ADMIN_LINK }).catch(() => {});

/** Conditional transition: only from the listed statuses; throws if someone else changed it first. */
async function transition(db, request, fromStatuses, data, entry) {
  const { count } = await db.supplierDeletionRequest.updateMany({
    where: { id: request.id, status: { in: fromStatuses } },
    data: { ...data, history: append(request, entry) },
  });
  if (count !== 1) throw fail('This request was changed by someone else. Please refresh and try again.', 409, 'DELETION_REQUEST_CHANGED');
}

/* ---------- Supplier ---------- */

/** The supplier's current (or most recent) request, with live eligibility. */
export async function getSupplierRequest(supplier) {
  if (supplier.role !== 'SUPPLIER') throw fail('Only supplier accounts can request account closure here.', 403, 'ROLE_NOT_ALLOWED');
  return guard(async () => {
    const request = await prisma.supplierDeletionRequest.findFirst({ where: { supplierId: supplier.id }, orderBy: { createdAt: 'desc' } });
    const blockers = await getDeletionBlockers(supplier.id, 'SUPPLIER');
    return { request: request ? publicRequest(request) : null, blockers, graceDays: graceDays() };
  });
}

/** Creates the request after the emailed-code authorization is consumed (same transaction). */
export async function createSupplierRequest(supplier, { grant, confirmation, reason }) {
  if (supplier.role !== 'SUPPLIER') throw fail('Only supplier accounts can request account closure here.', 403, 'ROLE_NOT_ALLOWED');
  if (String(confirmation || '').trim() !== 'DELETE') throw fail('Type DELETE to confirm your request.', 400, 'CONFIRMATION_REQUIRED');
  const cleanReason = String(reason || '').trim().slice(0, 1000) || null;

  const user = await prisma.user.findUnique({ where: { id: supplier.id }, select: { id: true, email: true, role: true, company: true, name: true, status: true } });
  if (!user || user.role !== 'SUPPLIER') throw fail('Account not found.', 404, 'NOT_FOUND');
  if (user.status === 'DEACTIVATED') throw fail('This account is already closed.', 409, 'ALREADY_CLOSED');

  const request = await guard(() => prisma.$transaction(async (tx) => {
    await consumeAccountGrant(tx, supplier.id, 'ACCOUNT_DELETE', grant);
    const existing = await tx.supplierDeletionRequest.findFirst({ where: { activeKey: supplier.id } });
    if (existing) throw fail('You already have an open account deletion request.', 409, 'REQUEST_ALREADY_OPEN');
    const blockers = await getDeletionBlockers(supplier.id, 'SUPPLIER', tx);
    try {
      return await tx.supplierDeletionRequest.create({
        data: {
          supplierId: supplier.id, requesterId: supplier.id, activeKey: supplier.id, status: 'PENDING', reason: cleanReason,
          obligations: blockers, history: [historyEntry('PENDING', user, 'Request submitted by the supplier.')],
        },
      });
    } catch (error) {
      if (error?.code === 'P2002') throw fail('You already have an open account deletion request.', 409, 'REQUEST_ALREADY_OPEN');
      throw error;
    }
  }));

  await audit(prisma, user, 'SUPPLIER_DELETION_REQUESTED', request, { hasReason: Boolean(cleanReason), openObligations: (request.obligations || []).length });
  notifyAdmins('New supplier account deletion request', `${user.company || user.name} asked to close their supplier account. Review it under Account Deletion Requests.`);
  notifySupplier(supplier.id, 'Account deletion request received', 'Your request to close your supplier account was received and is waiting for TradeExpress review.');
  return publicRequest(request);
}

/** Supplier withdraws the request: allowed until final deletion starts. Hidden listings come back. */
export async function cancelSupplierRequest(supplier) {
  if (supplier.role !== 'SUPPLIER') throw fail('Only supplier accounts can do this.', 403, 'ROLE_NOT_ALLOWED');
  const request = await guard(() => prisma.supplierDeletionRequest.findFirst({ where: { activeKey: supplier.id } }));
  if (!request) throw fail('There is no open deletion request to cancel.', 404, 'NO_OPEN_REQUEST');
  if (!['PENDING', 'ON_HOLD', 'APPROVED'].includes(request.status)) throw fail('This request can no longer be cancelled: final deletion has started.', 409, 'CANNOT_CANCEL');

  await prisma.$transaction(async (tx) => {
    await transition(tx, request, ['PENDING', 'ON_HOLD', 'APPROVED'], { status: 'CANCELLED', activeKey: null }, historyEntry('CANCELLED', supplier, 'Cancelled by the supplier.'));
    const hidden = Array.isArray(request.hiddenProductIds) ? request.hiddenProductIds : [];
    if (hidden.length) await tx.product.updateMany({ where: { id: { in: hidden }, supplierId: supplier.id, status: 'Inactive' }, data: { status: 'Active' } });
  });
  await audit(prisma, supplier, 'SUPPLIER_DELETION_CANCELLED', request, { previousStatus: request.status });
  notifyAdmins('Supplier deletion request cancelled', 'A supplier cancelled their account deletion request.');
  notifySupplier(supplier.id, 'Account deletion request cancelled', 'Your account deletion request was cancelled. Your account stays open.');
  return { cancelled: true };
}

/* ---------- Super Admin ---------- */

const SUPPLIER_SELECT = {
  id: true, name: true, company: true, email: true, phone: true, supplierCode: true, kycStatus: true, isVerified: true, status: true,
  isActive: true, createdAt: true, city: true, state: true, country: true,
};
const OPEN_QUOTE_STATUSES = ['DRAFT', 'SENT', 'VIEWED', 'COUNTERED'];
const OPEN_TICKET_STATUSES = ['OPEN', 'IN_PROGRESS'];
const ACTIVE_ORDER_STATUSES = ['ORDER_PLACED', 'ORDER_CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY'];
const money = (v) => Math.round(Number(v || 0) * 100) / 100;

/** Short, human request reference (the full id stays the real key). */
export const requestRef = (id) => `DR-${String(id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;

/**
 * Live obligations for one supplier, read from the database each time (never cached).
 * blockers  = must be resolved before approval (same rules as the final deletion check)
 * warnings  = do not block on their own but need an explicit acknowledgement to approve
 */
export async function getObligationsReport(supplierId, db = prisma) {
  const [blockers, ordersByStatus, disputedOrders, escrow, payouts, productsByState, openQuotes, openTickets, activeShipments] = await Promise.all([
    getDeletionBlockers(supplierId, 'SUPPLIER', db),
    db.order.groupBy({ by: ['orderStatus'], where: { supplierId }, _count: { _all: true } }),
    db.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] }, order: { supplierId } } }),
    db.escrowLedger.aggregate({ where: { status: { in: ['HELD', 'FROZEN_DISPUTED'] }, order: { supplierId } }, _count: { _all: true }, _sum: { amountHeld: true, payoutAmount: true } }),
    db.supplierPayout.aggregate({ where: { supplierId, status: 'PENDING' }, _count: { _all: true }, _sum: { amount: true } }),
    // One grouped query: every product of this supplier by listing status and moderation status (live, never cached)
    db.product.groupBy({ by: ['status', 'moderationStatus'], where: { supplierId }, _count: { _all: true } }),
    db.quotation.count({ where: { supplierId, status: { in: OPEN_QUOTE_STATUSES } } }),
    db.supportTicket.count({ where: { userId: supplierId, status: { in: OPEN_TICKET_STATUSES } } }),
    db.shipment.count({ where: { supplierId, status: { notIn: TERMINAL_STATUSES } } }),
  ]);
  const byStatus = Object.fromEntries((ordersByStatus || []).map((r) => [r.orderStatus, r._count?._all || 0]));
  // Same definitions as Product Catalogue and the supplier dashboard: Deleted rows are history only
  const productRows = productsByState || [];
  const countWhere = (test) => productRows.filter(test).reduce((n, r) => n + (r._count?._all || 0), 0);
  const live = (r) => r.status !== 'Deleted';
  const productCounts = {
    total: countWhere(live),
    active: countWhere((r) => r.status === 'Active' && r.moderationStatus === 'APPROVED'),
    pendingModeration: countWhere((r) => live(r) && r.moderationStatus === 'PENDING'),
    hidden: countWhere((r) => live(r) && r.status !== 'Active'),
    deleted: countWhere((r) => !live(r)),
    toDeactivate: countWhere((r) => r.status === 'Active'),
  };
  const sum = (keys) => keys.reduce((s, k) => s + (byStatus[k] || 0), 0);
  const warnings = [];
  if (openTickets) warnings.push({ type: 'OPEN_SUPPORT_TICKETS', count: openTickets, message: `${openTickets} support ticket${openTickets === 1 ? ' is' : 's are'} still open.` });
  return {
    checkedAt: new Date().toISOString(),
    state: blockers.length ? 'BLOCKED' : warnings.length ? 'NEEDS_REVIEW' : 'ELIGIBLE',
    blockers,
    warnings,
    orders: {
      pending: sum(['ORDER_PLACED', 'ORDER_CONFIRMED']), processing: sum(['PROCESSING', 'PACKED']), shipped: sum(['SHIPPED', 'OUT_FOR_DELIVERY']),
      delivered: byStatus.DELIVERED || 0, cancelled: byStatus.CANCELLED || 0, refunded: byStatus.REFUNDED || 0, disputed: disputedOrders,
      total: Object.values(byStatus).reduce((s, n) => s + n, 0), active: sum(ACTIVE_ORDER_STATUSES),
    },
    payments: {
      escrowHeldCount: escrow?._count?._all || 0, escrowHeldAmount: money(escrow?._sum?.amountHeld), pendingSettlementAmount: money(escrow?._sum?.payoutAmount),
      pendingPayoutCount: payouts?._count?._all || 0, pendingPayoutAmount: money(payouts?._sum?.amount),
    },
    products: productCounts,
    other: { openQuotations: openQuotes, openSupportTickets: openTickets, activeShipments },
  };
}

/** Requests for the Super Admin list: filters, search, date range, sorting, pagination and status counts. */
export async function listRequests({ status, search, from, to, sort = 'createdAt', order = 'desc', page = 1, limit = 20 } = {}) {
  return guard(async () => {
    const take = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
    const pageNo = Math.max(1, Number.parseInt(page, 10) || 1);
    const where = {};
    if (status && status !== 'ALL') where.status = status === 'APPROVED' ? { in: ['APPROVED', 'PROCESSING'] } : String(status);
    const range = {};
    if (from && !Number.isNaN(Date.parse(from))) range.gte = new Date(from);
    if (to && !Number.isNaN(Date.parse(to))) { const end = new Date(to); end.setHours(23, 59, 59, 999); range.lte = end; }
    if (range.gte || range.lte) where.createdAt = range;
    const q = String(search || '').trim().slice(0, 80);
    if (q) {
      const ref = q.toUpperCase().startsWith('DR-') ? q.slice(3).toLowerCase() : q.toLowerCase();
      where.OR = [
        { supplier: { company: { contains: q } } }, { supplier: { name: { contains: q } } },
        { supplier: { email: { contains: q } } }, { supplier: { supplierCode: { contains: q } } },
        ...(/^[0-9a-f]{4,}$/.test(ref) ? [{ id: { startsWith: `${ref.slice(0, 8)}` } }] : []),
      ];
    }
    const sortField = ['createdAt', 'updatedAt', 'status'].includes(sort) ? sort : 'createdAt';
    const [total, rows, grouped] = await Promise.all([
      prisma.supplierDeletionRequest.count({ where }),
      prisma.supplierDeletionRequest.findMany({ where, orderBy: { [sortField]: order === 'asc' ? 'asc' : 'desc' }, skip: (pageNo - 1) * take, take, include: { supplier: { select: SUPPLIER_SELECT } } }),
      prisma.supplierDeletionRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const counts = Object.fromEntries((grouped || []).map((g) => [g.status, g._count?._all || 0]));
    return {
      items: rows.map((r) => ({ ...publicRequest(r, { admin: true }), supplier: r.supplier })),
      summary: {
        total: Object.values(counts).reduce((s, n) => s + n, 0), pending: counts.PENDING || 0, onHold: counts.ON_HOLD || 0,
        approved: (counts.APPROVED || 0) + (counts.PROCESSING || 0), rejected: counts.REJECTED || 0, completed: counts.COMPLETED || 0,
        cancelled: counts.CANCELLED || 0, failed: counts.FAILED || 0,
      },
      pagination: { page: pageNo, limit: take, total, totalPages: Math.max(1, Math.ceil(total / take)) },
    };
  });
}

/** One request with supplier details and a fresh obligations report (database, at this moment). */
export async function getRequestDetail(id) {
  return guard(async () => {
    const request = await prisma.supplierDeletionRequest.findUnique({ where: { id: String(id) }, include: { supplier: { select: SUPPLIER_SELECT } } });
    if (!request) throw fail('Deletion request not found.', 404, 'NOT_FOUND');
    const obligations = await getObligationsReport(request.supplierId);
    return {
      ...publicRequest(request, { admin: true }),
      supplier: request.supplier,
      obligationsReport: obligations,
      eligibility: { eligible: obligations.state === 'ELIGIBLE', state: obligations.state, blockers: obligations.blockers, warnings: obligations.warnings },
      records: { products: obligations.products.total, activeProducts: obligations.products.active, ordersKept: obligations.orders.total },
      graceDays: graceDays(),
    };
  });
}

/** The acting administrator, re-read from the database (the token's role label is not trusted). */
async function loadActiveSuperAdmin(admin) {
  const actor = admin?.id ? await prisma.user.findUnique({ where: { id: admin.id }, select: { id: true, email: true, name: true, role: true, passwordHash: true, isActive: true, status: true } }) : null;
  if (!actor || actor.role !== 'SUPER_ADMIN' || actor.isActive === false || ['SUSPENDED', 'BLOCKED', 'DEACTIVATED'].includes(String(actor.status || '').toUpperCase())) {
    throw fail('Only an active Super Admin can decide deletion requests.', 403, 'FORBIDDEN');
  }
  return actor;
}

const DECISIONS = {
  APPROVE: { from: ['PENDING', 'ON_HOLD'], to: 'APPROVED' },
  REJECT: { from: ['PENDING', 'ON_HOLD'], to: 'REJECTED' },
  HOLD: { from: ['PENDING'], to: 'ON_HOLD' },
  REOPEN: { from: ['ON_HOLD'], to: 'PENDING' },
};

/**
 * APPROVE  own password + approval remark; fresh obligations check inside the transaction; warnings must be acknowledged
 * REJECT   reason for the supplier (min 10 characters)
 * HOLD     reason for the supplier; optional next review date (future, within a year)
 * REOPEN   resume review of a held request
 * `internalNote` is for administrators only and is never shown or sent to the supplier.
 */
export async function decideRequest({ admin, id, action, note, internalNote, adminPassword, nextReviewAt, acknowledgeWarnings }) {
  const act = String(action || '').toUpperCase();
  const rule = DECISIONS[act];
  if (!rule) throw fail('Choose Approve, Reject, Place on hold or Reopen.', 400, 'BAD_ACTION');
  const actor = await loadActiveSuperAdmin(admin);
  const cleanNote = String(note || '').trim().slice(0, 1000);
  const cleanInternal = String(internalNote || '').trim().slice(0, 1000) || null;
  if (act === 'APPROVE' && cleanNote.length < 5) throw fail('Enter an approval remark (at least 5 characters).', 400, 'REMARK_REQUIRED');
  if ((act === 'REJECT' || act === 'HOLD') && cleanNote.length < 10) throw fail('Enter a clear reason for the supplier (at least 10 characters).', 400, 'REASON_REQUIRED');
  let reviewDate = null;
  if (act === 'HOLD' && nextReviewAt) {
    reviewDate = new Date(nextReviewAt);
    const now = Date.now();
    if (Number.isNaN(reviewDate.getTime()) || reviewDate.getTime() < now - 86400000 || reviewDate.getTime() > now + 366 * 86400000) {
      throw fail('Choose a next review date between today and one year from now.', 400, 'BAD_REVIEW_DATE');
    }
  }
  if (act === 'APPROVE') {
    const { default: bcrypt } = await import('bcryptjs');
    if (!adminPassword || !actor.passwordHash || !(await bcrypt.compare(String(adminPassword), actor.passwordHash))) {
      // 403, not 401: a mistyped confirmation password must not sign the admin out
      throw fail('Your password is incorrect. Please confirm with your own Super Admin password.', 403, 'REAUTH_FAILED');
    }
  }

  const request = await guard(() => prisma.supplierDeletionRequest.findUnique({ where: { id: String(id) } }));
  if (!request) throw fail('Deletion request not found.', 404, 'NOT_FOUND');
  if (!rule.from.includes(request.status)) {
    throw fail(`This request is ${request.status.toLowerCase().replace('_', ' ')} and cannot be changed this way. It may have been decided by another administrator; refresh to see the latest state.`, 409, 'INVALID_TRANSITION');
  }

  const supplierUser = await prisma.user.findUnique({ where: { id: request.supplierId }, select: { id: true, role: true, status: true } });
  if (!supplierUser || supplierUser.role !== 'SUPPLIER' || supplierUser.status === 'DEACTIVATED') {
    throw fail('The supplier account is not in a state that allows this decision. Refresh and review the account.', 409, 'INCONSISTENT_STATE');
  }

  let graceEndsAt = null;
  const entry = (status, supplierNote) => historyEntry(status, actor, supplierNote, { action: act, internalNote: cleanInternal, ...(reviewDate ? { nextReviewAt: reviewDate.toISOString() } : {}) });
  await prisma.$transaction(async (tx) => {
    if (act === 'APPROVE') {
      // Fresh, authoritative check at the moment of approval (any error here blocks the approval)
      const report = await getObligationsReport(request.supplierId, tx);
      if (report.blockers.length) {
        throw fail(`Approval blocked by open obligations: ${report.blockers.map((b) => b.message).join(' ')}`, 409, 'HAS_OBLIGATIONS', { blockers: report.blockers });
      }
      if (report.warnings.length && acknowledgeWarnings !== true) {
        throw fail(`Please review before approving: ${report.warnings.map((w) => w.message).join(' ')}`, 409, 'NEEDS_ACKNOWLEDGEMENT', { warnings: report.warnings });
      }
      graceEndsAt = new Date(Date.now() + graceDays() * 86400000);
      const live = await tx.product.findMany({ where: { supplierId: request.supplierId, status: 'Active' }, select: { id: true } });
      await transition(tx, request, rule.from, {
        status: 'APPROVED', decidedById: actor.id, decidedAt: new Date(), decisionNote: null, graceEndsAt,
        hiddenProductIds: live.map((p) => p.id), obligations: [],
      }, { ...entry('APPROVED', `Approved. The account will close on ${graceEndsAt.toDateString()} unless the request is cancelled.`), internalNote: [cleanNote, cleanInternal].filter(Boolean).join(' — ') });
      if (live.length) await tx.product.updateMany({ where: { id: { in: live.map((p) => p.id) } }, data: { status: 'Inactive' } });
    } else if (act === 'REJECT') {
      await transition(tx, request, rule.from, { status: 'REJECTED', activeKey: null, decidedById: actor.id, decidedAt: new Date(), decisionNote: cleanNote }, entry('REJECTED', cleanNote));
    } else if (act === 'HOLD') {
      await transition(tx, request, rule.from, { status: 'ON_HOLD', decidedById: actor.id, decidedAt: new Date(), decisionNote: cleanNote }, entry('ON_HOLD', cleanNote));
    } else {
      await transition(tx, request, rule.from, { status: 'PENDING', decisionNote: null }, entry('PENDING', cleanNote || 'Review resumed.'));
    }
  });

  await audit(prisma, actor, { APPROVE: 'SUPPLIER_DELETION_APPROVED', REJECT: 'SUPPLIER_DELETION_REJECTED', HOLD: 'SUPPLIER_DELETION_ON_HOLD', REOPEN: 'SUPPLIER_DELETION_REOPENED' }[act], request, { fromStatus: request.status, hasInternalNote: Boolean(cleanInternal) });
  // Supplier notices carry only supplier-facing text (never the internal note)
  const ref = requestRef(request.id);
  if (act === 'APPROVE') {
    notifySupplier(request.supplierId, 'Account deletion approved', `Request ${ref} was approved. Your products are no longer shown to buyers. Your account is scheduled to close on ${graceEndsAt.toDateString()}. You can cancel until then from Account Settings.`);
  } else if (act === 'REJECT') {
    notifySupplier(request.supplierId, 'Account deletion request rejected', `Request ${ref} was rejected: ${cleanNote} Your account stays open; you can send a new request later.`);
  } else if (act === 'HOLD') {
    notifySupplier(request.supplierId, 'Account deletion request on hold', `Request ${ref} is on hold: ${cleanNote}${reviewDate ? ` Next review: ${reviewDate.toDateString()}.` : ''}`);
  } else {
    notifySupplier(request.supplierId, 'Account deletion request back in review', `Request ${ref} is being reviewed again.`);
  }
  return getRequestDetail(request.id);
}

/** During an approved grace period the supplier cannot start new trade (new or re-activated products, new quotes). */
export async function assertSupplierCanTrade(supplierId) {
  let closing = null;
  try {
    closing = await prisma.supplierDeletionRequest.findFirst({ where: { activeKey: supplierId, status: { in: ['APPROVED', 'PROCESSING'] } }, select: { graceEndsAt: true } });
  } catch (error) {
    if (error?.code === 'P2021') return; // before the database update
    throw error;
  }
  if (closing) {
    throw fail(`Your account is scheduled to close${closing.graceEndsAt ? ` on ${new Date(closing.graceEndsAt).toDateString()}` : ''}. Cancel the deletion request in Account Settings to list products or send quotes again.`, 409, 'ACCOUNT_CLOSING');
  }
}

/* ---------- Final deletion worker ---------- */

/** Processes approved requests whose grace period is over. Safe to run repeatedly and concurrently. */
export async function processDueDeletions({ now = new Date(), limit = 10 } = {}) {
  let due;
  try {
    due = await prisma.supplierDeletionRequest.findMany({ where: { status: 'APPROVED', graceEndsAt: { lte: now } }, orderBy: { graceEndsAt: 'asc' }, take: limit });
  } catch (error) {
    if (error?.code === 'P2021') return { processed: 0 }; // before the database update
    throw error;
  }
  const results = [];
  for (const request of due) {
    // Claim: only one worker can move APPROVED -> PROCESSING
    const { count } = await prisma.supplierDeletionRequest.updateMany({
      where: { id: request.id, status: 'APPROVED' },
      data: { status: 'PROCESSING', attempts: { increment: 1 }, history: append(request, historyEntry('PROCESSING', null, 'Final deletion started after the grace period.')) },
    });
    if (count !== 1) continue;
    const claimed = await prisma.supplierDeletionRequest.findUnique({ where: { id: request.id } });
    results.push(await finalize(claimed));
  }
  return { processed: results.length, results };
}

async function finalize(request) {
  try {
    const blockers = await getDeletionBlockers(request.supplierId, 'SUPPLIER');
    if (blockers.length) {
      await prisma.supplierDeletionRequest.update({
        where: { id: request.id },
        data: { status: 'ON_HOLD', obligations: blockers, decisionNote: 'Open obligations were found at the final check.', history: append(request, historyEntry('ON_HOLD', null, `Final check found open obligations: ${blockers.map((b) => b.type).join(', ')}.`)) },
      });
      await audit(prisma, null, 'SUPPLIER_DELETION_ON_HOLD', request, { reason: 'FINAL_CHECK_OBLIGATIONS', obligations: blockers.map((b) => b.type) });
      notifyAdmins('Supplier deletion put on hold', 'The final check found open obligations, so the account was not closed. Review the request.');
      notifySupplier(request.supplierId, 'Account deletion on hold', 'Your account was not closed because there are open orders, payments or shipments. Please resolve them; TradeExpress will review the request again.');
      return { id: request.id, status: 'ON_HOLD' };
    }

    // Existing close: personal data removed or anonymised; orders, payments, invoices and shipments kept; sessions ended
    await closeSupplierAccount(request.supplierId, 'Supplier account closed after an approved deletion request.');
    invalidateSessionCache(null, request.supplierId);
    await prisma.supplierDeletionRequest.update({
      where: { id: request.id },
      data: { status: 'COMPLETED', activeKey: null, completedAt: new Date(), lastError: null, history: append(request, historyEntry('COMPLETED', null, 'Account closed. Legally required business records were retained.')) },
    });
    await audit(prisma, null, 'SUPPLIER_DELETION_COMPLETED', request);
    notifyAdmins('Supplier account closed', 'An approved supplier account deletion was completed.');
    return { id: request.id, status: 'COMPLETED' };
  } catch (error) {
    const giveUp = request.attempts >= MAX_ATTEMPTS;
    await prisma.supplierDeletionRequest.update({
      where: { id: request.id },
      data: {
        status: giveUp ? 'FAILED' : 'APPROVED', lastError: String(error?.message || 'Unknown error').slice(0, 500),
        history: append(request, historyEntry(giveUp ? 'FAILED' : 'APPROVED', null, giveUp ? 'Final deletion failed after several attempts.' : 'Final deletion failed; it will be retried.')),
      },
    }).catch(() => {});
    if (giveUp) notifyAdmins('Supplier deletion failed', 'A supplier account could not be closed after several attempts. Review the request.');
    return { id: request.id, status: giveUp ? 'FAILED' : 'RETRY' };
  }
}

/** Super Admin retries a FAILED request (back to APPROVED, due immediately). */
export async function retryFailed({ admin, id }) {
  const actor = await loadActiveSuperAdmin(admin);
  const request = await guard(() => prisma.supplierDeletionRequest.findUnique({ where: { id: String(id) } }));
  if (!request) throw fail('Deletion request not found.', 404, 'NOT_FOUND');
  await transition(prisma, request, ['FAILED'], { status: 'APPROVED', attempts: 0, graceEndsAt: new Date() }, historyEntry('APPROVED', actor, 'Final deletion will be retried.', { action: 'RETRY' }));
  return getRequestDetail(request.id);
}

let worker = null;
/** Background worker (hourly by default). */
export function startDeletionWorker(intervalMs = 60 * 60 * 1000) {
  if (worker) return worker;
  let running = false;
  worker = setInterval(() => {
    if (running) return;
    running = true;
    processDueDeletions().catch((err) => console.error('[Deletion] Worker run failed:', err.message)).finally(() => { running = false; });
  }, intervalMs);
  worker.unref?.();
  return worker;
}

function publicRequest(r, { admin = false } = {}) {
  const history = (Array.isArray(r.history) ? r.history : []).map((h) => (admin ? h : {
    at: h.at, status: h.status, fromStatus: h.fromStatus, actorRole: h.actorRole, ...(h.note ? { note: h.note } : {}), ...(h.nextReviewAt ? { nextReviewAt: h.nextReviewAt } : {}),
  }));
  return {
    id: r.id, reference: requestRef(r.id), supplierId: r.supplierId, status: r.status, reason: r.reason, decisionNote: r.decisionNote, decidedAt: r.decidedAt,
    graceEndsAt: r.graceEndsAt, completedAt: r.completedAt, obligations: r.obligations || [], history,
    attempts: r.attempts, createdAt: r.createdAt, updatedAt: r.updatedAt,
    ...(admin ? { decidedById: r.decidedById, lastError: r.lastError || null } : {}),
    canCancel: ['PENDING', 'ON_HOLD', 'APPROVED'].includes(r.status),
  };
}
