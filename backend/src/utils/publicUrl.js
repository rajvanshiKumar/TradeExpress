import { ENV } from '../config/env.js';

const HOST_PATTERN = /^[a-z0-9.-]+(:\d{1,5})?$/i;

/**
 * The backend's public address, used to build links to files it serves (e.g. https://abc-5000.inc1.devtunnels.ms).
 * 1. PUBLIC_BACKEND_URL from backend/.env, when set.
 * 2. Otherwise the address the request arrived on, including through a tunnel or proxy (X-Forwarded-Proto/Host),
 *    so a backend opened through devtunnels or Render returns https links on that address, never localhost.
 */
export function publicBackendUrl(req) {
  if (ENV.PUBLIC_BACKEND_URL) return ENV.PUBLIC_BACKEND_URL;
  const first = (value) => String(value || '').split(',')[0].trim();
  const proto = first(req.get('x-forwarded-proto')) || req.protocol || 'http';
  const host = [first(req.get('x-forwarded-host')), first(req.get('host'))].find((h) => HOST_PATTERN.test(h)) || '';
  return host ? `${proto === 'https' ? 'https' : 'http'}://${host}` : '';
}
