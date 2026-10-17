import Razorpay from 'razorpay';
import crypto from 'crypto';
import { ENV } from './env.js';

let razorpayInstance = null;

try {
  if (ENV.RAZORPAY_KEY_ID && ENV.RAZORPAY_KEY_SECRET) {
    razorpayInstance = new Razorpay({
      key_id: ENV.RAZORPAY_KEY_ID,
      key_secret: ENV.RAZORPAY_KEY_SECRET,
    });
  }
} catch (error) {
  console.warn('[TradeSphere Razorpay] Razorpay initialization warning:', error.message);
}

export function getRazorpayClient() {
  return razorpayInstance;
}

/**
 * Verifies Razorpay signature using HMAC SHA256
 */
export function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature) return false;
  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', ENV.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex');

  return expectedSignature === signature;
}

/**
 * Creates a sandbox test signature for automated sandbox payment simulation
 */
export function createSandboxSignature({ orderId, paymentId }) {
  const body = `${orderId}|${paymentId}`;
  return crypto
    .createHmac('sha256', ENV.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex');
}
