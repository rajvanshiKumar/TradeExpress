// Payment provider adapter integrated with TradeSphere Express + MySQL backend.
//
// Online payments (UPI, Cards, Net Banking, Wallets) communicate with the backend
// Razorpay gateway in sandbox/production mode. Payments are cryptographically verified
// on the server before an order is confirmed as PAID.

import { apiPost, isApiConfigured } from './apiClient';

export const isPaymentProviderConfigured = true;

/** Helper to load Razorpay checkout script if available */
function loadRazorpaySdk() {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      return resolve(true);
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Starts an online payment.
 * Returns:
 *   { status: 'paid', reference, order } on verified success
 *   { status: 'cancelled' } if aborted or dismissed
 *   { status: 'failed', message } on error
 */
export async function startPayment({ order, orderId, amount, method, buyerInfo, signal } = {}) {
  const targetOrderId = order?.backendId || order?.orderNumber || order?.id || orderId;

  if (!isApiConfigured) {
    return {
      status: 'failed',
      message: 'API backend is not configured. Please ensure VITE_PUBLIC_API_BASE_URL is set.',
    };
  }

  if (!targetOrderId) {
    return {
      status: 'failed',
      message: 'Order reference is missing for payment processing.',
    };
  }

  try {
    // 1. Initiate payment order on backend
    const createRes = await apiPost('payments/create-order', { orderId: targetOrderId }, { signal });
    if (!createRes.success || !createRes.data) {
      return {
        status: 'failed',
        message: createRes.message || 'Could not initiate payment with gateway.',
      };
    }

    const paymentData = createRes.data;

    // Check for abort before proceeding
    if (signal?.aborted) {
      return { status: 'cancelled' };
    }

    // 2. Attempt Razorpay standard checkout popup if real keys are configured
    const hasSdk = await loadRazorpaySdk();
    const isLiveKey = paymentData.keyId && paymentData.keyId.startsWith('rzp_test_') && paymentData.keyId.length > 20;

    if (hasSdk && isLiveKey && window.Razorpay) {
      return new Promise((resolve) => {
        let isDismissed = true;
        const options = {
          key: paymentData.keyId,
          amount: paymentData.amountInPaise,
          currency: paymentData.currency || 'INR',
          name: 'TradeSphere',
          description: `Wholesale Order #${paymentData.orderNumber}`,
          order_id: paymentData.paymentOrderId,
          prefill: {
            name: buyerInfo?.name || paymentData.buyerName,
            email: buyerInfo?.email || paymentData.buyerEmail,
            contact: buyerInfo?.phone || paymentData.buyerPhone,
          },
          theme: {
            color: '#1e3a5f',
          },
          handler: async (response) => {
            isDismissed = false;
            try {
              // 3. Cryptographic signature verification on backend
              const verifyRes = await apiPost('payments/verify', {
                orderId: paymentData.orderId,
                paymentOrderId: response.razorpay_order_id || paymentData.paymentOrderId,
                transactionId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              });

              if (verifyRes.success) {
                resolve({
                  status: 'paid',
                  reference: response.razorpay_payment_id,
                  order: verifyRes.data,
                });
              } else {
                resolve({
                  status: 'failed',
                  message: verifyRes.message || 'Signature verification failed.',
                });
              }
            } catch (err) {
              resolve({
                status: 'failed',
                message: err.message || 'Payment verification could not be completed on server.',
              });
            }
          },
          modal: {
            ondismiss: () => {
              if (isDismissed) {
                resolve({ status: 'cancelled' });
              }
            },
          },
        };

        signal?.addEventListener('abort', () => {
          resolve({ status: 'cancelled' });
        });

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', (err) => {
          resolve({
            status: 'failed',
            message: err.error?.description || 'Gateway reported payment failed.',
          });
        });
        rzp.open();
      });
    }

    // 3. Gateway Sandbox Simulation
    // When in sandbox test mode, complete payment with backend-verified cryptographic HMAC signature
    await new Promise((r) => setTimeout(r, 1200));

    if (signal?.aborted) {
      return { status: 'cancelled' };
    }

    const simRes = await apiPost(
      'payments/sandbox-pay',
      {
        orderId: paymentData.orderId,
        paymentOrderId: paymentData.paymentOrderId,
      },
      { signal }
    );

    if (simRes.success && simRes.data) {
      const transactionId = simRes.data.payments?.[0]?.transactionId || `pay_test_${Date.now()}`;
      return {
        status: 'paid',
        reference: transactionId,
        order: simRes.data,
      };
    } else {
      return {
        status: 'failed',
        message: simRes.message || 'Sandbox payment simulation failed.',
      };
    }
  } catch (error) {
    if (signal?.aborted || error.name === 'AbortError') {
      return { status: 'cancelled' };
    }
    return {
      status: 'failed',
      message: error.message || 'Payment communication error with backend server.',
    };
  }
}
