// Buyer saved payment methods (/api/payment-methods), tokenised by Razorpay.
//
// Card numbers and CVVs are typed only into Razorpay Checkout's secure window. TradeExpress receives
// Razorpay's payment reference and signature, and the server stores only the resulting token metadata.

import { authorizedRequest } from './authorizedApi';
import { loadRazorpaySdk } from './paymentService';

const request = (method, path = '', body, options) => authorizedRequest(method, `payment-methods${path}`, body, options);

/** True when the card can be charged: active at the gateway and not past its expiry month. */
export const isUsableCard = (method) => method?.type === 'CARD' && method.status === 'ACTIVE' && !method.isExpired;

/**
 * Saves a new card: creates a ₹1 verification order, opens Razorpay Checkout for the buyer to enter
 * and authenticate the card, then asks the server to confirm and store the token.
 * Resolves { status: 'saved', method, verificationCharge } | { status: 'cancelled' } | { status: 'failed', message }.
 */
async function addCard({ brandColor = '#0f5132' } = {}) {
  let session;
  try {
    session = await request('POST', '/cards/session');
  } catch (error) {
    return { status: 'failed', message: error.message };
  }

  const sdkLoaded = await loadRazorpaySdk();
  if (!sdkLoaded || !window.Razorpay) {
    return { status: 'failed', message: 'The secure Razorpay card window could not be loaded. Disable any ad or script blocker for this site and try again.' };
  }

  return new Promise((resolve) => {
    let settled = false;
    let lastFailure = ''; // Razorpay keeps the window open after a failed attempt so the buyer can retry
    const finish = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    const checkout = new window.Razorpay({
      key: session.keyId,
      order_id: session.orderId,
      amount: session.amount,
      currency: session.currency,
      name: 'TradeExpress',
      description: 'Card verification (₹1) to save your card',
      customer_id: session.customerId,
      remember_customer: true,
      prefill: { ...session.prefill, method: 'card' },
      readonly: { email: true },
      notes: { purpose: 'CARD_VERIFICATION' },
      theme: { color: brandColor },
      handler: async (response) => {
        try {
          const result = await request('POST', '/cards/complete', {
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          }, { timeoutMs: 30000 });
          finish({ status: 'saved', ...result });
        } catch (error) {
          finish({ status: 'failed', message: error.message });
        }
      },
      modal: { ondismiss: () => finish(lastFailure ? { status: 'failed', message: lastFailure } : { status: 'cancelled' }) },
    });

    checkout.on('payment.failed', (event) => {
      lastFailure = event?.error?.description || 'The card could not be verified by the payment gateway.';
    });

    try {
      checkout.open();
    } catch {
      finish({ status: 'failed', message: 'The secure Razorpay card window could not be opened.' });
    }
  });
}

const paymentMethodService = {
  list: () => request('GET'),
  gatewayMethods: () => request('GET', '/gateway'),
  addCard,
  setDefault: (id) => request('PATCH', `/${encodeURIComponent(id)}/default`),
  verify: (id) => request('POST', `/${encodeURIComponent(id)}/verify`, undefined, { timeoutMs: 30000 }),
  remove: (id) => request('DELETE', `/${encodeURIComponent(id)}`, undefined, { timeoutMs: 30000 }),
};

export default paymentMethodService;
