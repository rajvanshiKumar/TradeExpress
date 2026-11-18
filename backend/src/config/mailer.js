import nodemailer from 'nodemailer';
import { ENV } from './env.js';

let transporter = null;

/** SMTP wait limit in ms (SMTP_TIMEOUT_MS, default 8000, kept between 3000 and 30000). */
export function smtpTimeoutMs(value = process.env.SMTP_TIMEOUT_MS) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 8000;
  return Math.min(30000, Math.max(3000, parsed));
}
const SMTP_TIMEOUT_MS = smtpTimeoutMs();

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
      // Reuse open SMTP connections: a new connection + TLS + login costs ~1.5 s on every OTP email otherwise
      pool: true,
      maxConnections: 3,
      // Fail fast when the mail server cannot be reached (nodemailer waits 2 minutes by default). The default 8 s
      // stays below the sign-in page's 12 s request limit, so the user gets the real "could not send the
      // verification email" message instead of "unable to connect". Configurable with SMTP_TIMEOUT_MS.
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
      auth: {
        user: ENV.SMTP_USER,
        pass: ENV.SMTP_PASS,
      },
    });
  } else {
    // Generate an automatic Ethereal test account in development if no SMTP credentials are set
    try {
      const testAccount = await nodemailer.createTestAccount();
      console.log('[TradeExpress Mailer] Using Ethereal test account for email delivery:', testAccount.user);
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
      console.warn('[TradeExpress Mailer] Could not create Ethereal account, falling back to mock transport:', err.message);
      transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
    }
  }

  return transporter;
}
