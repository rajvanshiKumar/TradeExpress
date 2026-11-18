import { API_BASE_URL } from '../config/api.js';

/**
 * Authentication API client (login, OTP, registration).
 *
 * Every call goes to the backend named in VITE_PUBLIC_API_BASE_URL (frontend/.env), through src/config/api.js.
 * There is no hidden fallback: if that backend cannot be reached, or answers with a web page instead of the
 * API (for example a tunnel's sign-in or warning page), the caller gets a clear error. It never silently
 * switches to localhost or another server.
 */

/**
 * True when a reply is not an answer from the auth API: an HTML page, a non-JSON 404, or the backend's
 * unmatched-route handler. A JSON 404 from a real auth route (e.g. "No account found with this email",
 * code ACCOUNT_NOT_FOUND) is a genuine answer and must reach the caller.
 */
export function isMissingRouteResponse(status, contentType, data) {
  if (String(contentType || '').includes('text/html')) return true;
  if (status !== 404) return false;
  if (!String(contentType || '').includes('json') || !data || typeof data !== 'object') return true;
  return /^API Route not found/i.test(String(data.message || ''));
}

const parseBody = (text) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const failure = (status, message) => ({
  ok: false,
  status,
  data: { success: false, message },
  error: message,
});

/**
 * Executes an authentication HTTP request against the configured backend.
 * @param {string} endpoint - Path such as '/auth/login', '/auth/login-mobile', '/auth/send-mobile-login-otp'
 * @param {RequestInit & { timeoutMs?: number }} [options] - Standard fetch options
 * @returns {Promise<{ ok: boolean, status: number, data: any, response?: Response, error?: string }>}
 */
export async function authFetch(endpoint, options = {}) {
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.slice(4);
  }
  const fullEndpoint = cleanEndpoint.startsWith('/auth') ? cleanEndpoint : `/auth${cleanEndpoint}`;
  const { timeoutMs = 30000, ...fetchOptions } = options;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${fullEndpoint}`, {
      ...fetchOptions,
      signal: fetchOptions.signal || AbortSignal.timeout(timeoutMs),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(fetchOptions.headers || {}),
      },
    });
  } catch (err) {
    console.error('The authentication server could not be reached.', err?.name || 'NetworkError');
    return failure(0, 'Unable to connect to the authentication server. Please ensure the backend is running and reachable.');
  }

  const contentType = response.headers.get('content-type') || '';
  const data = parseBody(await response.text());
  if (isMissingRouteResponse(response.status, contentType, data)) {
    console.error(`The backend address in VITE_PUBLIC_API_BASE_URL did not answer as the TradeExpress API (${API_BASE_URL}).`);
    return failure(0, 'Unable to connect to the authentication server. The configured backend address did not answer as the TradeExpress API.');
  }

  return {
    ok: response.ok,
    status: response.status,
    data: data || {},
    response,
  };
}
