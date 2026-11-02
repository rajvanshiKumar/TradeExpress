import axios from 'axios';
import prisma from '../config/db.js';
import { ENV } from '../config/env.js';
import { getRazorpayClient, verifyRazorpaySignature } from '../config/razorpay.js';

/**
 * Saved payment methods (cards) backed by Razorpay tokenisation.
 *
 * Card details are entered only in Razorpay Checkout. A card is saved as a Razorpay token during a
 * ₹1 card-verification payment that the cardholder authenticates (RBI card-on-file rules). TradeExpress
 * stores the token id and display metadata only — never the card number, CVV or OTP.
 */

const VERIFICATION_AMOUNT_PAISE = 100; // ₹1, Razorpay's minimum order amount
const VERIFICATION_PURPOSE = 'CARD_VERIFICATION';
const GATEWAY_CACHE_MS = 10 * 60 * 1000;

const METHOD_SELECT = {
  id: true,
  provider: true,
  type: true,
  network: true,
  cardType: true,
  issuer: true,
  last4: true,
  expiryMonth: true,
  expiryYear: true,
  cardholderName: true,
  isDefault: true,
  status: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
};

const CARD_NETWORKS = [
  { code: 'VISA', name: 'Visa' },
  { code: 'MC', name: 'Mastercard' },
  { code: 'RUPAY', name: 'RuPay' },
  { code: 'MAES', name: 'Maestro' },
  { code: 'AMEX', name: 'American Express' },
  { code: 'DICL', name: 'Diners Club' },
  { code: 'JCB', name: 'JCB' },
  { code: 'DISC', name: 'Discover' },
];

const WALLET_NAMES = {
  paytm: 'Paytm', phonepe: 'PhonePe', amazonpay: 'Amazon Pay', mobikwik: 'MobiKwik', olamoney: 'Ola Money',
  airtelmoney: 'Airtel Money', freecharge: 'Freecharge', jiomoney: 'JioMoney', payzapp: 'PayZapp',
};

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/** Razorpay client, or a clear 503 when the gateway is not configured (never a fake success). */
function gateway() {
  try {
    return getRazorpayClient();
  } catch (error) {
    throw httpError(`Card payments are not available right now: ${error.message}`, 503);
  }
}

/** Converts a Razorpay SDK failure into an API error without leaking request payloads. */
function gatewayError(error, fallback) {
  const description = error?.error?.description;
  return httpError(description ? `Payment gateway: ${description}` : fallback, error?.statusCode >= 400 && error?.statusCode < 500 ? 400 : 502);
}

const isTokenNotFound = (error) =>
  error?.statusCode === 404
  || (error?.statusCode === 400 && /does not exist|not found|invalid (token|id)|is not a valid id/i.test(error?.error?.description || ''));

function cardMetadata(token) {
  const card = token?.card || {};
  return {
    network: card.network || null,
    cardType: card.type || null,
    issuer: card.issuer || null,
    last4: card.last4 ? String(card.last4).slice(-4) : null,
    expiryMonth: card.expiry_month ? Number(card.expiry_month) : null,
    expiryYear: card.expiry_year ? Number(card.expiry_year) : null,
    cardholderName: card.name ? String(card.name).slice(0, 120) : null,
  };
}

function isExpired({ expiryMonth, expiryYear }, now = new Date()) {
  if (!expiryMonth || !expiryYear) return false;
  const year = expiryYear < 100 ? 2000 + expiryYear : expiryYear;
  return year < now.getFullYear() || (year === now.getFullYear() && expiryMonth < now.getMonth() + 1);
}

const withFlags = (method) => ({ ...method, isExpired: isExpired(method) });

async function findOwned(userId, id) {
  const method = await prisma.paymentMethod.findFirst({ where: { id, userId } });
  // Same response for "missing" and "someone else's" so ids cannot be probed
  if (!method) throw httpError('Payment method not found.', 404);
  return method;
}

/* ---------------------------------------------------------------- read */

export async function listPaymentMethods(userId) {
  const methods = await prisma.paymentMethod.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    select: METHOD_SELECT,
  });
  return methods.map(withFlags);
}

let gatewayCache = { at: 0, data: null };

/** Payment methods actually enabled on the configured Razorpay account (fetched live, cached briefly). */
export async function getGatewayMethods() {
  if (gatewayCache.data && Date.now() - gatewayCache.at < GATEWAY_CACHE_MS) return gatewayCache.data;

  try {
    getRazorpayClient(); // validates gateway mode and keys
  } catch (error) {
    return { available: false, reason: error.message };
  }

  let methods;
  try {
    // /v1/methods is Razorpay's public endpoint and authenticates with the key id only (no secret)
    const response = await axios.get('https://api.razorpay.com/v1/methods', {
      auth: { username: ENV.RAZORPAY_KEY_ID, password: '' },
      timeout: 15000,
    });
    methods = response.data;
  } catch (error) {
    // Not cached, so the next request retries
    return { available: false, reason: error?.response?.data?.error?.description || 'The payment gateway could not be reached.' };
  }

  const networks = methods.card_networks || {};
  const data = {
    available: true,
    provider: 'razorpay',
    mode: ENV.PAYMENT_GATEWAY_MODE,
    cards: {
      enabled: Boolean(methods.card),
      networks: CARD_NETWORKS.map((network) => ({ ...network, enabled: Boolean(methods.card) && networks[network.code] === 1 })),
    },
    upi: { enabled: Boolean(methods.upi) },
    netbanking: {
      enabled: Boolean(methods.netbanking && Object.keys(methods.netbanking).length),
      banks: Object.entries(methods.netbanking || {}).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name)),
    },
    wallets: Object.entries(methods.wallet || {})
      .filter(([, enabled]) => enabled)
      .map(([code]) => ({ code, name: WALLET_NAMES[code] || code.charAt(0).toUpperCase() + code.slice(1) })),
  };
  gatewayCache = { at: Date.now(), data };
  return data;
}

/* ---------------------------------------------------------------- add card */

const razorpayContact = (phone) => {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return /^\+?\d{8,15}$/.test(digits) ? digits : undefined;
};

/** Returns the buyer's Razorpay customer id, creating the customer on first use. */
async function ensureGatewayCustomer(client, user) {
  if (user.razorpayCustomerId) return user.razorpayCustomerId;
  let customer;
  try {
    customer = await client.customers.create({
      name: String(user.name || '').trim().length >= 3 ? String(user.name).trim().slice(0, 50) : 'TradeExpress Buyer',
      email: user.email,
      contact: razorpayContact(user.phone),
      fail_existing: '0',
      notes: { tradeexpressUserId: user.id },
    });
  } catch (error) {
    throw gatewayError(error, 'Could not register you with the payment gateway.');
  }
  await prisma.user.update({ where: { id: user.id }, data: { razorpayCustomerId: customer.id } });
  return customer.id;
}

/** Creates the ₹1 card-verification order the buyer completes in Razorpay Checkout. */
export async function startCardSession(userId) {
  const client = gateway();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, phone: true, razorpayCustomerId: true },
  });
  if (!user) throw httpError('Account not found.', 404);

  const customerId = await ensureGatewayCustomer(client, user);

  let order;
  try {
    order = await client.orders.create({
      amount: VERIFICATION_AMOUNT_PAISE,
      currency: 'INR',
      receipt: `cardverify_${Date.now().toString(36)}`,
      notes: { purpose: VERIFICATION_PURPOSE, userId },
    });
  } catch (error) {
    throw gatewayError(error, 'Could not start card verification with the payment gateway.');
  }

  return {
    keyId: ENV.RAZORPAY_KEY_ID,
    orderId: order.id,
    amount: VERIFICATION_AMOUNT_PAISE,
    currency: 'INR',
    customerId,
    mode: ENV.PAYMENT_GATEWAY_MODE,
    prefill: { name: user.name, email: user.email, contact: razorpayContact(user.phone) || '' },
  };
}

/** Returns the ₹1 if Razorpay captured it; authorised-only payments are never captured and are released by Razorpay. */
async function releaseVerificationCharge(client, payment) {
  if (payment.status !== 'captured') return 'released_by_gateway';
  try {
    await client.payments.refund(payment.id, { amount: payment.amount, notes: { purpose: VERIFICATION_PURPOSE } });
    return 'refunded';
  } catch (error) {
    console.error(`[TradeExpress Cards] Verification refund failed for ${payment.id}:`, error?.error?.description || error.message);
    return 'refund_failed';
  }
}

/**
 * Confirms the Checkout result entirely against data fetched from Razorpay, then stores the token's
 * display metadata. Nothing is saved unless Razorpay reports a token for this buyer's own card payment.
 */
export async function completeCardSession(userId, { razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const client = gateway();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, razorpayCustomerId: true } });
  if (!user?.razorpayCustomerId) throw httpError('Start adding a card again: no verification is in progress.', 400);

  // 1. The order must be a card-verification order this server created for this buyer
  let order;
  try {
    order = await client.orders.fetch(razorpayOrderId);
  } catch (error) {
    throw gatewayError(error, 'Could not confirm the card verification with the payment gateway.');
  }
  if (order?.notes?.purpose !== VERIFICATION_PURPOSE || order?.notes?.userId !== userId) {
    throw httpError('This card verification does not belong to your account.', 403);
  }

  // 2. Signature over the server-side order id (never trust the id echoed by the browser alone)
  if (!verifyRazorpaySignature({ orderId: order.id, paymentId: razorpayPaymentId, signature: razorpaySignature })) {
    throw httpError('Card verification could not be authenticated. Please try again.', 400);
  }

  // 3. The payment itself, as recorded by Razorpay
  let payment;
  try {
    payment = await client.payments.fetch(razorpayPaymentId);
  } catch (error) {
    throw gatewayError(error, 'Could not fetch the verification payment from the gateway.');
  }
  if (payment.order_id !== order.id) throw httpError('Card verification does not match this session.', 400);
  if (!['authorized', 'captured'].includes(payment.status)) throw httpError(`The card verification was not completed (status: ${payment.status}).`, 400);

  const verificationCharge = await releaseVerificationCharge(client, payment);

  if (payment.method !== 'card') {
    throw httpError('Only cards can be saved here. Please choose "Card" in the payment window.', 400);
  }
  if (payment.customer_id && payment.customer_id !== user.razorpayCustomerId) {
    throw httpError('This card verification does not belong to your account.', 403);
  }
  if (!payment.token_id) {
    throw httpError('Your card was verified, but it was not saved. Tick the option to save your card in the payment window, then try again.', 422);
  }

  // 4. Token details straight from Razorpay
  let token;
  try {
    token = await client.customers.fetchToken(user.razorpayCustomerId, payment.token_id);
  } catch (error) {
    throw gatewayError(error, 'The card was tokenised but its details could not be fetched.');
  }
  const metadata = cardMetadata(token);

  const saved = await prisma.$transaction(async (tx) => {
    const existing = await tx.paymentMethod.findUnique({ where: { providerTokenId: token.id } });
    if (existing && existing.userId !== userId) throw httpError('This card is already registered to another account.', 409);

    const activeCount = await tx.paymentMethod.count({ where: { userId, type: 'CARD', status: 'ACTIVE' } });
    if (existing) {
      return tx.paymentMethod.update({ where: { id: existing.id }, data: { ...metadata, status: 'ACTIVE', verifiedAt: new Date() }, select: METHOD_SELECT });
    }
    return tx.paymentMethod.create({
      data: { ...metadata, userId, provider: 'razorpay', providerTokenId: token.id, type: 'CARD', status: 'ACTIVE', isDefault: activeCount === 0, verifiedAt: new Date() },
      select: METHOD_SELECT,
    });
  });

  return { method: withFlags(saved), verificationCharge };
}

/* ---------------------------------------------------------------- manage */

export async function setDefaultPaymentMethod(userId, id) {
  return prisma.$transaction(async (tx) => {
    const method = await tx.paymentMethod.findFirst({ where: { id, userId } });
    if (!method) throw httpError('Payment method not found.', 404);
    if (method.status !== 'ACTIVE' || isExpired(method)) throw httpError('Only an active, unexpired card can be your default.', 400);

    // One default per payment-method category
    await tx.paymentMethod.updateMany({ where: { userId, type: method.type, isDefault: true, NOT: { id } }, data: { isDefault: false } });
    const updated = await tx.paymentMethod.update({ where: { id }, data: { isDefault: true }, select: METHOD_SELECT });
    return withFlags(updated);
  });
}

/** Re-checks the token with Razorpay and refreshes its metadata and status. */
export async function verifyPaymentMethod(userId, id) {
  const method = await findOwned(userId, id);
  const client = gateway();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { razorpayCustomerId: true } });

  let status = 'ACTIVE';
  let metadata = {};
  try {
    const token = await client.customers.fetchToken(user?.razorpayCustomerId, method.providerTokenId);
    metadata = cardMetadata(token);
  } catch (error) {
    if (!isTokenNotFound(error)) throw gatewayError(error, 'Could not check this card with the payment gateway.');
    status = 'INACTIVE'; // deleted or expired at the gateway (e.g. removed by the cardholder)
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.paymentMethod.update({
      where: { id: method.id },
      data: { ...metadata, status, ...(status === 'ACTIVE' ? { verifiedAt: new Date() } : { isDefault: false }) },
      select: METHOD_SELECT,
    });
    if (status === 'INACTIVE' && method.isDefault) await promoteNextDefault(tx, userId, method.type);
    return result;
  });
  return withFlags(updated);
}

async function promoteNextDefault(tx, userId, type) {
  const next = await tx.paymentMethod.findFirst({ where: { userId, type, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, select: { id: true } });
  if (next) await tx.paymentMethod.update({ where: { id: next.id }, data: { isDefault: true } });
}

/** Deletes the token at Razorpay (RBI: cardholders must be able to delete saved cards) and locally. */
export async function removePaymentMethod(userId, id) {
  const method = await findOwned(userId, id);
  const client = gateway();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { razorpayCustomerId: true } });

  try {
    await client.customers.deleteToken(user?.razorpayCustomerId, method.providerTokenId);
  } catch (error) {
    // Already gone at the gateway is fine; any other failure keeps the card so it is not orphaned there
    if (!isTokenNotFound(error)) throw gatewayError(error, 'The card could not be removed at the payment gateway. Please try again.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentMethod.delete({ where: { id: method.id } });
    if (method.isDefault) await promoteNextDefault(tx, userId, method.type);
  });
  return { id: method.id };
}
