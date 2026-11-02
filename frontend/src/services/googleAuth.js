// "Continue with Google" using Google Identity Services (OAuth 2.0 authorization-code flow, popup).
//
// The browser only receives a one-time code from Google's own account chooser. The backend exchanges
// it with Google and verifies the ID token, so identity is never taken from anything typed in this app.

import { authFetch } from '../api/authClient';

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
const GIS_SRC = 'https://accounts.google.com/gsi/client';

export const isGoogleSignInConfigured = Boolean(CLIENT_ID);

/** Thrown when the user closes Google's window without choosing an account. Not an error to display. */
export class GoogleSignInCancelled extends Error {
  constructor() {
    super('Google sign-in was cancelled.');
    this.name = 'GoogleSignInCancelled';
  }
}

let gisLoader = null;
function loadGoogleIdentityServices() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisLoader) {
    gisLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => (window.google?.accounts?.oauth2 ? resolve() : reject(new Error('Google sign-in did not load correctly.')));
      script.onerror = () => {
        gisLoader = null; // allow a retry
        reject(new Error('Google sign-in could not be loaded. Check your connection, or allow accounts.google.com if a blocker is active.'));
      };
      document.head.appendChild(script);
    });
  }
  return gisLoader;
}

/** Opens Google's account chooser and resolves with the one-time authorization code. */
async function requestAuthorizationCode() {
  if (!isGoogleSignInConfigured) throw new Error('Google sign-in is not set up on TradeExpress yet.');
  await loadGoogleIdentityServices();

  return new Promise((resolve, reject) => {
    const state = crypto.randomUUID(); // ties Google's reply to this request
    const client = window.google.accounts.oauth2.initCodeClient({
      client_id: CLIENT_ID,
      scope: 'openid email profile',
      ux_mode: 'popup',
      select_account: true,
      state,
      callback: (response) => {
        if (response.error) {
          if (response.error === 'access_denied') reject(new GoogleSignInCancelled());
          else reject(new Error(response.error_description || 'Google sign-in failed. Please try again.'));
          return;
        }
        if (response.state !== state || !response.code) {
          reject(new Error('Google sign-in could not be confirmed. Please try again.'));
          return;
        }
        resolve(response.code);
      },
      error_callback: (error) => {
        if (error?.type === 'popup_closed') reject(new GoogleSignInCancelled());
        else if (error?.type === 'popup_failed_to_open') reject(new Error('Google\'s sign-in window was blocked. Please allow pop-ups for this site and try again.'));
        else reject(new Error('Google sign-in failed. Please try again.'));
      },
    });
    client.requestCode();
  });
}

/**
 * Full Google sign-in. Resolves with the server result:
 *   { status: 'SIGNED_IN', user, token, isNewUser } or
 *   { status: 'SUPPLIER_SIGNUP_REQUIRED', email, name, emailVerificationToken }.
 * Throws GoogleSignInCancelled if the user closes Google's window, or an Error with a readable message.
 */
export async function signInWithGoogle(role = 'buyer') {
  const code = await requestAuthorizationCode();
  const res = await authFetch('/auth/google', { method: 'POST', body: JSON.stringify({ code, role: String(role).toUpperCase() }) });
  if (!res.ok || !res.data?.success || !res.data.data) {
    throw new Error(res.data?.message || res.error || 'Google sign-in failed. Please try again.');
  }
  return res.data.data;
}
