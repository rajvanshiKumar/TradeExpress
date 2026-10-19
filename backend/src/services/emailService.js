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

export async function sendPasswordResetEmail({ email, name = 'User', resetUrl, otp }) {
  try {
    const transporter = await getTransporter();
    const fromAddress =
      (ENV.SMTP_HOST && ENV.SMTP_HOST.includes('gmail')) || (ENV.SMTP_USER && ENV.SMTP_USER.includes('@gmail.com'))
        ? `TradeSphere Support <${ENV.SMTP_USER}>`
        : ENV.SMTP_FROM;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #102a56; margin-top: 0;">Password Reset Request</h2>
        <p style="color: #334155; font-size: 15px;">Hello ${name},</p>
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          We received a request to reset your TradeSphere account password. Use the verification code below or click the button to set a new password:
        </p>
        <div style="margin: 20px 0; text-align: center;">
          <span style="display: inline-block; font-size: 28px; font-weight: bold; letter-spacing: 4px; padding: 12px 24px; background: #f0f4fa; color: #102a56; border-radius: 8px; border: 1px dashed #cbd5e1;">${otp || '123456'}</span>
        </div>
        ${resetUrl ? `
          <div style="margin: 24px 0; text-align: center;">
            <a href="${resetUrl}" style="background: #102a56; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #64748b; font-size: 12px; word-break: break-all;">Direct Link: <a href="${resetUrl}">${resetUrl}</a></p>
        ` : ''}
        <p style="color: #64748b; font-size: 13px;">This code and link will expire in 30 minutes. If you did not request a password reset, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 11px; text-align: center;">TradeSphere B2B Wholesale Marketplace · Secure Automated Notification</p>
      </div>
    `;

    const mailOptions = {
      from: fromAddress,
      to: email,
      subject: `Reset your TradeSphere password (OTP: ${otp})`,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[TradeSphere Reset Email Preview URL]: ${previewUrl}`);
    }

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (error) {
    console.error(`[TradeSphere Email Error] Failed to send reset email to ${email}:`, error.message);
    return { success: false, error: error.message };
  }
}

