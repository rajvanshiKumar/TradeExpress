/**
 * Resilient Authentication API Client
 * Provides automatic multi-target fallback between:
 * 1. Direct backend (http://localhost:5000/api, http://127.0.0.1:5000/api)
 * 2. Configured public API (VITE_PUBLIC_API_BASE_URL)
 * 3. Vite reverse proxy (/api/auth)
 *
 * Ensures all login, OTP, and registration calls are completely immune to:
 * - CORS preflight issues (fully supported by backend)
 * - Missing proxy routes
 * - HTML fallback pages
 * - Host resolution / IPv6 vs IPv4 differences
 */

let verifiedWorkingBase = null;

/**
 * A 404 means "this target does not serve the auth API, try the next one" only when the reply is not
 * an API answer: an HTML page, a non-JSON body, or the backend's unmatched-route handler.
 * A JSON 404 from a real auth route (e.g. "No account found with this email", code ACCOUNT_NOT_FOUND)
 * is a genuine answer and must reach the caller instead of being reported as a connection failure.
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

export function getAuthBaseCandidates() {
  const envBase = (import.meta.env?.VITE_PUBLIC_API_BASE_URL || '').trim().replace(/\/+$/, '');
  const candidates = [];

  // Prioritize previously verified working target
  if (verifiedWorkingBase) {
    candidates.push(verifiedWorkingBase);
  }

  // 1. Explicit env configuration or direct backend loopbacks
  if (envBase) {
    candidates.push(envBase);
  }
  // Local backend fallbacks only for development, or when the site itself is opened on this computer.
  // A deployed page must never probe the visitor's own machine.
  const isDevBuild = import.meta.env?.DEV !== false;
  const onLocalhost = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(window.location?.hostname || '');
  if (isDevBuild || onLocalhost) {
    candidates.push('http://localhost:5000/api');
    candidates.push('http://127.0.0.1:5000/api');
  }

  // 2. Relative reverse proxy
  if (typeof window !== 'undefined' && window.location) {
    candidates.push('/api');
  }

  // Deduplicate preserving order
  return candidates.filter((item, index, self) => item && self.indexOf(item) === index);
}

/**
 * Resiliently executes an authentication HTTP request with candidate failover.
 * @param {string} endpoint - Path such as '/auth/login', '/auth/login-mobile', '/auth/send-mobile-login-otp'
 * @param {RequestInit} [options] - Standard fetch options
 * @returns {Promise<{ ok: boolean, status: number, data: any, response?: Response, error?: string }>}
 */
export async function authFetch(endpoint, options = {}) {
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.slice(4);
  }
  const fullEndpoint = cleanEndpoint.startsWith('/auth') ? cleanEndpoint : `/auth${cleanEndpoint}`;

  const candidates = getAuthBaseCandidates();
  let lastNetworkError = null;
  const requestSignal = options.signal || AbortSignal.timeout(12000);

  for (const candidate of candidates) {
    const url = `${candidate}${fullEndpoint}`;
    try {
      const response = await fetch(url, {
        ...options,
        signal: requestSignal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(options.headers || {}),
        },
      });

      const contentType = response.headers.get('content-type') || '';
      // HTML (e.g. Vite SPA index.html fallback) or an unmatched-route 404 means this candidate did not
      // reach the auth API. Skip to next candidate.
      if (contentType.includes('text/html')) {
        continue;
      }
      const data = parseBody(await response.text());
      if (isMissingRouteResponse(response.status, contentType, data)) {
        continue;
      }

      // Valid API response received (success or 4xx/5xx from Express, including JSON 404 answers)
      verifiedWorkingBase = candidate;

      return {
        ok: response.ok,
        status: response.status,
        data: data || {},
        response,
      };
    } catch (err) {
      lastNetworkError = err;
      if (verifiedWorkingBase === candidate) {
        verifiedWorkingBase = null;
      }
      // Try next candidate
    }
  }

  console.error('All authentication server endpoints failed to connect.', lastNetworkError?.name || 'NetworkError');
  return {
    ok: false,
    status: 0,
    data: {
      success: false,
      message: 'Unable to connect to the authentication server. Please ensure the backend is running.',
    },
    error: 'Unable to connect to the authentication server. Please check your connection.',
  };
}
