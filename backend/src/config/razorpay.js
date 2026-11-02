import Razorpay from 'razorpay';
import crypto from 'crypto';
import { ENV } from './env.js';

/**
 * Enforces strict sandbox/test mode rules.
 * Refuses execution if mode is not explicitly 'sandbox' or if key does not match test prefix.
 */
export function assertSandboxMode() {
  const mode = (ENV.PAYMENT_GATEWAY_MODE || '').trim().toLowerCase();
  if (mode !== 'sandbox') {
    const error = new Error('Payment gateway operations are strictly restricted to sandbox/test mode during this phase. Live mode is disabled.');
    error.statusCode = 403;
    throw error;
  }

  const keyId = (ENV.RAZORPAY_KEY_ID || '').trim();
  if (!keyId.startsWith('rzp_test_')) {
    const error = new Error('Invalid Razorpay Key ID format. In sandbox mode, RAZORPAY_KEY_ID must begin with "rzp_test_".');
    error.statusCode = 500;
    throw error;
  }
}

/**
 * Returns an initialized Razorpay Node.js SDK instance in validated sandbox mode.
 */
export function getRazorpayClient() {
  assertSandboxMode();

  const keyId = (ENV.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (ENV.RAZORPAY_KEY_SECRET || '').trim();

  if (!keyId || !keySecret) {
    const error = new Error('Razorpay sandbox credentials missing. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend .env.');
    error.statusCode = 500;
    throw error;
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

/**
 * Verifies Razorpay payment signature using HMAC SHA-256 and timing-safe comparison.
 * Formula: HMAC-SHA256(`${orderId}|${paymentId}`, keySecret) === signature
 */
export function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  assertSandboxMode();

  if (!orderId || !paymentId || !signature) return false;
  const keySecret = (ENV.RAZORPAY_KEY_SECRET || '').trim();
  if (!keySecret) return false;

  const data = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(data)
    .digest('hex');

  const signatureBuf = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expectedSignature, 'utf8');

  if (signatureBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuf, expectedBuf);
}

/**
 * Generates an HMAC SHA-256 test signature for automated sandbox simulation/testing.
 */
export function createSandboxSignature({ orderId, paymentId }) {
  assertSandboxMode();

  const keySecret = (ENV.RAZORPAY_KEY_SECRET || '').trim();
  if (!keySecret) {
    throw new Error('Cannot create sandbox signature: RAZORPAY_KEY_SECRET is not configured.');
  }

  const data = `${orderId}|${paymentId}`;
  return crypto
    .createHmac('sha256', keySecret)
    .update(data)
    .digest('hex');
}

/**
 * Verifies Razorpay Webhook signature using HMAC SHA-256 and timing-safe comparison.
 * Requires a distinct RAZORPAY_WEBHOOK_SECRET environment variable.
 */
export function verifyWebhookSignature({ rawBody, signature, secret }) {
  assertSandboxMode();

  const webhookSecret = secret || (ENV.RAZORPAY_WEBHOOK_SECRET || '').trim();
  if (!rawBody || !signature || !webhookSecret) return false;

  const payload = Buffer.isBuffer(rawBody)
    ? rawBody.toString('utf8')
    : typeof rawBody === 'string'
      ? rawBody
      : JSON.stringify(rawBody);

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  const signatureBuf = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expectedSignature, 'utf8');

  if (signatureBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuf, expectedBuf);
}
