import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import prisma from '../../src/config/db.js';
import { deleteOwnAccount } from '../../src/services/accountDeletionService.js';
import * as deletion from '../../src/services/supplierDeletionService.js';

// All database access goes through this in-memory stub; nothing reaches a real database.
let stub;
prisma.$use(async (params) => (stub ? stub(params) : null));

const SUPPLIER = { id: 'sup-1', role: 'SUPPLIER', email: 's@x.co' };
const ADMIN = { id: 'adm-1', role: 'SUPER_ADMIN', email: 'a@x.co' };
const ADMIN_HASH = bcrypt.hashSync('Admin#Pass1', 4);

/** Minimal in-memory database for the workflow. counts = open obligations by model. */
function makeDb(t, { counts = {}, requests = [], products = [{ id: 'p1', supplierId: 'sup-1', status: 'Active' }, { id: 'p2', supplierId: 'sup-1', status: 'Inactive' }], grant = true, userStatus = 'Active', failClose = false } = {}) {
  const db = { requests: requests.map((r) => ({ history: [], attempts: 0, ...r })), products: products.map((p) => ({ ...p })), audit: [], notifications: [], closed: false, userStatus, adminActive: true };
  const match = (r, where = {}) => Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if (v.in) return v.in.includes(r[k]);
      if (v.lte) return r[k] && new Date(r[k]) <= v.lte;
      if (v.not !== undefined) return r[k] !== v.not;
      return true;
    }
    return r[k] === v;
  });
  stub = async (q) => {
    const { model, action, args = {} } = q;
    if (model === 'SupplierDeletionRequest') {
      if (action === 'findFirst') return db.requests.filter((r) => match(r, args.where)).sort((a, b) => b.createdAt - a.createdAt)[0] || null;
      if (action === 'findUnique') return db.requests.find((r) => r.id === args.where.id) || null;
      if (action === 'findMany') return db.requests.filter((r) => match(r, args.where));
      if (action === 'create') {
        if (db.requests.some((r) => r.activeKey && r.activeKey === args.data.activeKey)) { const e = new Error('dup'); e.code = 'P2002'; throw e; }
        const r = { id: `req-${db.requests.length + 1}`, attempts: 0, createdAt: new Date(), ...args.data }; db.requests.push(r); return r;
      }
      if (action === 'updateMany') {
        const rows = db.requests.filter((r) => match(r, args.where));
        for (const r of rows) for (const [k, v] of Object.entries(args.data)) r[k] = v && typeof v === 'object' && 'increment' in v ? r[k] + v.increment : v;
        return { count: rows.length };
      }
      if (action === 'update') { const r = db.requests.find((x) => x.id === args.where.id); Object.assign(r, args.data); return r; }
    }
    if (model === 'AccountVerification') {
      if (action === 'findFirst') return grant ? { id: 'grant-1' } : null;
      if (action === 'updateMany') return { count: 1 };
    }
    if (model === 'Product') {
      if (action === 'groupBy') {
        const g = new Map();
        db.products.filter((p) => match(p, args.where)).forEach((p) => { const k = `${p.status}|${p.moderationStatus || 'APPROVED'}`; g.set(k, (g.get(k) || 0) + 1); });
        return [...g].map(([k, n]) => ({ status: k.split('|')[0], moderationStatus: k.split('|')[1], _count: { _all: n } }));
      }
      if (action === 'findMany') return db.products.filter((p) => match(p, args.where)).map(({ id }) => ({ id }));
      if (action === 'count') return db.products.filter((p) => match(p, args.where)).length;
      if (action === 'updateMany') { const rows = db.products.filter((p) => match(p, args.where)); rows.forEach((p) => Object.assign(p, args.data)); return { count: rows.length }; }
    }
    if (['Order', 'EscrowLedger', 'Dispute', 'SupplierPayout', 'Shipment', 'Quotation', 'SupportTicket'].includes(model) && action === 'count') return counts[model] || 0;
    if (model === 'Order' && action === 'groupBy') return counts.Order ? [{ orderStatus: 'PROCESSING', _count: { _all: counts.Order } }] : [];
    if (model === 'EscrowLedger' && action === 'aggregate') return { _count: { _all: counts.EscrowLedger || 0 }, _sum: { amountHeld: counts.EscrowLedger ? 5000 : null, payoutAmount: counts.EscrowLedger ? 4800 : null } };
    if (model === 'SupplierPayout' && action === 'aggregate') return { _count: { _all: counts.SupplierPayout || 0 }, _sum: { amount: null } };
    if (model === 'SupplierDeletionRequest' && action === 'count') return db.requests.filter((r) => match(r, args.where)).length;
    if (model === 'SupplierDeletionRequest' && action === 'groupBy') {
      const g = {}; db.requests.forEach((r) => { g[r.status] = (g[r.status] || 0) + 1; });
      return Object.entries(g).map(([status, n]) => ({ status, _count: { _all: n } }));
    }
    if (model === 'User') {
      if (action === 'findUnique') {
        if (args.where.id === 'adm-1') return { ...ADMIN, name: 'Asha Admin', passwordHash: ADMIN_HASH, isActive: db.adminActive, status: 'Active' };
        return { id: 'sup-1', email: 's@x.co', name: 'Ramu', company: 'Ramu Interprises', role: 'SUPPLIER', status: db.userStatus };
      }
      if (action === 'findMany') return [{ id: 'adm-1' }];
      if (action === 'update') { if (failClose) throw new Error('database unavailable'); db.closed = true; db.userStatus = 'DEACTIVATED'; return {}; }
    }
    if (model === 'AuditLog' && action === 'create') { db.audit.push(args.data.action); return {}; }
    if (model === 'Notification' && action === 'create') { db.notifications.push(args.data.title); return {}; }
    if (model === 'PaymentMethod' && action === 'findMany') return [];
    if (action === 'deleteMany' || action === 'updateMany') return { count: 0 };
    return null;
  };
  t.after(() => { stub = null; });
  return db;
}

describe('Supplier deletion requests: supplier side', () => {
  it('suppliers can no longer delete directly; buyers are unaffected by this rule', async () => {
    await assert.rejects(deleteOwnAccount('sup-1', 'SUPPLIER', { grant: 'g', confirmation: 'DELETE' }), (e) => e.errorCode === 'USE_DELETION_REQUEST' && e.statusCode === 403);
  });

  it('creates one request after the emailed-code authorisation; a second active request is refused', async (t) => {
    const db = makeDb(t);
    const req = await deletion.createSupplierRequest(SUPPLIER, { grant: 'g', confirmation: 'DELETE', reason: 'Closing business' });
    assert.equal(req.status, 'PENDING');
    assert.equal(db.requests[0].activeKey, 'sup-1');
    assert.equal(db.requests[0].reason, 'Closing business');
    assert.ok(db.audit.includes('SUPPLIER_DELETION_REQUESTED'));
    await assert.rejects(deletion.createSupplierRequest(SUPPLIER, { grant: 'g', confirmation: 'DELETE' }), (e) => e.errorCode === 'REQUEST_ALREADY_OPEN');
  });

  it('refuses without DELETE, without a valid code, or for a non-supplier', async (t) => {
    makeDb(t, { grant: false });
    await assert.rejects(deletion.createSupplierRequest(SUPPLIER, { grant: 'g', confirmation: 'delete' }), (e) => e.errorCode === 'CONFIRMATION_REQUIRED');
    await assert.rejects(deletion.createSupplierRequest(SUPPLIER, { grant: 'g', confirmation: 'DELETE' }), (e) => e.errorCode === 'GRANT_INVALID');
    await assert.rejects(deletion.createSupplierRequest({ id: 'b1', role: 'BUYER' }, { grant: 'g', confirmation: 'DELETE' }), (e) => e.statusCode === 403);
  });

  it('before the database update, the feature says it is not available (no crash)', async (t) => {
    t.after(() => { stub = null; });
    stub = async (q) => { if (q.model === 'SupplierDeletionRequest') { const e = new Error('missing'); e.code = 'P2021'; throw e; } return q.action === 'count' ? 0 : null; };
    await assert.rejects(deletion.getSupplierRequest(SUPPLIER), (e) => e.errorCode === 'DELETION_REQUESTS_NOT_READY' && e.statusCode === 503);
    assert.deepEqual(await deletion.processDueDeletions(), { processed: 0 });
  });
});

describe('Supplier deletion requests: Super Admin decisions', () => {
  const pending = () => [{ id: 'req-1', supplierId: 'sup-1', activeKey: 'sup-1', status: 'PENDING', createdAt: new Date() }];

  it('approve needs the admin password and no open obligations; it hides listings and starts the grace period', async (t) => {
    const db = makeDb(t, { requests: pending() });
    await assert.rejects(deletion.decideRequest({ admin: ADMIN, id: 'req-1', action: 'APPROVE', note: 'All obligations cleared.', adminPassword: 'wrong' }), (e) => e.errorCode === 'REAUTH_FAILED');
    await deletion.decideRequest({ admin: ADMIN, id: 'req-1', action: 'APPROVE', note: 'All obligations cleared.', adminPassword: 'Admin#Pass1' });
    const r = db.requests[0];
    assert.equal(r.status, 'APPROVED');
    const days = Math.round((new Date(r.graceEndsAt) - Date.now()) / 86400000);
    assert.equal(days, 30);
    assert.deepEqual(r.hiddenProductIds, ['p1'], 'only listings that were live are hidden (and later restorable)');
    assert.equal(db.products.find((p) => p.id === 'p1').status, 'Inactive');
    assert.ok(db.notifications.includes('Account deletion approved'));
  });

  it('approve is refused while obligations are open; hold and reject need a reason', async (t) => {
    const db = makeDb(t, { requests: pending(), counts: { Order: 2 } });
    await assert.rejects(deletion.decideRequest({ admin: ADMIN, id: 'req-1', action: 'APPROVE', note: 'All obligations cleared.', adminPassword: 'Admin#Pass1' }), (e) => e.errorCode === 'HAS_OBLIGATIONS');
    await assert.rejects(deletion.decideRequest({ admin: ADMIN, id: 'req-1', action: 'HOLD', note: '' }), (e) => e.errorCode === 'REASON_REQUIRED');
    await deletion.decideRequest({ admin: ADMIN, id: 'req-1', action: 'HOLD', note: 'Finish 2 open orders first.' });
    assert.equal(db.requests[0].status, 'ON_HOLD');
    await deletion.decideRequest({ admin: ADMIN, id: 'req-1', action: 'REJECT', note: 'Account under investigation.' });
    assert.equal(db.requests[0].status, 'REJECTED');
    assert.equal(db.requests[0].activeKey, null, 'a new request is possible after rejection');
    await assert.rejects(deletion.decideRequest({ admin: ADMIN, id: 'req-1', action: 'APPROVE', note: 'All obligations cleared.', adminPassword: 'Admin#Pass1' }), (e) => e.errorCode === 'INVALID_TRANSITION');
  });

  it('approval needs a remark; reject/hold need a meaningful reason; hold can set a next review date', async (t) => {
    const db = makeDb(t, { requests: pending() });
    await assert.rejects(deletion.decideRequest({ admin: ADMIN, id: 'req-1', action: 'APPROVE', note: '', adminPassword: 'Admin#Pass1' }), (e) => e.errorCode === 'REMARK_REQUIRED');
    await assert.rejects(deletion.decideRequest({ admin: ADMIN, id: 'req-1', action: 'REJECT', note: 'too short' }), (e) => e.errorCode === 'REASON_REQUIRED');
    await assert.rejects(deletion.decideRequest({ admin: ADMIN, id: 'req-1', action: 'HOLD', note: 'Waiting for escrow release.', nextReviewAt: '2001-01-01' }), (e) => e.errorCode === 'BAD_REVIEW_DATE');
    const next = new Date(Date.now() + 7 * 86400000).toISOString();
    await deletion.decideRequest({ admin: ADMIN, id: 'req-1', action: 'HOLD', note: 'Waiting for escrow release.', nextReviewAt: next, internalNote: 'Finance to confirm.' });
    const entry = db.requests[0].history.at(-1);
    assert.equal(entry.status, 'ON_HOLD');
    assert.equal(entry.fromStatus, 'PENDING');
    assert.equal(entry.actorName, 'Asha Admin');
    assert.equal(entry.nextReviewAt, next);
    assert.equal(entry.internalNote, 'Finance to confirm.');
  });

  it('a held request can be reopened, and every decision is appended (never overwritten)', async (t) => {
    const db = makeDb(t, { requests: pending() });
    await deletion.decideRequest({ admin: ADMIN, id: 'req-1', action: 'HOLD', note: 'Pending order completion.' });
    await deletion.decideRequest({ admin: ADMIN, id: 'req-1', action: 'REOPEN' });
    assert.equal(db.requests[0].status, 'PENDING');
    assert.deepEqual(db.requests[0].history.map((h) => h.status), ['ON_HOLD', 'PENDING']);
    assert.ok(db.audit.includes('SUPPLIER_DELETION_REOPENED'));
    assert.ok(db.notifications.includes('Account deletion request back in review'));
  });

  it('admin-only notes are never visible to the supplier or sent in notifications', async (t) => {
    const db = makeDb(t, { requests: pending() });
    await deletion.decideRequest({ admin: ADMIN, id: 'req-1', action: 'REJECT', note: 'Open investigation on this account.', internalNote: 'SECRET: fraud team ref 42' });
    const supplierView = await deletion.getSupplierRequest(SUPPLIER);
    assert.equal(JSON.stringify(supplierView).includes('SECRET'), false);
    assert.equal(JSON.stringify(supplierView).includes('Asha Admin'), false);
    const admin = await deletion.getRequestDetail('req-1');
    assert.equal(admin.history.at(-1).internalNote, 'SECRET: fraud team ref 42');
    assert.equal(db.notifications.some((n) => n.includes('SECRET')), false);
  });

  it('open support tickets do not block, but approval needs an explicit acknowledgement', async (t) => {
    const db = makeDb(t, { requests: pending(), counts: { SupportTicket: 1 } });
    const detail = await deletion.getRequestDetail('req-1');
    assert.equal(detail.eligibility.state, 'NEEDS_REVIEW');
    await assert.rejects(deletion.decideRequest({ admin: ADMIN, id: 'req-1', action: 'APPROVE', note: 'Cleared.', adminPassword: 'Admin#Pass1' }), (e) => e.errorCode === 'NEEDS_ACKNOWLEDGEMENT');
    await deletion.decideRequest({ admin: ADMIN, id: 'req-1', action: 'APPROVE', note: 'Cleared.', adminPassword: 'Admin#Pass1', acknowledgeWarnings: true });
    assert.equal(db.requests[0].status, 'APPROVED');
  });

  it('live obligations report: escrow blocks approval and is shown with amounts', async (t) => {
    makeDb(t, { requests: pending(), counts: { EscrowLedger: 1 } });
    const detail = await deletion.getRequestDetail('req-1');
    assert.equal(detail.eligibility.state, 'BLOCKED');
    assert.equal(detail.obligationsReport.payments.escrowHeldCount, 1);
    assert.equal(detail.obligationsReport.payments.pendingSettlementAmount, 4800);
    await assert.rejects(deletion.decideRequest({ admin: ADMIN, id: 'req-1', action: 'APPROVE', note: 'Cleared.', adminPassword: 'Admin#Pass1' }), (e) => e.errorCode === 'HAS_OBLIGATIONS');
  });

  it('an inactive admin or a closed supplier account cannot be decided on', async (t) => {
    const db = makeDb(t, { requests: pending() });
    db.adminActive = false;
    await assert.rejects(deletion.decideRequest({ admin: ADMIN, id: 'req-1', action: 'REJECT', note: 'Not allowed to close yet.' }), (e) => e.statusCode === 403);
    db.adminActive = true;
    db.userStatus = 'DEACTIVATED';
    await assert.rejects(deletion.decideRequest({ admin: ADMIN, id: 'req-1', action: 'REJECT', note: 'Not allowed to close yet.' }), (e) => e.errorCode === 'INCONSISTENT_STATE');
  });

  it('a second decision on an already decided request is refused (no duplicate notice)', async (t) => {
    const db = makeDb(t, { requests: pending() });
    await deletion.decideRequest({ admin: ADMIN, id: 'req-1', action: 'REJECT', note: 'Account under investigation.' });
    await assert.rejects(deletion.decideRequest({ admin: ADMIN, id: 'req-1', action: 'REJECT', note: 'Account under investigation.' }), (e) => e.errorCode === 'INVALID_TRANSITION');
    assert.equal(db.notifications.filter((n) => n === 'Account deletion request rejected').length, 1);
  });

  it('list: status counts and pagination come from the database', async (t) => {
    makeDb(t, { requests: [...pending(), { id: 'req-2', supplierId: 'sup-2', status: 'REJECTED', createdAt: new Date() }] });
    const list = await deletion.listRequests({ status: 'ALL' });
    assert.equal(list.summary.total, 2);
    assert.equal(list.summary.pending, 1);
    assert.equal(list.summary.rejected, 1);
    assert.equal(list.pagination.total, 2);
    assert.match(list.items[0].reference, /^DR-[0-9A-Z]{1,8}$/);
  });

  it('during the grace period the supplier cannot start new trade', async (t) => {
    makeDb(t, { requests: [{ id: 'req-1', supplierId: 'sup-1', activeKey: 'sup-1', status: 'APPROVED', graceEndsAt: new Date(Date.now() + 86400000), createdAt: new Date() }] });
    await assert.rejects(deletion.assertSupplierCanTrade('sup-1'), (e) => e.errorCode === 'ACCOUNT_CLOSING');
    await deletion.assertSupplierCanTrade('sup-2'); // other suppliers unaffected
  });

  it('deleted products are history only: not counted as current listings, active or pending', async (t) => {
    makeDb(t, { requests: pending(), products: [
      { id: 'p1', supplierId: 'sup-1', status: 'Deleted', moderationStatus: 'APPROVED' }, { id: 'p2', supplierId: 'sup-1', status: 'Deleted', moderationStatus: 'APPROVED' },
      { id: 'p3', supplierId: 'sup-1', status: 'Active', moderationStatus: 'APPROVED' }, { id: 'p4', supplierId: 'sup-1', status: 'Hidden', moderationStatus: 'PENDING' },
      { id: 'x1', supplierId: 'other', status: 'Active', moderationStatus: 'APPROVED' },
    ] });
    const { obligationsReport: r } = await deletion.getRequestDetail('req-1');
    assert.deepEqual(r.products, { total: 2, active: 1, pendingModeration: 1, hidden: 1, deleted: 2, toDeactivate: 1 });
  });

  it('with every product deleted, an open order still blocks approval', async (t) => {
    makeDb(t, { requests: pending(), counts: { Order: 1 }, products: [{ id: 'p1', supplierId: 'sup-1', status: 'Deleted', moderationStatus: 'APPROVED' }] });
    const detail = await deletion.getRequestDetail('req-1');
    assert.equal(detail.obligationsReport.products.total, 0);
    assert.equal(detail.eligibility.state, 'BLOCKED');
    await assert.rejects(deletion.decideRequest({ admin: ADMIN, id: 'req-1', action: 'APPROVE', note: 'Cleared.', adminPassword: 'Admin#Pass1' }), (e) => e.errorCode === 'HAS_OBLIGATIONS');
  });

  it('a recheck reads the database again (a product removed since the last check is reflected)', async (t) => {
    const db = makeDb(t, { requests: pending(), products: [{ id: 'p1', supplierId: 'sup-1', status: 'Active', moderationStatus: 'APPROVED' }] });
    assert.equal((await deletion.getRequestDetail('req-1')).obligationsReport.products.active, 1);
    db.products[0].status = 'Deleted';
    const again = await deletion.getRequestDetail('req-1');
    assert.equal(again.obligationsReport.products.active, 0);
    assert.equal(again.obligationsReport.products.deleted, 1);
  });

  it('only a Super Admin can decide', async (t) => {
    makeDb(t, { requests: pending() });
    await assert.rejects(deletion.decideRequest({ admin: { id: 'x', role: 'ADMIN' }, id: 'req-1', action: 'REJECT', note: 'No reason given here.' }), (e) => e.statusCode === 403);
  });

  it('the supplier can cancel during the grace period and hidden listings come back', async (t) => {
    const db = makeDb(t, { requests: [{ id: 'req-1', supplierId: 'sup-1', activeKey: 'sup-1', status: 'APPROVED', hiddenProductIds: ['p1'], createdAt: new Date() }], products: [{ id: 'p1', supplierId: 'sup-1', status: 'Inactive' }] });
    await deletion.cancelSupplierRequest(SUPPLIER);
    assert.equal(db.requests[0].status, 'CANCELLED');
    assert.equal(db.requests[0].activeKey, null);
    assert.equal(db.products[0].status, 'Active');
  });
});

describe('Supplier deletion requests: final deletion worker', () => {
  const due = (extra = {}) => [{ id: 'req-1', supplierId: 'sup-1', activeKey: 'sup-1', status: 'APPROVED', graceEndsAt: new Date(Date.now() - 1000), createdAt: new Date(), ...extra }];

  it('re-checks obligations: anything open puts the request on hold and closes nothing', async (t) => {
    const db = makeDb(t, { requests: due(), counts: { Shipment: 1 } });
    const out = await deletion.processDueDeletions();
    assert.equal(out.results[0].status, 'ON_HOLD');
    assert.equal(db.requests[0].status, 'ON_HOLD');
    assert.equal(db.closed, false);
  });

  it('closes the account when clear, marks it completed, and a second run does nothing (idempotent)', async (t) => {
    const db = makeDb(t, { requests: due() });
    await deletion.processDueDeletions();
    assert.equal(db.requests[0].status, 'COMPLETED');
    assert.equal(db.requests[0].activeKey, null);
    assert.equal(db.closed, true);
    assert.ok(db.audit.includes('SUPPLIER_DELETION_COMPLETED'));
    assert.deepEqual(await deletion.processDueDeletions(), { processed: 0, results: [] });
  });

  it('does not touch requests still in their grace period', async (t) => {
    const db = makeDb(t, { requests: due({ graceEndsAt: new Date(Date.now() + 86400000) }) });
    await deletion.processDueDeletions();
    assert.equal(db.requests[0].status, 'APPROVED');
  });

  it('a failure is retried, then marked FAILED after the last attempt', async (t) => {
    const db = makeDb(t, { requests: due(), failClose: true });
    await deletion.processDueDeletions();
    assert.equal(db.requests[0].status, 'APPROVED', 'retry next run');
    assert.ok(db.requests[0].lastError);
    db.requests[0].attempts = deletion.MAX_ATTEMPTS - 1;
    await deletion.processDueDeletions();
    assert.equal(db.requests[0].status, 'FAILED');
  });
});
