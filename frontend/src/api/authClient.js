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
  candidates.push('http://localhost:5000/api');
  candidates.push('http://127.0.0.1:5000/api');

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

  for (const candidate of candidates) {
    const url = `${candidate}${fullEndpoint}`;
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(options.headers || {}),
        },
      });

      const contentType = response.headers.get('content-type') || '';
      // If we got an HTML response (e.g. Vite SPA index.html fallback for unhandled route),
      // this candidate did not reach the backend API. Skip to next candidate.
      if (contentType.includes('text/html') || response.status === 404) {
        continue;
      }

      // Valid API response received (success or 4xx/5xx from Express)
      verifiedWorkingBase = candidate;

      let data = null;
      const text = await response.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }
      }

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

  console.error('All authentication server endpoints failed to connect:', lastNetworkError);
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
