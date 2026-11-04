import prisma from '../config/db.js';

/**
 * Account preferences that the platform actually applies:
 *   notifications  in-app alert categories (createNotification skips muted ones; account and dispute alerts always on)
 *   email          optional product news consent (transactional and security emails are always sent)
 *   language       language and country, applied on every sign-in
 */

export const NOTIFICATION_CATEGORIES = {
  ORDERS: { label: 'Orders', types: ['ORDER', 'ORDER_UPDATE', 'ACTIVE_ORDERS'] },
  SHIPMENTS: { label: 'Shipments and deliveries', types: ['SHIPMENT'] },
  QUOTES: { label: 'Quotes and RFQs', types: ['QUOTE', 'QUOTATION'] },
  PAYMENTS: { label: 'Payments and payouts', types: ['PAYOUT', 'PENDING_PAYOUTS', 'CARD', 'ESCROW_HELD'] },
  INVENTORY: { label: 'Inventory alerts', types: ['INVENTORY'] },
  SUPPORT: { label: 'Support tickets', types: ['SUPPORT'] },
};

export const LANGUAGES = ['en', 'hi', 'ta', 'te', 'kn', 'ml', 'bn', 'mr'];
export const COUNTRIES = ['India', 'United States', 'United Kingdom', 'United Arab Emirates', 'Canada', 'Singapore', 'Australia', 'Germany'];

export const DEFAULT_PREFERENCES = {
  notifications: Object.fromEntries(Object.keys(NOTIFICATION_CATEGORIES).map((key) => [key, true])),
  email: { productUpdates: false, consentUpdatedAt: null },
  language: { language: 'en', country: 'India' },
};

const TYPE_TO_CATEGORY = Object.fromEntries(
  Object.entries(NOTIFICATION_CATEGORIES).flatMap(([category, { types }]) => types.map((type) => [type, category])),
);

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/** Stored preferences merged over the defaults (new categories default to on). */
export function mergePreferences(stored) {
  const value = stored && typeof stored === 'object' ? stored : {};
  return {
    notifications: { ...DEFAULT_PREFERENCES.notifications, ...(value.notifications || {}) },
    email: { ...DEFAULT_PREFERENCES.email, ...(value.email || {}) },
    language: { ...DEFAULT_PREFERENCES.language, ...(value.language || {}) },
  };
}

export async function getPreferences(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
  if (!user) throw fail('Account not found.', 404);
  return {
    preferences: mergePreferences(user.preferences),
    categories: Object.entries(NOTIFICATION_CATEGORIES).map(([id, { label }]) => ({ id, label })),
    languages: LANGUAGES,
    countries: COUNTRIES,
  };
}

/** Partial update of one or more groups; unknown keys and invalid values are refused. */
export async function updatePreferences(userId, changes = {}) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true, email: true, role: true } });
  if (!user) throw fail('Account not found.', 404);
  const next = mergePreferences(user.preferences);

  if (changes.notifications !== undefined) {
    if (typeof changes.notifications !== 'object' || changes.notifications === null) throw fail('Notification preferences are invalid.');
    for (const [key, enabled] of Object.entries(changes.notifications)) {
      if (!NOTIFICATION_CATEGORIES[key]) throw fail(`Unknown notification category "${key}".`);
      if (typeof enabled !== 'boolean') throw fail('Notification choices must be on or off.');
      next.notifications[key] = enabled;
    }
  }
  if (changes.email !== undefined) {
    if (typeof changes.email?.productUpdates !== 'boolean') throw fail('Choose whether to receive product news.');
    if (changes.email.productUpdates !== next.email.productUpdates) {
      next.email = { productUpdates: changes.email.productUpdates, consentUpdatedAt: new Date().toISOString() };
    }
  }
  if (changes.language !== undefined) {
    const { language, country } = changes.language || {};
    if (language !== undefined && !LANGUAGES.includes(language)) throw fail('Choose a supported language.');
    if (country !== undefined && !COUNTRIES.includes(country)) throw fail('Choose a supported country.');
    next.language = { language: language ?? next.language.language, country: country ?? next.language.country };
  }

  await prisma.user.update({ where: { id: userId }, data: { preferences: next } });
  if (changes.email !== undefined) {
    // Marketing consent changes are recorded for compliance
    await prisma.auditLog.create({
      data: { actorId: userId, actorEmail: user.email, actorRole: user.role, action: 'MARKETING_CONSENT', resource: 'ACCOUNT', targetId: userId, details: { productUpdates: next.email.productUpdates }, result: 'SUCCESS' },
    }).catch(() => {});
  }
  return getPreferences(userId);
}

/** True unless the user turned off the category this notification type belongs to. */
export async function wantsNotification(userId, type) {
  const category = TYPE_TO_CATEGORY[type];
  if (!category) return true; // account, security, dispute and other alerts are always delivered
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
  return mergePreferences(user?.preferences).notifications[category] !== false;
}

/** "Download my data": the account's own records as JSON (no passwords, codes or other people's data). */
export async function exportAccountData(userId) {
  const [user, addresses, orders, sessions, notifications] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, phone: true, company: true, city: true, state: true, country: true, postalCode: true, gstin: true, createdAt: true, preferences: true, isVerified: true, isPhoneVerified: true },
    }),
    prisma.address.findMany({ where: { userId } }),
    prisma.order.findMany({
      where: { userId },
      select: { orderNumber: true, createdAt: true, orderStatus: true, paymentStatus: true, paymentMethod: true, total: true, currency: true, deliveryAddress: true, items: { select: { productName: true, productSku: true, quantity: true, unit: true, unitPrice: true, lineTotal: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.userSession.findMany({ where: { userId }, select: { device: true, method: true, createdAt: true, lastSeenAt: true, revokedAt: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.notification.findMany({ where: { userId }, select: { title: true, message: true, type: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 200 }),
  ]);
  if (!user) throw fail('Account not found.', 404);
  return {
    exportedAt: new Date().toISOString(),
    account: { ...user, preferences: mergePreferences(user.preferences) },
    addresses,
    orders: orders.map((o) => ({ ...o, total: Number(o.total), items: o.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice), lineTotal: Number(i.lineTotal) })) })),
    signIns: sessions,
    notifications,
  };
}
