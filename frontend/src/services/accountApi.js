import { getAuthToken } from '../utils/authSession.js';
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

// Change phone: the new number is verified by SMS (same endpoints as signup), then the change is applied
export const sendPhoneCode = (phone) => authorizedRequest('POST', 'auth/send-mobile-otp', { phone, country: 'India' });
export const verifyPhoneCode = (phone, otp) => authorizedRequest('POST', 'auth/verify-mobile-otp', { phone, country: 'India', otp });
export const changePhone = ({ grant, phone, verificationToken }) => authorizedRequest('POST', 'account/phone/change', { grant, phone, country: 'India', verificationToken });

// Account deletion (Buyers and Suppliers). Uses an ACCOUNT_DELETE authorization from a verified email code.
export const getDeletionStatus = () => authorizedRequest('GET', 'account/delete/status');
export const deleteAccount = ({ grant, confirmation }) => authorizedRequest('POST', 'account/delete', { grant, confirmation }, { timeoutMs: 60000 });

/** Uploads a profile photo (PNG, JPG or WEBP, at most 2 MB). Returns the updated account settings. */
export async function uploadAccountAvatar(file) {
  const token = getAuthToken();
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

// Active login sessions (signed-in devices)
export const listSessions = () => authorizedRequest('GET', 'account/sessions');
export const revokeSession = (id) => authorizedRequest('POST', `account/sessions/${encodeURIComponent(id)}/revoke`);
export const revokeOtherSessions = () => authorizedRequest('POST', 'account/sessions/revoke-others');

// Preferences (applied by the platform) and personal data export
export const getPreferences = () => authorizedRequest('GET', 'account/preferences');
export const updatePreferences = (changes) => authorizedRequest('PATCH', 'account/preferences', changes);
export const exportAccountData = () => authorizedRequest('GET', 'account/data-export', undefined, { timeoutMs: 30000 });
