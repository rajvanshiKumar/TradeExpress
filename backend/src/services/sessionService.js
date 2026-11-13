import prisma from '../config/db.js';
import { ENV } from '../config/env.js';
import { signJwt } from '../utils/jwt.js';
import { getRequestContext } from '../utils/requestContext.js';

/**
 * Signed-in devices ("Active Login Sessions"). Every login token carries a session id (sid). A session can be signed
 * out on its own; "sign out of all other devices" also moves the account's sessionsValidAfter cut-off so tokens
 * issued before session tracking stop working too.
 */

const LAST_SEEN_REFRESH_MS = 5 * 60 * 1000;
const SESSION_CACHE_TTL_MS = 20 * 1000; // 20-second in-memory cache to stop hammering MySQL on rapid requests

// In-memory caches for active sessions and user auth details
const sessionCache = new Map(); // sid -> { session, cachedAt }
const userAuthCache = new Map(); // userId -> { user, cachedAt }

/** Invalidates in-memory session and user auth cache when user logs out or modifies session state. */
export function invalidateSessionCache(sessionId = null, userId = null) {
  if (sessionId) {
    sessionCache.delete(String(sessionId));
  }
  if (userId) {
    userAuthCache.delete(String(userId));
    for (const [key, val] of sessionCache.entries()) {
      if (val?.session?.userId === String(userId)) {
        sessionCache.delete(key);
      }
    }
  }
}

/** Fetches user authentication profile with a short 20-second cache to prevent redundant per-request SELECT queries. */
export async function getCachedUser(userId) {
  if (!userId) return null;
  const uid = String(userId);
  const now = Date.now();
  const cached = userAuthCache.get(uid);
  if (cached && (now - cached.cachedAt) < SESSION_CACHE_TTL_MS) {
    return cached.user;
  }

  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      adminRole: true,
      adminPermissions: true,
      isActive: true,
      status: true,
      statusReason: true,
      company: true,
      phone: true,
      city: true,
      country: true,
      sessionsValidAfter: true,
    },
  });

  if (user) {
    userAuthCache.set(uid, { user, cachedAt: now });
  } else {
    userAuthCache.delete(uid);
  }
  return user;
}

/** "7d" / "12h" / "30m" -> milliseconds (the login token lifetime). */
function lifetimeMs(value = ENV.JWT_EXPIRES_IN) {
  const match = /^(\d+)\s*([smhd])?$/.exec(String(value || '7d').trim());
  if (!match) return 7 * 86400000;
  const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2] || 's'];
  return Number(match[1]) * unit;
}

/** Short, human description of a browser user-agent, e.g. "Chrome on Windows". */
export function describeDevice(userAgent = '') {
  const ua = String(userAgent || '');
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari'
      : /node|undici|curl|PostmanRuntime|axios/i.test(ua) ? 'API client' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : null;
  return os ? `${browser} on ${os}` : browser;
}

/** Records a new signed-in device and returns its login token. */
export async function issueLoginToken(user, { method = 'PASSWORD', email } = {}) {
  const { ipAddress, userAgent } = getRequestContext();
  const session = await prisma.userSession.create({
    data: {
      userId: user.id,
      method,
      ipAddress,
      userAgent,
      device: describeDevice(userAgent),
      expiresAt: new Date(Date.now() + lifetimeMs()),
    },
  });
  return signJwt({ userId: user.id, email: email || user.email, role: user.role, sid: session.id });
}

/**
 * A fresh token for the device making this request (after a password or email change). Keeps the same session when
 * the request came from a tracked session; otherwise records a new one.
 */
export async function reissueCurrentToken(user, { email, method = 'PASSWORD' } = {}) {
  const { sessionId } = getRequestContext();
  if (sessionId) {
    const session = await prisma.userSession.findFirst({ where: { id: sessionId, userId: user.id, revokedAt: null } });
    if (session) return signJwt({ userId: user.id, email: email || user.email, role: user.role, sid: session.id });
  }
  return issueLoginToken(user, { method, email });
}

/**
 * Validates the session a token belongs to. Returns false when it was signed out or has expired. Tokens issued before
 * session tracking (no sid) are accepted; "sign out of all other devices" ends them through sessionsValidAfter.
 */
export async function isSessionActive(payload) {
  if (!payload?.sid) return true;
  const sid = String(payload.sid);
  const now = Date.now();
  const cached = sessionCache.get(sid);
  let session = null;

  if (cached && (now - cached.cachedAt) < SESSION_CACHE_TTL_MS) {
    session = cached.session;
  } else {
    session = await prisma.userSession.findUnique({
      where: { id: sid },
      select: { userId: true, revokedAt: true, expiresAt: true, lastSeenAt: true },
    });
    if (session) {
      sessionCache.set(sid, { session, cachedAt: now });
    } else {
      sessionCache.delete(sid);
    }
  }

  if (!session || session.userId !== payload.userId || session.revokedAt || session.expiresAt < new Date()) {
    sessionCache.delete(sid);
    return false;
  }

  const lastSeenTime = session.lastSeenAt ? new Date(session.lastSeenAt).getTime() : 0;
  if (now - lastSeenTime > LAST_SEEN_REFRESH_MS) {
    session.lastSeenAt = new Date();
    prisma.userSession.update({ where: { id: sid }, data: { lastSeenAt: session.lastSeenAt } }).catch(() => {});
  }
  const context = getRequestContext();
  if (context) context.sessionId = sid;
  return true;
}

function maskIp(ip) {
  if (!ip) return null;
  if (ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') return 'this computer (local)';
  const v4 = ip.replace(/^::ffff:/, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return `${v4.split('.').slice(0, 3).join('.')}.x`;
  return `${ip.split(':').slice(0, 3).join(':')}:…`;
}

export async function listSessions(userId) {
  const { sessionId } = getRequestContext();
  const sessions = await prisma.userSession.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: 'desc' },
    take: 50,
  });
  return {
    currentSessionId: sessionId,
    sessions: sessions.map((s) => ({
      id: s.id,
      current: s.id === sessionId,
      device: s.device || describeDevice(s.userAgent),
      method: s.method,
      ipAddress: maskIp(s.ipAddress),
      signedInAt: s.createdAt,
      lastActiveAt: s.lastSeenAt,
      expiresAt: s.expiresAt,
    })),
  };
}

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/** Signs one device out (signing out the current device is the same as logging out). */
export async function revokeSession(user, sessionId) {
  invalidateSessionCache(sessionId, user.id);
  const { count } = await prisma.userSession.updateMany({ where: { id: String(sessionId), userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!count) throw fail('That device is already signed out.', 404);
  await prisma.auditLog.create({ data: { actorId: user.id, actorEmail: user.email, actorRole: user.role, action: 'SESSION_REVOKED', resource: 'ACCOUNT', targetId: user.id, details: { sessionId }, result: 'SUCCESS' } }).catch(() => {});
  return { revoked: true };
}

/** Logout: ends the session the request came from. */
export async function revokeCurrentSession(userId) {
  const { sessionId } = getRequestContext();
  invalidateSessionCache(sessionId, userId);
  if (!sessionId) return { revoked: false };
  await prisma.userSession.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return { revoked: true };
}

/** Signs out every other device (including sign-ins from before session tracking) and keeps this one. */
export async function revokeOtherSessions(user) {
  const { sessionId } = getRequestContext();
  invalidateSessionCache(null, user.id);
  const cutoff = new Date(Math.floor(Date.now() / 1000) * 1000);
  const { count } = await prisma.$transaction(async (tx) => {
    const result = await tx.userSession.updateMany({
      where: { userId: user.id, revokedAt: null, ...(sessionId ? { id: { not: sessionId } } : {}) },
      data: { revokedAt: new Date() },
    });
    await tx.user.update({ where: { id: user.id }, data: { sessionsValidAfter: cutoff } });
    return result;
  });
  // The cut-off also ends this device's current token, so it gets a fresh one for the same session
  const token = await reissueCurrentToken(user);
  await prisma.auditLog.create({ data: { actorId: user.id, actorEmail: user.email, actorRole: user.role, action: 'SESSIONS_REVOKED_OTHERS', resource: 'ACCOUNT', targetId: user.id, details: { revoked: count }, result: 'SUCCESS' } }).catch(() => {});
  return { revoked: count, token };
}
