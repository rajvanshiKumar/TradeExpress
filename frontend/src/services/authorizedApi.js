// Authenticated JSON requests for signed-in account features (address book, saved payment methods).
// Uses the configured API base URL, or the Vite dev proxy at /api when none is set.

import { getAuthToken, handleRejectedToken } from '../utils/authSession.js';

const BASE_URL = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').trim().replace(/\/+$/, '') || '/api';
export const API_BASE = BASE_URL;

export class ApiRequestError extends Error {
  constructor(message, status = 0, fieldErrors = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/** Uploads one file to /api/upload and returns { url, fileUrl, fileName, ... }. Throws ApiRequestError on failure. */
export async function uploadFile(file, { timeoutMs = 60000 } = {}) {
  const formData = new FormData();
  formData.append('file', file);
  const token = getAuthToken();
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

/** Fetches a protected file. Resolves to { blob, fileName }. Throws ApiRequestError on failure. */
export async function authorizedBlob(path, { timeoutMs = 60000 } = {}) {
  const token = getAuthToken();
  if (!token) throw new ApiRequestError('Please sign in again to continue.', 401);
  let response;
  try {
    response = await fetch(`${BASE_URL}/${String(path).replace(/^\/+/, '')}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new ApiRequestError('Unable to reach the TradeExpress server. Please check your connection and try again.');
  }
  if (!response.ok) {
    if (response.status === 401) handleRejectedToken(token);
    const data = await response.json().catch(() => null);
    throw new ApiRequestError(data?.message || `The server responded with status ${response.status}.`, response.status);
  }
  const disposition = response.headers.get('content-disposition') || '';
  const blob = await response.blob();
  const fallback = `TradeExpress-document${blob.type.includes('pdf') ? '.pdf' : ''}`;
  return { blob, fileName: /filename="([^"]+)"/.exec(disposition)?.[1] || fallback };
}

/** Sends an authenticated request and returns the response's `data`. Throws ApiRequestError on failure. */
export async function authorizedRequest(method, path, body, { timeoutMs = 15000 } = {}) {
  const token = getAuthToken();
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
    if (response.status === 401) handleRejectedToken(token);
    const fieldErrors = Object.fromEntries((data?.errors || []).filter((e) => e.field).map((e) => [e.field, e.message]));
    const message = response.status === 401
      ? 'Your session has expired. Please sign in again.'
      : data?.message || `The server responded with status ${response.status}.`;
    const error = new ApiRequestError(message, response.status, fieldErrors);
    // Server error code and retry time (e.g. resend cooldown), for screens that react to them
    error.code = data?.code;
    error.cooldownRemaining = data?.cooldownRemaining;
    throw error;
  }
  return data.data;
}
