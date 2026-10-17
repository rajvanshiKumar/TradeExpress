import nodemailer from 'nodemailer';
import { ENV } from './env.js';

let transporter = null;

export async function getTransporter() {
  if (transporter) return transporter;

  if (ENV.SMTP_USER && ENV.SMTP_PASS) {
    const isGmail = (ENV.SMTP_HOST && ENV.SMTP_HOST.includes('gmail')) || (ENV.SMTP_USER && ENV.SMTP_USER.endsWith('@gmail.com'));
    const port = ENV.SMTP_PORT || 587;
    // Port 587 uses STARTTLS (secure: false). Port 465 uses SSL/TLS (secure: true).
    const secure = port === 465 ? true : (port === 587 ? false : Boolean(ENV.SMTP_SECURE));

    transporter = nodemailer.createTransport({
      host: isGmail ? 'smtp.gmail.com' : ENV.SMTP_HOST,
      port,
      secure,
      auth: {
        user: ENV.SMTP_USER,
        pass: ENV.SMTP_PASS,
      },
    });
  } else {
    // Generate an automatic Ethereal test account in development if no SMTP credentials are set
    try {
      const testAccount = await nodemailer.createTestAccount();
      console.log('[TradeSphere Mailer] Using Ethereal test account for email delivery:', testAccount.user);
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    } catch (err) {
      console.warn('[TradeSphere Mailer] Could not create Ethereal account, falling back to mock transport:', err.message);
      transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
    }
  }

  return transporter;
}
