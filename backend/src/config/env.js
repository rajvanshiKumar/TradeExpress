import dotenv from 'dotenv';
dotenv.config();

const jwtSecret = process.env.JWT_SECRET?.trim();
const jwtSecretLooksLikePlaceholder = /^(your|replace|change|example|placeholder)|secret|password|default/i.test(jwtSecret || '');
if (!jwtSecret || Buffer.byteLength(jwtSecret, 'utf8') < 32 || new Set(jwtSecret).size < 12 || jwtSecretLooksLikePlaceholder) {
  throw new Error(
    'Invalid JWT_SECRET. Set a random secret with at least 32 UTF-8 bytes and 12 distinct characters. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"'
  );
}

const configuredFrontendOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const ENV = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  CORS_ORIGINS: configuredFrontendOrigins,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  RAZORPAY_KEY_ID: (process.env.RAZORPAY_KEY_ID || '').trim(),
  RAZORPAY_KEY_SECRET: (process.env.RAZORPAY_KEY_SECRET || '').trim(),
  RAZORPAY_WEBHOOK_SECRET: (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim(),
  PAYMENT_GATEWAY_MODE: (process.env.PAYMENT_GATEWAY_MODE || 'sandbox').trim().toLowerCase(),
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.ethereal.email',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'TradeSphere Marketplace <orders@tradesphere.com>',
  DEV_OTP_ENABLED: process.env.DEV_OTP_ENABLED === 'true' && process.env.NODE_ENV !== 'production',
  // Google Sign-In (OAuth 2.0 authorization-code flow). The secret must stay server-side.
  GOOGLE_CLIENT_ID: (process.env.GOOGLE_CLIENT_ID || '').trim(),
  GOOGLE_CLIENT_SECRET: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
};


