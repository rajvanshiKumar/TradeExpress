import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { consumeAccountGrant } from './accountSecurityService.js';
import { removePaymentMethod } from './paymentMethodService.js';
import { sendAccountSecurityEmail } from './emailService.js';
import { maskEmail } from './accountService.js';

/*
 * Self-service account deletion (Buyers and Suppliers; never the Super Admin).
 *
 * Policy:
 * - Blocked while the account has marketplace obligations: active orders, escrow held, open disputes,
 *   pending supplier payouts.
 * - Personal data is removed (name, email, phone, photo, Google link, address book, saved cards, cart).
 * - Business and tax records needed for legal retention are kept: past orders and invoices are not
 *   changed, and the account row stays (deactivated) so those records remain consistent.
 * - Supplier products are taken off the marketplace; open RFQs and sent quotations are closed.
 * - Every login session is ended.
 */

const FINISHED_ORDER_STATUSES = ['DELIVERED', 'CANCELLED', 'REFUNDED'];
const OPEN_DISPUTE_STATUSES = ['OPEN', 'UNDER_REVIEW'];
const HELD_ESCROW_STATUSES = ['HELD', 'FROZEN_DISPUTED'];

function fail(message, statusCode = 400, code = 'ACCOUNT_DELETE_ERROR') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = code;
  return error;
}

/** What still has to be finished before the account can be deleted. */
export async function getDeletionBlockers(userId, role, db = prisma) {
  const isSupplier = role === 'SUPPLIER';
  const orderOwner = isSupplier ? { supplierId: userId } : { userId };

  const [activeOrders, heldEscrow, openDisputes, pendingPayouts] = await Promise.all([
    db.order.count({ where: { ...orderOwner, orderStatus: { notIn: FINISHED_ORDER_STATUSES } } }),
    db.escrowLedger.count({ where: { status: { in: HELD_ESCROW_STATUSES }, order: orderOwner } }),
    db.dispute.count({ where: { status: { in: OPEN_DISPUTE_STATUSES }, ...(isSupplier ? { order: { supplierId: userId } } : { buyerId: userId }) } }),
    isSupplier ? db.supplierPayout.count({ where: { supplierId: userId, status: 'PENDING' } }) : Promise.resolve(0),
  ]);

  const blockers = [];
  if (activeOrders) blockers.push({ type: 'ACTIVE_ORDERS', count: activeOrders, message: `${activeOrders} order${activeOrders === 1 ? ' is' : 's are'} still in progress. Orders must be delivered, cancelled or refunded first.` });
  if (heldEscrow) blockers.push({ type: 'ESCROW_HELD', count: heldEscrow, message: `${heldEscrow} payment${heldEscrow === 1 ? ' is' : 's are'} still held in escrow.` });
  if (openDisputes) blockers.push({ type: 'OPEN_DISPUTES', count: openDisputes, message: `${openDisputes} trade dispute${openDisputes === 1 ? ' is' : 's are'} still open.` });
  if (pendingPayouts) blockers.push({ type: 'PENDING_PAYOUTS', count: pendingPayouts, message: `${pendingPayouts} supplier payout${pendingPayouts === 1 ? ' is' : 's are'} still pending.` });
  return blockers;
}

export async function getDeletionStatus(userId, role) {
  if (!['BUYER', 'SUPPLIER'].includes(role)) {
    return { canDelete: false, blockers: [{ type: 'ROLE', message: 'This account type cannot be deleted from Account Settings. Platform administrator accounts are closed through an approved administrative process.' }] };
  }
  const blockers = await getDeletionBlockers(userId, role);
  return { canDelete: blockers.length === 0, blockers };
}

/**
 * Closes an account: removes personal data, keeps legally required records, ends every session.
 * `authorize(tx)` runs first inside the same transaction (e.g. consuming the user's email-code authorization).
 */
async function closeAccount({ userId, role, statusReason, authorize }) {
  // Saved cards are removed at the payment gateway first (outside the database transaction)
  const methods = await prisma.paymentMethod.findMany({ where: { userId }, select: { id: true } });
  for (const method of methods) {
    await removePaymentMethod(userId, method.id).catch(() => {
      // A card already gone at the gateway, or an unreachable gateway: the row is removed below either way
    });
  }

  const anonymousEmail = `deleted+${userId.replace(/-/g, '')}@deleted.tradeexpress.invalid`;
  const unusablePassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

  await prisma.$transaction(async (tx) => {
    if (authorize) await authorize(tx);
    // Re-checked inside the transaction so nothing started in the meantime is left behind
    const blockers = await getDeletionBlockers(userId, role, tx);
    if (blockers.length) throw fail(blockers[0].message, 409, 'ACCOUNT_HAS_OBLIGATIONS');

    await tx.address.deleteMany({ where: { userId } });
    await tx.paymentMethod.deleteMany({ where: { userId } });
    await tx.cart.deleteMany({ where: { userId } });
    await tx.accountVerification.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: new Date() } });
    if (role === 'SUPPLIER') {
      await tx.product.updateMany({ where: { supplierId: userId }, data: { status: 'Inactive' } });
      await tx.quotation.updateMany({ where: { supplierId: userId, status: { in: ['DRAFT', 'SENT', 'VIEWED', 'COUNTERED'] } }, data: { status: 'WITHDRAWN' } });
    } else {
      await tx.rfq.updateMany({ where: { buyerId: userId, status: 'OPEN' }, data: { status: 'CLOSED' } });
    }

    await tx.supplierDocument.deleteMany({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        email: anonymousEmail,
        name: 'Deleted user',
        phone: null,
        isPhoneVerified: false,
        googleId: null,
        avatarUrl: null,
        razorpayCustomerId: null,
        passwordHash: unusablePassword,
        isActive: false,
        status: 'DEACTIVATED',
        statusReason,
        sessionsValidAfter: new Date(Math.ceil(Date.now() / 1000) * 1000),
      },
    });
  }, { maxWait: 10000, timeout: 30000 });
  return { anonymousEmail };
}

const RETENTION_NOTE = 'Records that we must keep by law, such as past orders and tax invoices, are retained.';

/** Deletes (deactivates and anonymises) the signed-in account after email verification and confirmation. */
export async function deleteOwnAccount(userId, role, { grant, confirmation }) {
  if (!['BUYER', 'SUPPLIER'].includes(role)) throw fail('This account type cannot be deleted from Account Settings.', 403, 'ROLE_NOT_ALLOWED');
  if (String(confirmation || '').trim() !== 'DELETE') throw fail('Type DELETE to confirm that you want to delete your account.', 400, 'CONFIRMATION_REQUIRED');

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, role: true } });
  if (!user) throw fail('Account not found.', 404, 'NOT_FOUND');

  const { anonymousEmail } = await closeAccount({
    userId,
    role,
    statusReason: 'Account deleted by the account holder.',
    authorize: (tx) => consumeAccountGrant(tx, userId, 'ACCOUNT_DELETE', grant),
  });

  await prisma.auditLog.create({
    data: { actorId: userId, actorEmail: anonymousEmail, actorRole: role, action: 'ACCOUNT_DELETE', resource: 'ACCOUNT', targetId: userId, details: { email: maskEmail(user.email) }, result: 'SUCCESS' },
  }).catch(() => {});
  sendAccountSecurityEmail({
    email: user.email,
    name: user.name,
    subject: 'Your TradeExpress account has been deleted',
    message: `Your TradeExpress account has been deleted and you have been signed out everywhere. ${RETENTION_NOTE}`,
  });
  return { deleted: true };
}

export const ADMIN_DELETION_REASONS = {
  POLICY_VIOLATION: 'Policy violation',
  FRAUDULENT_ACCOUNT: 'Fraudulent account',
  USER_REQUESTED: 'User requested account deletion',
  DUPLICATE_ACCOUNT: 'Duplicate account',
};

/**
 * Super Admin deletes a Buyer or Supplier account. Requires a listed reason, typing DELETE and re-entering the
 * Super Admin's own password. Administrator accounts can never be deleted through this workflow.
 */
export async function adminDeleteAccount({ admin, targetUserId, reason, note, confirmation, adminPassword, ipAddress, userAgent }) {
  if (admin?.role !== 'SUPER_ADMIN') throw fail('Only a Super Admin can delete accounts.', 403, 'FORBIDDEN');
  if (!ADMIN_DELETION_REASONS[reason]) throw fail('Choose a reason for deleting this account.', 400, 'REASON_REQUIRED');
  if (String(confirmation || '').trim() !== 'DELETE') throw fail('Type DELETE to confirm.', 400, 'CONFIRMATION_REQUIRED');

  // Recent re-authentication: the Super Admin confirms with their own password
  const actor = await prisma.user.findUnique({ where: { id: admin.id }, select: { id: true, email: true, passwordHash: true } });
  if (!adminPassword || !actor || !(await bcrypt.compare(String(adminPassword), actor.passwordHash))) {
    throw fail('Your password is incorrect. Please confirm with your own Super Admin password.', 401, 'REAUTH_FAILED');
  }

  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, email: true, name: true, role: true, status: true } });
  if (!target) throw fail('Account not found.', 404, 'NOT_FOUND');
  if (!['BUYER', 'SUPPLIER'].includes(target.role)) throw fail('Administrator accounts cannot be deleted through this workflow.', 403, 'ROLE_NOT_ALLOWED');
  if (target.status === 'DEACTIVATED') throw fail('This account has already been deleted.', 409, 'ALREADY_DELETED');

  const cleanNote = String(note || '').trim().slice(0, 500);
  await closeAccount({ userId: target.id, role: target.role, statusReason: `Account deleted by TradeExpress: ${ADMIN_DELETION_REASONS[reason]}.` });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id, actorEmail: actor.email, actorRole: 'SUPER_ADMIN', action: 'ACCOUNT_DELETE_BY_ADMIN', resource: 'USERS', targetId: target.id,
      details: { reason, reasonLabel: ADMIN_DELETION_REASONS[reason], note: cleanNote || null, targetEmail: maskEmail(target.email), targetRole: target.role },
      ipAddress: ipAddress || null, userAgent: userAgent || null, result: 'SUCCESS',
    },
  }).catch(() => {});
  sendAccountSecurityEmail({
    email: target.email,
    name: target.name,
    subject: 'Your TradeExpress account has been closed',
    message: `Your TradeExpress account has been closed by TradeExpress and you have been signed out everywhere. ${RETENTION_NOTE} If you believe this is a mistake, please contact TradeExpress support.`,
  });
  return { deleted: true, reason: ADMIN_DELETION_REASONS[reason] };
}
