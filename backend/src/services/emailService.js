import nodemailer from 'nodemailer';
import { getTransporter } from '../config/mailer.js';
import { ENV } from '../config/env.js';
import { renderOrderConfirmationEmail } from '../utils/emailTemplates.js';

export async function sendOrderConfirmationEmail(order) {
  if (!order || !order.buyerEmail) {
    console.warn('[TradeSphere Email] Missing order or recipient email, skipping.');
    return { success: false, reason: 'No recipient email' };
  }

  // Never send a paid confirmation for an unverified or failed payment
  if (order.paymentMethod === 'online' && order.paymentStatus !== 'PAID') {
    console.warn(`[TradeSphere Email] Skipping confirmation email for unverified payment status: ${order.paymentStatus}`);
    return { success: false, reason: 'Unverified payment status' };
  }

  try {
    const transporter = await getTransporter();
    const html = renderOrderConfirmationEmail({ order });

    const fromAddress =
      (ENV.SMTP_HOST && ENV.SMTP_HOST.includes('gmail')) || (ENV.SMTP_USER && ENV.SMTP_USER.includes('@gmail.com'))
        ? `TradeSphere Marketplace <${ENV.SMTP_USER}>`
        : ENV.SMTP_FROM;

    const mailOptions = {
      from: fromAddress,
      to: order.buyerEmail,
      subject: `Order Confirmed: ${order.orderNumber} - TradeSphere`,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[TradeSphere Email] Order confirmation email sent to ${order.buyerEmail}. Message ID: ${info.messageId}`);

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[TradeSphere Email Preview URL]: ${previewUrl}`);
    }

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (error) {
    console.error(`[TradeSphere Email Error] Failed to send confirmation email to ${order.buyerEmail}:`, error.message);
    // Return gracefully without throwing so order completion is never blocked by email failures
    return { success: false, error: error.message };
  }
}
