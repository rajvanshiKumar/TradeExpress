/*
 * The one place the frontend learns where the backend is.
 *
 * Set VITE_PUBLIC_API_BASE_URL in frontend/.env (for example https://abc-5000.inc1.devtunnels.ms/api or
 * https://your-backend.onrender.com/api) and restart Vite: every API call, upload, image and socket uses it.
 * No backend host is written anywhere in the code. When the variable is empty, requests go to "/api" on the
 * same site as the page (a same-origin backend).
 */

const configured = String(import.meta.env?.VITE_PUBLIC_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

/** True when frontend/.env names a backend. */
export const IS_API_CONFIGURED = Boolean(configured);

/** Base of every REST call, e.g. "https://abc.devtunnels.ms/api" (or "/api" on the same site). */
export const API_BASE_URL = configured || '/api';

/** The backend's address without "/api": used for /uploads files and Socket.IO ("" means this site). */
export const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api$/i, '');

/** Full URL of an API path: apiUrl('/auth/login') and apiUrl('/api/auth/login') both give API_BASE_URL + "/auth/login". */
export function apiUrl(path = '') {
  let clean = String(path).startsWith('/') ? String(path) : `/${path}`;
  if (/^\/api(\/|$)/i.test(clean)) clean = clean.slice(4) || '/';
  return `${API_BASE_URL}${clean}`;
}

/** Full URL of a file the backend serves (e.g. "/uploads/x.jpg"); absolute and data: URLs are returned unchanged. */
export function backendFileUrl(path) {
  if (!path) return '';
  const value = String(path);
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return `${BACKEND_ORIGIN}${value.startsWith('/') ? '' : '/'}${value}`;
}
