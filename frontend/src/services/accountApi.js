// Account Settings API (signed-in user's own account only; the server takes the identity from the login token).
import { ApiRequestError, authorizedRequest } from './authorizedApi';

const BASE_URL = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').trim().replace(/\/+$/, '') || '/api';

export const getAccountSettings = () => authorizedRequest('GET', 'account/settings');

export const updateAccountProfile = (changes) => authorizedRequest('PATCH', 'account/profile', changes);

export const removeAccountAvatar = () => authorizedRequest('DELETE', 'account/avatar');

// Verified changes. purpose: PASSWORD_CHANGE | EMAIL_CHANGE_CURRENT. The authorization ("grant") stays in memory only.
export const sendAccountCode = (purpose) => authorizedRequest('POST', 'account/verification/send', { purpose });
export const verifyAccountCode = (purpose, otp) => authorizedRequest('POST', 'account/verification/verify', { purpose, otp });
export const changePasswordWithCode = ({ grant, newPassword, confirmPassword }) => authorizedRequest('POST', 'account/password/change', { grant, newPassword, confirmPassword });
export const requestEmailChange = ({ grant, newEmail }) => authorizedRequest('POST', 'account/email/request-change', { grant, newEmail });
export const completeEmailChange = ({ grant, otp }) => authorizedRequest('POST', 'account/email/verify-new', { grant, otp });

/** Uploads a profile photo (PNG, JPG or WEBP, at most 2 MB). Returns the updated account settings. */
export async function uploadAccountAvatar(file) {
  let token = null;
  try {
    token = localStorage.getItem('tradeexpress_auth_token') || localStorage.getItem('tradesphere_auth_token');
  } catch {
    token = null;
  }
  if (!token) throw new ApiRequestError('Please sign in again to continue.', 401);

  const formData = new FormData();
  formData.append('photo', file);
  let response;
  try {
    response = await fetch(`${BASE_URL}/account/avatar`, {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: formData,
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new ApiRequestError('The photo could not be uploaded. Please check your connection and try again.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new ApiRequestError(response.status === 401 ? 'Your session has expired. Please sign in again.' : (data?.message || 'The photo could not be uploaded.'), response.status);
  }
  return data.data;
}
