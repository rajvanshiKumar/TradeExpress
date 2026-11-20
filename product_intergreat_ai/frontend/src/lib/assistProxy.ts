/** Pure helpers for the server-side proxy to the Form Assistant service (see app/api/assist). */

export const ASSIST_MODULES = ["rfq", "order-address", "transport-vehicle", "transport-driver"] as const;
export const MAX_BODY_BYTES = 13 * 1024 * 1024; // 4 document images as base64 + text

/**
 * Maps /api/assist/<segments> to the upstream path, or null when the request is not allowed.
 * Only the documented endpoints are reachable; the proxy never forwards arbitrary paths.
 */
export function upstreamPath(segments: string[], method: string): string | null {
  if (segments.length === 1 && segments[0] === "health" && method === "GET") return "/health";
  if (segments.length !== 2) return null;
  const [module, action] = segments;
  if (!(ASSIST_MODULES as readonly string[]).includes(module)) return null;
  if (action === "assist" && method === "POST") return `/v1/${module}/assist`;
  if (action === "fields" && method === "GET") return `/v1/${module}/fields`;
  return null;
}

/** Browsers send Origin on cross-site requests; reject when it does not match this host. */
export function isSameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin) return true; // same-origin GETs and non-browser clients
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function errorBody(code: string, message: string): string {
  return JSON.stringify({ error: { code, message, details: null } });
}
