import { ENV } from './env.js';

function isLocalhostOrigin(origin) {
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'http:' && (
      host === 'localhost' ||
      host === '[::1]' ||
      /^127(?:\.\d{1,3}){3}$/.test(host)
    );
  } catch {
    return false;
  }
}

export function isAllowedCorsOrigin(origin) {
  if (!origin) return true; // Non-browser clients do not send an Origin header.
  if (ENV.CORS_ORIGINS.includes(origin)) return true;
  return ENV.NODE_ENV !== 'production' && isLocalhostOrigin(origin);
}

export function corsOriginCallback(origin, callback) {
  callback(null, isAllowedCorsOrigin(origin));
}
