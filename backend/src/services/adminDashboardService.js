import prisma from '../config/db.js';
import { TERMINAL_STATUSES } from './transport/shipmentStateMachine.js';

/*
 * Super Admin Command Center: every figure is read from the database here (no estimates, no placeholders).
 *
 * Definitions (shown in the UI tooltips):
 *   paidOrderValue      total of orders PLACED in the period whose payment status is PAID (gross order value, not revenue)
 *   commissionEarned    platform commission on escrow entries RELEASED in the period (recognised take-rate)
 *   fundsReleased       supplier payouts released from escrow in the period
 *   escrowHeld          money currently held in escrow (HELD or frozen for a dispute), regardless of period
 *   orders (period)     orders placed in the period; completed / cancelled / refunded = those orders' current state
 *   change %            against the previous period of the same length; null when the previous period is 0
 * Days are counted in India time (UTC+05:30).
 */

const IST_MS = 330 * 60 * 1000;
const DAY_MS = 86400000;
const OPEN_DISPUTES = ['OPEN', 'UNDER_REVIEW'];
const ESCROW_HELD = ['HELD', 'FROZEN_DISPUTED'];
const LIVE_TRACKING_MINUTES = 30;

const istDayStart = (date) => {
  const shifted = new Date(date.getTime() + IST_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - IST_MS);
};
const istKey = (date) => new Date(new Date(date).getTime() + IST_MS).toISOString().slice(0, 10);
const money = (v) => Math.round(Number(v || 0) * 100) / 100;
export const percentChange = (current, previous) => (previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null);

/** Period window: 7d / 30d / 90d ending today, or a custom from/to (YYYY-MM-DD, at most 366 days). */
export function resolveRange({ range = '30d', from, to } = {}, now = new Date()) {
  const todayStart = istDayStart(now);
  if (range === 'custom') {
    const parse = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? new Date(`${s}T00:00:00+05:30`) : null);
    const start = parse(from);
    const endDay = parse(to);
    if (!start || !endDay || endDay < start) {
      const error = new Error('Choose a valid custom date range (from and to).');
      error.statusCode = 400;
      throw error;
    }
    const days = Math.round((endDay - start) / DAY_MS) + 1;
    if (days > 366) {
      const error = new Error('A custom range can be at most one year.');
      error.statusCode = 400;
      throw error;
    }
    return { key: 'custom', start, end: new Date(endDay.getTime() + DAY_MS), days };
  }
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
  return { key: `${days}d`, start: new Date(todayStart.getTime() - (days - 1) * DAY_MS), end: new Date(todayStart.getTime() + DAY_MS), days };
}

async function safeCount(run) {
  try { return await run(); } catch (error) { if (error?.code === 'P2021') return 0; throw error; }
}

/** Audit log -> a short, safe activity line (no personal details, no raw payloads). */
const ACTIVITY = {
  BUYER_REGISTERED: ['New buyer registered', 'user'],
  SUPPLIER_REGISTRATION: ['New supplier registered', 'user'],
  KYC_REVIEW: ['Supplier KYC reviewed', 'kyc'],
  SUPPLIER_KYC_REVIEW: ['Supplier KYC reviewed', 'kyc'],
  PRODUCT_MODERATE: ['Product moderated', 'product'],
  SUPPLIER_DELETION_REQUESTED: ['Account deletion requested', 'deletion'],
  SUPPLIER_DELETION_APPROVED: ['Account deletion approved', 'deletion'],
  SUPPLIER_DELETION_REJECTED: ['Account deletion rejected', 'deletion'],
  SUPPLIER_DELETION_ON_HOLD: ['Account deletion put on hold', 'deletion'],
  SUPPLIER_DELETION_COMPLETED: ['Supplier account closed', 'deletion'],
  USER_STATUS_CHANGE: ['User status changed', 'user'],
  ACCOUNT_DELETE_BY_ADMIN: ['Account closed by admin', 'user'],
  COMMISSION_UPDATE: ['Commission policy updated', 'settings'],
};
const LINKS = { user: '/super-admin/users', kyc: '/super-admin/suppliers', product: '/super-admin/products', deletion: '/super-admin/deletion-requests', settings: '/super-admin/settings', order: '/super-admin/orders' };

export async function getCommandCenter(query = {}, now = new Date()) {
  const range = resolveRange(query, now);
  const prevStart = new Date(range.start.getTime() - (range.end - range.start));
  const liveSince = new Date(now.getTime() - LIVE_TRACKING_MINUTES * 60000);

  const [
    usersByRole, verifiedSuppliers, pendingKyc, productsByState, categories,
    rfqTotal, rfqOpen, quoteTotal, ordersByStatus, openDisputes, openTickets,
    escrowHeld, escrowReleasedAll, escrowRefundedAll, pendingPayouts,
    periodOrders, periodReleases, periodUsers, periodProducts, periodRfqs, periodQuotes,
    deletionRequests, unverifiedVehicles, pendingTransporters,
    activeShipments, delayedShipments, shipmentsWithDriver, liveTracked,
    recentOrders, auditRows, topCategories,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.user.count({ where: { role: 'SUPPLIER', isVerified: true } }),
    prisma.user.count({ where: { role: 'SUPPLIER', kycStatus: 'PENDING' } }),
    prisma.product.groupBy({ by: ['status', 'moderationStatus'], _count: { _all: true } }),
    prisma.category.count(),
    prisma.rfq.count(),
    prisma.rfq.count({ where: { status: 'OPEN' } }),
    prisma.quotation.count(),
    prisma.order.groupBy({ by: ['orderStatus'], _count: { _all: true } }),
    prisma.dispute.count({ where: { status: { in: OPEN_DISPUTES } } }),
    prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    prisma.escrowLedger.aggregate({ where: { status: { in: ESCROW_HELD } }, _sum: { amountHeld: true }, _count: { _all: true } }),
    prisma.escrowLedger.aggregate({ where: { status: 'RELEASED' }, _sum: { payoutAmount: true, commissionFee: true } }),
    prisma.escrowLedger.aggregate({ where: { status: 'REFUNDED' }, _sum: { amountHeld: true }, _count: { _all: true } }),
    prisma.supplierPayout.aggregate({ where: { status: 'PENDING' }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.order.findMany({ where: { createdAt: { gte: prevStart, lt: range.end } }, select: { createdAt: true, total: true, paymentStatus: true, orderStatus: true, userId: true } }),
    prisma.escrowLedger.findMany({ where: { status: 'RELEASED', releasedAt: { gte: prevStart, lt: range.end } }, select: { releasedAt: true, commissionFee: true, payoutAmount: true } }),
    prisma.user.findMany({ where: { createdAt: { gte: prevStart, lt: range.end }, role: { in: ['BUYER', 'SUPPLIER'] } }, select: { createdAt: true, role: true } }),
    prisma.product.findMany({ where: { createdAt: { gte: prevStart, lt: range.end }, status: { not: 'Deleted' } }, select: { createdAt: true } }),
    prisma.rfq.findMany({ where: { createdAt: { gte: prevStart, lt: range.end } }, select: { createdAt: true } }),
    prisma.quotation.findMany({ where: { createdAt: { gte: prevStart, lt: range.end } }, select: { createdAt: true } }),
    safeCount(() => prisma.supplierDeletionRequest.count({ where: { status: { in: ['PENDING', 'ON_HOLD', 'FAILED'] } } })),
    prisma.transportVehicle.count({ where: { isVerified: false } }),
    prisma.transportCompany.count({ where: { verificationStatus: 'PENDING' } }),
    prisma.shipment.count({ where: { status: { notIn: TERMINAL_STATUSES } } }),
    prisma.shipment.count({ where: { status: { notIn: TERMINAL_STATUSES }, estimatedDeliveryAt: { lt: now } } }),
    prisma.shipment.count({ where: { status: { notIn: TERMINAL_STATUSES }, driverId: { not: null } } }),
    prisma.shipmentLocation.groupBy({ by: ['shipmentId'], where: { recordedAt: { gte: liveSince }, shipment: { status: { notIn: TERMINAL_STATUSES } } } }),
    prisma.order.findMany({ take: 6, orderBy: { createdAt: 'desc' }, select: { id: true, orderNumber: true, buyerCompany: true, buyerName: true, total: true, orderStatus: true, paymentStatus: true, createdAt: true } }),
    prisma.auditLog.findMany({ take: 12, orderBy: { createdAt: 'desc' }, select: { id: true, action: true, actorRole: true, result: true, createdAt: true } }),
    prisma.category.findMany({ take: 5, select: { name: true, slug: true, _count: { select: { products: true } } }, orderBy: { products: { _count: 'desc' } } }),
  ]);

  /* ---- people, products, orders by state ---- */
  const role = Object.fromEntries(usersByRole.map((r) => [r.role, r._count._all]));
  const users = { total: Object.values(role).reduce((s, n) => s + n, 0), buyers: role.BUYER || 0, suppliers: role.SUPPLIER || 0, verifiedSuppliers, pendingKyc };
  const sumProducts = (test) => productsByState.filter(test).reduce((s, r) => s + r._count._all, 0);
  const products = {
    total: sumProducts((r) => r.status !== 'Deleted'),
    active: sumProducts((r) => r.status === 'Active' && r.moderationStatus === 'APPROVED'),
    pendingModeration: sumProducts((r) => r.status !== 'Deleted' && r.moderationStatus === 'PENDING'),
    hidden: sumProducts((r) => r.status !== 'Deleted' && r.status !== 'Active'),
    archived: sumProducts((r) => r.status === 'Deleted'),
  };
  const os = Object.fromEntries(ordersByStatus.map((r) => [r.orderStatus, r._count._all]));
  const orderStages = {
    total: Object.values(os).reduce((s, n) => s + n, 0),
    awaitingFulfilment: (os.ORDER_PLACED || 0) + (os.ORDER_CONFIRMED || 0),
    processing: (os.PROCESSING || 0) + (os.PACKED || 0),
    shipped: (os.SHIPPED || 0) + (os.OUT_FOR_DELIVERY || 0),
    delivered: os.DELIVERED || 0,
    cancelled: os.CANCELLED || 0,
    refunded: os.REFUNDED || 0,
    disputed: openDisputes,
  };
  orderStages.active = orderStages.awaitingFulfilment + orderStages.processing + orderStages.shipped;

  /* ---- period metrics (current vs previous window) ---- */
  const inCurrent = (d) => d >= range.start && d < range.end;
  const split = (rows, dateOf) => rows.reduce((acc, r) => { (inCurrent(new Date(dateOf(r))) ? acc.cur : acc.prev).push(r); return acc; }, { cur: [], prev: [] });
  const o = split(periodOrders, (r) => r.createdAt);
  const rel = split(periodReleases, (r) => r.releasedAt);
  const u = split(periodUsers, (r) => r.createdAt);
  const p = split(periodProducts, (r) => r.createdAt);
  const rf = split(periodRfqs, (r) => r.createdAt);
  const qt = split(periodQuotes, (r) => r.createdAt);
  const orderFigures = (rows) => ({
    orders: rows.length,
    paidOrderValue: money(rows.filter((r) => r.paymentStatus === 'PAID').reduce((s, r) => s + Number(r.total || 0), 0)),
    completed: rows.filter((r) => r.orderStatus === 'DELIVERED').length,
    cancelled: rows.filter((r) => r.orderStatus === 'CANCELLED').length,
    refunded: rows.filter((r) => r.orderStatus === 'REFUNDED').length,
    orderingBuyers: new Set(rows.map((r) => r.userId).filter(Boolean)).size,
  });
  const releaseFigures = (rows) => ({
    commissionEarned: money(rows.reduce((s, r) => s + Number(r.commissionFee || 0), 0)),
    fundsReleased: money(rows.reduce((s, r) => s + Number(r.payoutAmount || 0), 0)),
  });
  const growthFigures = (users, products, rfqs, quotes) => ({
    newBuyers: users.filter((x) => x.role === 'BUYER').length,
    newSuppliers: users.filter((x) => x.role === 'SUPPLIER').length,
    newProducts: products.length,
    newRfqs: rfqs.length,
    newQuotations: quotes.length,
  });
  const current = { ...orderFigures(o.cur), ...releaseFigures(rel.cur), ...growthFigures(u.cur, p.cur, rf.cur, qt.cur) };
  const previous = { ...orderFigures(o.prev), ...releaseFigures(rel.prev), ...growthFigures(u.prev, p.prev, rf.prev, qt.prev) };
  const change = Object.fromEntries(Object.keys(current).map((k) => [k, percentChange(current[k], previous[k])]));

  /* ---- daily trend for the current window (every day present) ---- */
  const days = new Map();
  for (let t = range.start.getTime(); t < range.end.getTime(); t += DAY_MS) days.set(istKey(new Date(t)), { date: istKey(new Date(t)), paidOrderValue: 0, orders: 0, commissionEarned: 0 });
  for (const r of o.cur) { const d = days.get(istKey(r.createdAt)); if (d) { d.orders += 1; if (r.paymentStatus === 'PAID') d.paidOrderValue += Number(r.total || 0); } }
  for (const r of rel.cur) { const d = days.get(istKey(r.releasedAt)); if (d) d.commissionEarned += Number(r.commissionFee || 0); }
  const trend = [...days.values()].map((d) => ({ ...d, paidOrderValue: money(d.paidOrderValue), commissionEarned: money(d.commissionEarned) }));

  /* ---- activity (safe labels only) ---- */
  const activity = auditRows.map((a) => {
    const [label, kind] = ACTIVITY[a.action] || [String(a.action || 'Activity').replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()), 'other'];
    return { id: a.id, label, kind, actorRole: a.actorRole, result: a.result, at: a.createdAt, link: LINKS[kind] || '/super-admin/audit' };
  });

  const finance = {
    paidOrderValue: current.paidOrderValue,
    commissionEarned: current.commissionEarned,
    fundsReleased: current.fundsReleased,
    escrowHeld: money(escrowHeld._sum.amountHeld),
    escrowHeldCount: escrowHeld._count._all,
    releasedAllTime: money(escrowReleasedAll._sum.payoutAmount),
    commissionAllTime: money(escrowReleasedAll._sum.commissionFee),
    refundedAllTime: money(escrowRefundedAll._sum.amountHeld),
    refundedCount: escrowRefundedAll._count._all,
    pendingPayouts: money(pendingPayouts._sum.amount),
    pendingPayoutCount: pendingPayouts._count._all,
  };

  const actions = {
    pendingKyc,
    pendingProductModeration: products.pendingModeration,
    deletionRequests,
    openDisputes,
    openTickets,
    unverifiedVehicles,
    pendingTransporters,
    delayedShipments,
  };

  return {
    generatedAt: now.toISOString(),
    range: { key: range.key, start: range.start.toISOString(), end: range.end.toISOString(), days: range.days },
    period: { current, previous, change },
    finance,
    users,
    products,
    categories,
    rfqs: { total: rfqTotal, open: rfqOpen, quotations: quoteTotal },
    orders: orderStages,
    logistics: { activeShipments, delayedShipments, withDriver: shipmentsWithDriver, liveTracked: liveTracked.length, liveWindowMinutes: LIVE_TRACKING_MINUTES, unverifiedVehicles, pendingTransporters },
    actions,
    trend,
    activity,
    recentOrders: recentOrders.map((r) => ({ ...r, total: Number(r.total || 0) })),
    topCategories: topCategories.map((c) => ({ name: c.name, slug: c.slug, productCount: c._count.products })),
  };
}
