// Keeps the page session consistent with the stored login token (see AuthContext).

/** Reads the (unverified) payload of a login token; the server still verifies every request. */
export function readTokenPayload(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * True when the stored login token belongs to the signed-in session: same role, same account (the Super Admin
 * session uses a fixed local profile id, so only the role is compared), and not expired.
 */
export function sessionMatchesToken(session, token) {
  if (!session?.userId) return true;
  const payload = readTokenPayload(token);
  if (!payload) return false;
  if (payload.exp && payload.exp * 1000 <= Date.now()) return false;
  if (String(payload.role || '').toLowerCase() !== session.role) return false;
  if (session.role === 'super_admin' || session.role === 'admin') return true;
  return payload.userId === session.userId;
}
