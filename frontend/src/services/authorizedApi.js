// Authenticated JSON requests for signed-in account features (address book, saved payment methods).
// Uses the configured API base URL, or the Vite dev proxy at /api when none is set.

const BASE_URL = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').trim().replace(/\/+$/, '') || '/api';

export class ApiRequestError extends Error {
  constructor(message, status = 0, fieldErrors = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function authToken() {
  try {
    return localStorage.getItem('tradeexpress_auth_token') || localStorage.getItem('tradesphere_auth_token');
  } catch {
    return null;
  }
}

/** Uploads one file to /api/upload and returns { url, fileUrl, fileName, ... }. Throws ApiRequestError on failure. */
export async function uploadFile(file, { timeoutMs = 60000 } = {}) {
  const formData = new FormData();
  formData.append('file', file);
  const token = authToken();
  let response;
  try {
    response = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new ApiRequestError('The file could not be uploaded. Please check your connection and try again.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success || !data.data?.fileUrl) {
    throw new ApiRequestError(data?.message || `Upload failed (status ${response.status}).`, response.status);
  }
  return data.data;
}

/** Sends an authenticated request and returns the response's `data`. Throws ApiRequestError on failure. */
export async function authorizedRequest(method, path, body, { timeoutMs = 15000 } = {}) {
  const token = authToken();
  if (!token) throw new ApiRequestError('Please sign in again to continue.', 401);

  let response;
  try {
    response = await fetch(`${BASE_URL}/${String(path).replace(/^\/+/, '')}`, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new ApiRequestError('Unable to reach the TradeExpress server. Please check your connection and try again.');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    const fieldErrors = Object.fromEntries((data?.errors || []).filter((e) => e.field).map((e) => [e.field, e.message]));
    const message = response.status === 401
      ? 'Your session has expired. Please sign in again.'
      : data?.message || `The server responded with status ${response.status}.`;
    throw new ApiRequestError(message, response.status, fieldErrors);
  }
  return data.data;
}
