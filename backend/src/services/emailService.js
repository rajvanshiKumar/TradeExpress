import nodemailer from 'nodemailer';
import { getTransporter } from '../config/mailer.js';
import { ENV } from '../config/env.js';
import { renderOrderConfirmationEmail } from '../utils/emailTemplates.js';

export async function sendOrderConfirmationEmail(order) {
  if (!order || !order.buyerEmail) {
    console.warn('[TradeExpress Email] Missing order or recipient email, skipping.');
    return { success: false, reason: 'No recipient email' };
  }

  // Never send a paid confirmation for an unverified or failed payment
  if (order.paymentMethod === 'online' && order.paymentStatus !== 'PAID') {
    console.warn(`[TradeExpress Email] Skipping confirmation email for unverified payment status: ${order.paymentStatus}`);
    return { success: false, reason: 'Unverified payment status' };
  }

  try {
    const transporter = await getTransporter();
    const html = renderOrderConfirmationEmail({ order });

    const fromAddress =
      (ENV.SMTP_HOST && ENV.SMTP_HOST.includes('gmail')) || (ENV.SMTP_USER && ENV.SMTP_USER.includes('@gmail.com'))
        ? `TradeExpress Marketplace <${ENV.SMTP_USER}>`
        : ENV.SMTP_FROM;

    const mailOptions = {
      from: fromAddress,
      to: order.buyerEmail,
      subject: `Order Confirmed: ${order.orderNumber} - TradeExpress`,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[TradeExpress Email] Order confirmation email sent to ${order.buyerEmail}. Message ID: ${info.messageId}`);

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[TradeExpress Email Preview URL]: ${previewUrl}`);
    }

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (error) {
    console.error(`[TradeExpress Email Error] Failed to send confirmation email to ${order.buyerEmail}:`, error.message);
    // Return gracefully without throwing so order completion is never blocked by email failures
    return { success: false, error: error.message };
  }
}

export async function sendPasswordResetEmail({ email, name = 'User', resetUrl, otp }) {
  try {
    const transporter = await getTransporter();
    const fromAddress =
      (ENV.SMTP_HOST && ENV.SMTP_HOST.includes('gmail')) || (ENV.SMTP_USER && ENV.SMTP_USER.includes('@gmail.com'))
        ? `TradeExpress Support <${ENV.SMTP_USER}>`
        : ENV.SMTP_FROM;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #102a56; margin-top: 0;">Password Reset Request</h2>
        <p style="color: #334155; font-size: 15px;">Hello ${name},</p>
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          We received a request to reset your TradeExpress account password. Use the verification code below or click the button to set a new password:
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
        <p style="color: #94a3b8; font-size: 11px; text-align: center;">TradeExpress B2B Wholesale Marketplace · Secure Automated Notification</p>
      </div>
    `;

    const mailOptions = {
      from: fromAddress,
      to: email,
      subject: `Reset your TradeExpress password (OTP: ${otp})`,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[TradeExpress Reset Email Preview URL]: ${previewUrl}`);
    }

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (error) {
    console.error(`[TradeExpress Email Error] Failed to send reset email to ${email}:`, error.message);
    return { success: false, error: error.message };
  }
}

export async function sendLoginOtpEmail({ email, name = 'Valued User', otp }) {
  try {
    const transporter = await getTransporter();
    const fromAddress =
      (ENV.SMTP_HOST && ENV.SMTP_HOST.includes('gmail')) || (ENV.SMTP_USER && ENV.SMTP_USER.includes('@gmail.com'))
        ? `TradeExpress Security <${ENV.SMTP_USER}>`
        : ENV.SMTP_FROM;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #102a56; margin-top: 0;">TradeExpress Login Verification</h2>
        <p style="color: #334155; font-size: 15px;">Hello ${name || 'User'},</p>
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          Your one-time verification code (OTP) for signing in to TradeExpress is:
        </p>
        <div style="margin: 20px 0; text-align: center;">
          <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 14px 28px; background: #f0f4fa; color: #102a56; border-radius: 8px; border: 1px dashed #cbd5e1;">${otp}</span>
        </div>
        <p style="color: #64748b; font-size: 13px;">This verification code is valid for 10 minutes. For security reasons, never share this OTP with anyone.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 11px; text-align: center;">TradeExpress B2B Wholesale Marketplace · Secure Automated Notification</p>
      </div>
    `;

    const mailOptions = {
      from: fromAddress,
      to: email,
      subject: 'Your TradeExpress Sign-in Verification Code',
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[TradeExpress Email] Login OTP email dispatched to ${email}. Message ID: ${info.messageId}`);

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[TradeExpress Email Preview URL]: ${previewUrl}`);
    }

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (error) {
    console.error(`[TradeExpress Email Error] Failed to send login OTP email to ${email}:`, error.message);
    return { success: false, error: error.message };
  }
}

export async function sendSupplierVerificationOtpEmail({ email, name = 'Supplier Partner', otp, purpose = 'registration' }) {
  try {
    const transporter = await getTransporter();
    const fromAddress =
      (ENV.SMTP_HOST && ENV.SMTP_HOST.includes('gmail')) || (ENV.SMTP_USER && ENV.SMTP_USER.includes('@gmail.com'))
        ? `TradeExpress Security <${ENV.SMTP_USER}>`
        : ENV.SMTP_FROM;

    const isKyc = purpose === 'kyc' || purpose === 'verification';
    const isBuyer = purpose === 'buyer_registration' || purpose === 'buyer';
    const title = isKyc
      ? 'Supplier KYC Email Verification'
      : isBuyer
      ? 'Buyer Account Email Verification'
      : 'Supplier Registration Email Verification';
    const actionText = isKyc
      ? 'verify your official company email address for your Supplier KYC & Statutory documents review.'
      : isBuyer
      ? 'verify your official work email address and complete your TradeExpress buyer registration.'
      : 'verify your official work email address and complete your TradeExpress supplier onboarding.';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff; color: #1e293b;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; padding: 6px 14px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 9999px; color: #047857; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">
            TradeExpress Marketplace
          </div>
          <h2 style="color: #0f172a; margin-top: 14px; margin-bottom: 6px; font-size: 22px; font-weight: 800;">${title}</h2>
          <p style="color: #64748b; font-size: 13px; margin: 0;">Official Verification Code</p>
        </div>

        <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 14px;">Hello <strong>${name || (isBuyer ? 'Buyer Partner' : 'Supplier Partner')}</strong>,</p>
        <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 20px;">
          Please use the one-time password (OTP) below to ${actionText}
        </p>

        <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 22px 16px; text-align: center; margin-bottom: 22px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">Your 6-Digit Verification Code</div>
          <div style="font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #047857; font-family: monospace;">${otp}</div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">Valid for 10 minutes · Do not share with anyone</div>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px 14px; margin-bottom: 22px;">
          <p style="font-size: 12px; color: #166534; margin: 0; line-height: 1.5;">
            🔒 <strong>Security Notice:</strong> TradeExpress staff will never ask for your verification code or account password over phone, SMS, or WhatsApp.
          </p>
        </div>

        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
          TradeExpress B2B Wholesale Marketplace · Automated Security System
        </p>
      </div>
    `;

    const mailOptions = {
      from: fromAddress,
      to: email,
      subject: isBuyer
        ? `Your TradeExpress Buyer Verification Code: ${otp}`
        : `Your TradeExpress Supplier Verification Code: ${otp}`,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[TradeExpress Email] Supplier verification OTP email dispatched to ${email}. Message ID: ${info.messageId}`);

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[TradeExpress Verification Email Preview URL]: ${previewUrl}`);
    }

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (error) {
    console.error(`[TradeExpress Email Error] Failed to send supplier verification OTP email to ${email}:`, error.message);
    return { success: false, error: error.message };
  }
}


