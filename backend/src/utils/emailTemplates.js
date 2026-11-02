import { ENV } from '../config/env.js';

export function renderOrderConfirmationEmail({ order }) {
  const trackingUrl = `${ENV.FRONTEND_URL}/track/${order.orderNumber}`;
  const address = typeof order.deliveryAddress === 'string' ? JSON.parse(order.deliveryAddress) : order.deliveryAddress;
  const items = order.items || [];
  const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const itemsHtml = items
    .map((item) => {
      const photoUrl = item.productPhoto?.startsWith('http')
        ? item.productPhoto
        : item.productPhoto?.startsWith('photo-')
        ? `https://images.unsplash.com/${item.productPhoto}?fm=jpg&fit=crop&w=160&h=160&q=75`
        : 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?fm=jpg&fit=crop&w=160&h=160&q=75';

      return `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="64" valign="top">
                <img src="${photoUrl}" alt="${item.productName}" width="60" height="60" style="border-radius: 8px; object-fit: cover; display: block; border: 1px solid #e2e8f0;" />
              </td>
              <td style="padding-left: 14px;" valign="top">
                <div style="font-size: 14px; font-weight: 600; color: #0f172a;">${item.productName}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 4px;">SKU: ${item.productSku} · Qty: ${item.quantity} ${item.unit}</div>
              </td>
              <td align="right" valign="top" style="font-size: 14px; font-weight: 700; color: #0f172a;">
                ₹${Number(item.lineTotal).toLocaleString('en-IN')}
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation - TradeExpress</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; color: #1e293b; }
    .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #0b2716 0%, #153e24 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
    .content { padding: 32px 24px; }
    .btn { display: inline-block; background-color: #10b981; color: #ffffff !important; padding: 14px 28px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 8px; margin: 20px 0; }
    .badge { display: inline-block; padding: 4px 10px; font-size: 12px; font-weight: 600; border-radius: 9999px; }
    .badge-paid { background-color: #ecfdf5; color: #047857; }
    .badge-cod { background-color: #eff6ff; color: #1d4ed8; }
    .badge-pending { background-color: #fffbeb; color: #b45309; }
    @media only screen and (max-width: 600px) {
      .container { border-radius: 0; margin: 0; }
      .content { padding: 20px 16px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">TradeExpress</div>
      <div style="font-size: 13px; opacity: 0.8; margin-top: 4px;">International B2B Marketplace</div>
    </div>
    <div class="content">
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 8px 0;">Order Confirmation</h2>
      <p style="font-size: 14px; color: #64748b; margin: 0 0 20px 0;">
        Hello <strong>${order.buyerName}</strong>, thank you for your order! Your wholesale request has been received and confirmed.
      </p>

      <div style="background-color: #f8fafc; border-radius: 12px; padding: 16px; margin-bottom: 24px; border: 1px solid #edf2f7;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size: 13px; color: #64748b; padding-bottom: 6px;">Order Reference:</td>
            <td align="right" style="font-size: 13px; font-weight: 700; color: #0f172a; padding-bottom: 6px;">${order.orderNumber}</td>
          </tr>
          <tr>
            <td style="font-size: 13px; color: #64748b; padding-bottom: 6px;">Date:</td>
            <td align="right" style="font-size: 13px; font-weight: 600; color: #0f172a; padding-bottom: 6px;">${orderDate}</td>
          </tr>
          <tr>
            <td style="font-size: 13px; color: #64748b; padding-bottom: 6px;">Payment Method:</td>
            <td align="right" style="font-size: 13px; font-weight: 600; color: #0f172a; padding-bottom: 6px;">${order.paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : 'Online Payment (Razorpay)'}</td>
          </tr>
          <tr>
            <td style="font-size: 13px; color: #64748b;">Payment Status:</td>
            <td align="right">
              <span class="badge ${order.paymentStatus === 'PAID' ? 'badge-paid' : order.paymentStatus === 'COD' ? 'badge-cod' : 'badge-pending'}">
                ${order.paymentStatus}
              </span>
            </td>
          </tr>
        </table>
      </div>

      <div style="text-align: center;">
        <a href="${trackingUrl}" class="btn" target="_blank">Track My Order</a>
      </div>

      <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 24px;">Items Ordered</h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
        ${itemsHtml}
      </table>

      <!-- Totals -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #e2e8f0; padding-top: 12px; margin-bottom: 24px;">
        <tr>
          <td style="font-size: 13px; color: #64748b; padding: 4px 0;">Subtotal</td>
          <td align="right" style="font-size: 13px; font-weight: 600; color: #0f172a;">₹${Number(order.subtotal).toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td style="font-size: 13px; color: #64748b; padding: 4px 0;">Shipping (${order.shippingMethod})</td>
          <td align="right" style="font-size: 13px; font-weight: 600; color: #0f172a;">₹${Number(order.shippingFee).toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td style="font-size: 13px; color: #64748b; padding: 4px 0;">GST / Tax</td>
          <td align="right" style="font-size: 13px; font-weight: 600; color: #0f172a;">₹${Number(order.tax).toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td style="font-size: 15px; font-weight: 800; color: #0f172a; padding: 10px 0; border-top: 1px solid #cbd5e1;">Final Total</td>
          <td align="right" style="font-size: 18px; font-weight: 800; color: #047857; padding: 10px 0; border-top: 1px solid #cbd5e1;">₹${Number(order.total).toLocaleString('en-IN')}</td>
        </tr>
      </table>

      <!-- Shipping Address -->
      <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">Delivery Address</h3>
      <div style="font-size: 13px; color: #475569; line-height: 1.6; background-color: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <strong>${address?.name || order.buyerName}</strong>${address?.company ? ` · ${address.company}` : ''}<br>
        ${address?.street || ''}<br>
        ${address?.city || ''}${address?.state ? `, ${address.state}` : ''} - ${address?.postalCode || ''}<br>
        ${address?.country || 'India'}<br>
        Phone: ${address?.phone || order.buyerPhone}
      </div>

      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 12px; color: #94a3b8;">
        TradeExpress Marketplace · Your World of Business<br>
        Questions? Contact us at support@tradeexpress.com
      </div>
    </div>
  </div>
</body>
</html>
`;
}
