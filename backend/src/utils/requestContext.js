import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request details (client IP, browser, signed-in session) available to services without passing `req` through
 * every call — used to record which device a sign-in came from.
 */
const storage = new AsyncLocalStorage();

export function requestContextMiddleware(req, res, next) {
  const ipAddress = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || req.ip || null;
  storage.run({ ipAddress, userAgent: String(req.headers['user-agent'] || '').slice(0, 500) || null, sessionId: null }, next);
}

export function getRequestContext() {
  return storage.getStore() || { ipAddress: null, userAgent: null, sessionId: null };
}
