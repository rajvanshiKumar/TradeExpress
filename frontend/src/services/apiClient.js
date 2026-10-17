// Optional public API adapter.
//
// TradeSphere ships with NO external API configured: every service works from seeded
// local data. If you have a real, CORS-enabled public API, set VITE_PUBLIC_API_BASE_URL
// (and, for the catalogue, VITE_PUBLIC_API_PRODUCTS_PATH) in a .env file. Nothing in
// this file invents endpoints: it only calls the base URL and paths you provide.
//
// Never put private keys in VITE_ variables: they are bundled into the public site.

const BASE_URL = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

export const isApiConfigured = Boolean(BASE_URL);

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request(method, path, body = null, { signal, timeoutMs = 12000, headers = {} } = {}) {
  if (!isApiConfigured) throw new ApiError('No public API is configured.', 0);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  signal?.addEventListener('abort', () => controller.abort());

  const reqHeaders = {
    Accept: 'application/json',
    ...headers,
  };

  const options = {
    method,
    headers: reqHeaders,
    signal: controller.signal,
  };

  if (body !== null && body !== undefined) {
    reqHeaders['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  // Check for stored token
  try {
    const token = localStorage.getItem('tradesphere_auth_token');
    if (token && !reqHeaders.Authorization) {
      reqHeaders.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Ignore localStorage access issues
  }

  try {
    const url = `${BASE_URL}/${String(path).replace(/^\/+/, '')}`;
    const response = await fetch(url, options);
    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const message = data?.message || data?.error || `The API responded with status ${response.status}.`;
      throw new ApiError(message, response.status, data);
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(error.name === 'AbortError' ? 'The API request timed out.' : (error.message || 'The API could not be reached.'), 0);
  } finally {
    window.clearTimeout(timer);
  }
}

/** GET a JSON resource from the configured public API. */
export async function apiGet(path, options) {
  return request('GET', path, null, options);
}

/** POST data to the configured public API. */
export async function apiPost(path, body, options) {
  return request('POST', path, body, options);
}

/** PUT data to the configured public API. */
export async function apiPut(path, body, options) {
  return request('PUT', path, body, options);
}

/** PATCH data to the configured public API. */
export async function apiPatch(path, body, options) {
  return request('PATCH', path, body, options);
}

/** DELETE a resource on the configured public API. */
export async function apiDelete(path, options) {
  return request('DELETE', path, null, options);
}

