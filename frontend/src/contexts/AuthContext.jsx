import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { useLocation } from 'react-router-dom';
import { AuthContext } from './contextObjects';
import useLocalStorage from '../hooks/useLocalStorage';
import seedUsers, { DEFAULT_NOTIFICATION_PREFS } from '../data/users';
import { ADMIN_EMAIL, ADMIN_EMAILS, ADMIN_PASSWORD_HASH, ADMIN_PROFILE, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PROFILE, isAdminConfigured } from '../config/admin';
import { DEFAULT_PREFERENCES, STORAGE_KEYS } from '../utils/constants';
import { normalizeEmail } from '../utils/validators';
import { hashPassword, isCryptoAvailable, verifyPassword } from '../utils/passwords';
import { fullKey, removeStorage } from '../utils/storage';
import makeId from '../utils/ids';
import { authFetch } from '../api/authClient';
import {
  AUTH_CHANGED_EVENT,
  EMPTY_SESSION,
  TOKEN_KEYS,
  bindWindow,
  getAuthToken,
  readRoleSession,
  rememberActiveSlot,
  resolveWindowSlot,
  roleSessionKey,
  signOutWindow,
  slotForPath,
  slotForRole,
  storeAuthToken,
  writeRoleSession,
} from '../utils/authSession';
import addressService from '../services/addressService';

// Front-end prototype authentication.
export { AuthContext };

const PUBLIC_ROLES = ['buyer', 'supplier'];
const SESSION_HOURS = 12;
const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 30;
const GENERIC_FAILURE = 'The email or password is incorrect.';
const CONNECTION_FAILURE = 'Unable to connect to the authentication server. Please check your connection and try again.';

// Only a rejected password is reported as wrong credentials. An outage, rate limit or blocked account says so,
// otherwise a correct password looks wrong.
const adminFailureMessage = (res) => {
  if (res.status === 0) return CONNECTION_FAILURE;
  if (res.status >= 500) return 'The server could not complete sign-in. Please try again shortly.';
  if (res.status === 403 || res.status === 429) return res.data?.message || GENERIC_FAILURE;
  return GENERIC_FAILURE;
};
// How often an open window checks whether its own login has expired
const SESSION_CHECK_MS = 30 * 1000;

const newSession = (userId, role) => ({ userId, role, expiresAt: Date.now() + SESSION_HOURS * 3600 * 1000 });

export function AuthProvider({ children }) {
  const [accounts, setAccounts] = useLocalStorage(STORAGE_KEYS.accounts, seedUsers, { syncWindows: true });
  const { pathname } = useLocation();
  // Which role this window acts as, and that role's session. Other windows can act as other roles at the same time.
  const [slot, setSlot] = useState(() => resolveWindowSlot(pathname));
  const [session, setSessionState] = useState(() => readRoleSession(slot));

  // Opening a dashboard whose role is signed in makes this window act as that role, before the page below renders
  const pathSlot = slotForPath(pathname);
  if (pathSlot && pathSlot !== slot && readRoleSession(pathSlot).userId) {
    bindWindow(pathSlot);
    setSlot(pathSlot);
    setSessionState(readRoleSession(pathSlot));
  }

  const slotRef = useRef(slot);
  slotRef.current = slot;

  /** Signs this window in as the session's role, or signs its current role out. Other roles are not touched. */
  const setSession = useCallback((next) => {
    if (next?.userId) {
      const nextSlot = slotForRole(next.role);
      writeRoleSession(nextSlot, next);
      bindWindow(nextSlot);
      setSlot(nextSlot);
      setSessionState(next);
    } else {
      signOutWindow();
      setSlot(null);
      setSessionState(EMPTY_SESSION);
    }
  }, []);
  const [preferences, setPreferenceState] = useLocalStorage(STORAGE_KEYS.preferences, DEFAULT_PREFERENCES);
  // Buyer addresses live in MySQL; this is only the loaded copy for the signed-in buyer.
  const [addressState, setAddressState] = useState({ ownerId: null, items: [], loading: false, error: '' });
  const [attempts, setAttempts] = useState({ count: 0, lockedUntil: 0 });

  // Resolve the signed-in user from the stored session. Anything invalid counts as signed out.
  const user = useMemo(() => {
    if (!session?.userId || !session.expiresAt || session.expiresAt < Date.now()) return null;
    if (session.role === 'super_admin') return SUPER_ADMIN_PROFILE;
    if (session.role === 'admin') return ADMIN_PROFILE;
    const accountList = Array.isArray(accounts) ? accounts : [];
    const found = accountList.find((account) => account && account.id === session.userId && PUBLIC_ROLES.includes(account.role));
    return found && found.status !== 'Suspended' && found.role === session.role ? found : null;
  }, [accounts, session]);

  // Follows this window's own role only: a sign-in or sign-out of that role elsewhere, an expired login, or a token
  // the server rejected. Changes to other roles are ignored, so they can never sign this window out.
  useEffect(() => {
    const refresh = () => setSessionState((current) => {
      const latest = readRoleSession(slotRef.current);
      return latest.userId === current.userId && latest.role === current.role && latest.expiresAt === current.expiresAt ? current : latest;
    });
    const onStorage = (event) => {
      const own = slotRef.current;
      if (own && (!event.key || event.key === TOKEN_KEYS[own] || event.key === fullKey(roleSessionKey(own)))) refresh();
    };
    const onFocus = () => {
      rememberActiveSlot(slotRef.current);
      refresh();
    };
    const timer = window.setInterval(refresh, SESSION_CHECK_MS);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    window.addEventListener(AUTH_CHANGED_EVENT, refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(AUTH_CHANGED_EVENT, refresh);
    };
  }, []);

  const lockMessage = () => {
    const seconds = Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
    return seconds > 0 ? `Too many failed attempts. Please wait ${seconds} seconds and try again.` : '';
  };

  const recordFailure = () => setAttempts((previous) => {
    const count = previous.count + 1;
    return count >= MAX_ATTEMPTS ? { count: 0, lockedUntil: Date.now() + LOCK_SECONDS * 1000 } : { ...previous, count };
  });

  /** Admin / Super Admin sign-in */
  const loginAdmin = useCallback(async (email, password) => {
    const clean = normalizeEmail(email).toLowerCase();
    const cleanPassword = typeof password === 'string' ? password.trim() : '';

    const adminList = Array.isArray(ADMIN_EMAILS) ? ADMIN_EMAILS : [ADMIN_EMAIL];
    const isAdminEmail = adminList.some((addr) => addr.toLowerCase() === clean) || clean === ADMIN_EMAIL.toLowerCase();

    if (!isAdminEmail) {
      recordFailure();
      return { ok: false, error: GENERIC_FAILURE };
    }

    // The backend is the only authority: it checks the password and returns the account's role.
    // No passwords or credentials are kept in the browser code.
    let isSuper = false;
    let valid = false;
    let failure = CONNECTION_FAILURE;
    try {
      const res = await authFetch('/auth/admin-login', {
        method: 'POST',
        body: JSON.stringify({ email: clean, password: cleanPassword || password }),
      });
      const role = res.data?.data?.user?.role;
      if (res.ok && res.data?.success && res.data.data?.token && (role === 'SUPER_ADMIN' || role === 'ADMIN')) {
        storeAuthToken(res.data.data.token);
        valid = true;
        isSuper = role === 'SUPER_ADMIN';
      } else {
        failure = adminFailureMessage(res);
      }
    } catch {
      // Server unreachable: reported as a connection problem below
    }

    if (!valid) {
      if (failure === GENERIC_FAILURE) recordFailure();
      return { ok: false, error: failure };
    }

    setAttempts({ count: 0, lockedUntil: 0 });
    const targetProfile = isSuper ? SUPER_ADMIN_PROFILE : ADMIN_PROFILE;
    const targetRole = isSuper ? 'super_admin' : 'admin';
    startTransition(() => {
      setSession(newSession(targetProfile.id, targetRole));
    });
    return { ok: true, user: targetProfile };
  }, [setSession]);

  /** Buyer or supplier sign-in. Resolves { ok, user } or { ok: false, error }. */
  const login = useCallback(async (email, password, expectedRole = null, options = {}) => {
    const locked = lockMessage();
    if (locked) return { ok: false, error: locked };
    if (!isCryptoAvailable()) return { ok: false, error: 'Sign-in needs a secure connection (https or localhost).' };
    const clean = normalizeEmail(email).toLowerCase();

    // Try backend sign-in with email, password, role, and email OTP
    let backendUser = null;
    try {
      const res = await authFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: clean,
          password,
          role: expectedRole ? expectedRole.toUpperCase() : undefined,
          otp: options?.otp,
          country: options?.country || 'India',
        }),
      });

      if (!res.ok || !res.data?.success) {
        recordFailure();
        return { ok: false, error: res.data?.message || res.error || GENERIC_FAILURE };
      }

      if (res.data?.data?.token) {
        storeAuthToken(res.data.data.token);
        backendUser = res.data.data.user;
      }
    } catch (err) {
      console.warn('Backend login connection error:', err);
      return { ok: false, error: err?.message || 'Unable to connect to the authentication server. Please try again.' };
    }

    if (!backendUser) {
      recordFailure();
      return { ok: false, error: GENERIC_FAILURE };
    }

    let activeAccount = accounts.find((item) => item.email.toLowerCase() === clean);
    const resolvedRole = (backendUser.role || activeAccount?.role || expectedRole || 'buyer').toLowerCase();

    if (activeAccount) {
      activeAccount = {
        ...backendUser,
        ...activeAccount,
        id: backendUser.id,
        status: backendUser.status === 'SUSPENDED' ? 'Suspended' : 'Active',
        name: backendUser.name || activeAccount.name,
        role: resolvedRole,
        company: backendUser.company || backendUser.companyName || activeAccount.company || '',
        companyId: backendUser.companyId || activeAccount.companyId || null,
        phone: backendUser.phone || activeAccount.phone || '',
        kycStatus: backendUser.kycStatus || activeAccount.kycStatus || 'PENDING',
        kycRejectionReason: backendUser.kycRejectionReason || activeAccount.kycRejectionReason || null,
        isVerified: backendUser.isVerified !== undefined ? Boolean(backendUser.isVerified) : Boolean(activeAccount.isVerified),
      };
      setAccounts((prev) => [activeAccount, ...prev.filter((a) => a.email.toLowerCase() !== clean)]);
    } else {
      activeAccount = {
        ...backendUser,
        id: backendUser.id,
        status: backendUser.status === 'SUSPENDED' ? 'Suspended' : 'Active',
        name: backendUser.name,
        email: backendUser.email,
        role: resolvedRole,
        company: backendUser.company || backendUser.companyName || '',
        companyId: backendUser.companyId || null,
        country: backendUser.country || 'India',
        city: backendUser.city || '',
        phone: backendUser.phone || '',
        kycStatus: backendUser.kycStatus || 'PENDING',
        kycRejectionReason: backendUser.kycRejectionReason || null,
        isVerified: Boolean(backendUser.isVerified),
        joinedAt: backendUser.createdAt || new Date().toISOString(),
        notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
        passwordHash: '',
      };
      setAccounts((prev) => [activeAccount, ...prev.filter((a) => a.email.toLowerCase() !== clean)]);
    }

    if (activeAccount.status === 'Suspended') {
      return { ok: false, error: 'This account has been suspended. Please contact TradeExpress.' };
    }

    setAttempts({ count: 0, lockedUntil: 0 });
    startTransition(() => {
      setSession(newSession(activeAccount.id, activeAccount.role));
    });
    return { ok: true, user: activeAccount };
  }, [accounts, attempts, setSession, setAccounts]);

  /** Buyer or supplier sign-in via Mobile number and OTP */
  const loginMobile = useCallback(async ({ phone, country = 'India', otp, role = null }) => {
    const locked = lockMessage();
    if (locked) return { ok: false, error: locked };
    const cleanOtp = String(otp || '').trim();
    if (!cleanOtp) return { ok: false, error: 'Please enter the verification OTP.' };

    let backendUser = null;
    try {
      const res = await authFetch('/auth/login-mobile', {
        method: 'POST',
        body: JSON.stringify({
          phone,
          country,
          otp: cleanOtp,
          role: role ? role.toUpperCase() : undefined,
        }),
      });

      if (!res.ok || !res.data?.success) {
        recordFailure();
        return { ok: false, error: res.data?.message || res.error || 'Mobile OTP verification failed.' };
      }

      if (res.data?.data?.token) {
        storeAuthToken(res.data.data.token);
        backendUser = res.data.data.user;
      }
    } catch (err) {
      return { ok: false, error: err?.message || 'Unable to connect to the authentication server. Please try again.' };
    }

    if (!backendUser) {
      recordFailure();
      return { ok: false, error: 'Mobile sign-in failed. Please verify your OTP.' };
    }

    let activeAccount = accounts.find((item) => item.id === backendUser.id || item.email?.toLowerCase() === backendUser.email?.toLowerCase());
    if (!activeAccount) {
      activeAccount = {
        id: backendUser.id,
        status: backendUser.status === 'SUSPENDED' ? 'Suspended' : 'Active',
        name: backendUser.name,
        email: backendUser.email,
        role: (backendUser.role || role || 'buyer').toLowerCase(),
        company: backendUser.company || backendUser.companyName || '',
        companyId: backendUser.companyId || null,
        country: backendUser.country || country || 'India',
        city: backendUser.city || '',
        phone: backendUser.phone || phone,
        joinedAt: backendUser.createdAt || new Date().toISOString(),
        notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
      };
      setAccounts((prev) => [activeAccount, ...prev.filter((a) => a.id !== activeAccount.id)]);
    }

    if (activeAccount.status === 'Suspended') {
      return { ok: false, error: 'This account has been suspended. Please contact TradeExpress.' };
    }

    setAttempts({ count: 0, lockedUntil: 0 });
    startTransition(() => {
      setSession(newSession(activeAccount.id, activeAccount.role));
    });
    return { ok: true, user: activeAccount };
  }, [accounts, setAccounts, setSession, lockMessage, recordFailure]);

  /** Buyer or supplier sign-in via Email and OTP */
  const loginEmailOtp = useCallback(async ({ email, otp, role = null }) => {
    const cleanEmail = normalizeEmail(email).toLowerCase();
    const cleanOtp = String(otp || '').trim();
    if (!cleanEmail) return { ok: false, error: 'Email address is required.' };
    if (!cleanOtp) return { ok: false, error: 'Please enter the verification OTP.' };
    return login(cleanEmail, null, role, { otp: cleanOtp });
  }, [login]);

  /** Registers a Buyer or Supplier. Only a password hash is saved. Admin can never be chosen here. */
  const register = useCallback(async ({ name, email, password, company, country, city, phone, role, verificationToken, emailVerificationToken }) => {
    if (!PUBLIC_ROLES.includes(role)) return { ok: false, error: 'Please choose Buyer or Supplier.' };
    if (!isCryptoAvailable()) return { ok: false, error: 'Registration needs a secure connection (https or localhost).' };
    const clean = normalizeEmail(email);
    
    // Register directly on backend MySQL database first
    let backendUser = null;
    try {
      const res = await authFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: clean,
          password,
          role: role.toUpperCase(),
          company: company?.trim() || '',
          companyName: company?.trim() || '',
          phone: phone || '',
          city: city?.trim() || '',
          country: country || 'India',
          verificationToken: verificationToken || '',
          emailVerificationToken: emailVerificationToken || '',
        }),
      });

      if (!res.ok || !res.data?.success) {
        return { ok: false, error: res.data?.message || res.error || 'An account with this email already exists.' };
      }

      if (res.data?.data) {
        backendUser = res.data.data.user;
        if (res.data.data.token) {
          storeAuthToken(res.data.data.token);
        }
      }
    } catch (err) {
      console.warn('Backend registration failed.');
      if (String(role).toLowerCase() === 'buyer') {
        return { ok: false, error: err?.message || 'Unable to reach the registration server. Please try again.' };
      }
    }

    // Only if backend was unreachable, fall back to checking local memory
    if (!backendUser && (clean === ADMIN_EMAIL || accounts.some((item) => item.email.toLowerCase() === clean))) {
      return { ok: false, error: 'An account with this email already exists.' };
    }

    const account = {
      id: backendUser?.id || makeId('TS-U'), status: 'Active', name: name.trim(), email: clean, role, company: company.trim(), companyId: null,
      country, city: city.trim(), phone, joinedAt: backendUser?.createdAt || new Date().toISOString(), notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
      passwordHash: await hashPassword(password),
    };
    // Replace any stale local entry for this email and save the new verified account
    setAccounts((previous) => [account, ...previous.filter((item) => item.email.toLowerCase() !== clean)]);
    setSession(newSession(account.id, account.role));
    return { ok: true, user: account };
  }, [accounts, setAccounts, setSession]);

  /** Directly sets session and local account state from successful backend auth */
  const setAuthUser = useCallback(async (backendUser, token, rawPassword = '') => {
    if (!backendUser?.id) return null;
    if (token) {
      storeAuthToken(token);
    }
    const cleanRole = (backendUser.role || 'buyer').toLowerCase();
    const activeAccount = {
      id: backendUser.id,
      status: backendUser.status === 'SUSPENDED' ? 'Suspended' : 'Active',
      name: backendUser.name || 'User',
      email: backendUser.email?.toLowerCase(),
      role: cleanRole,
      company: backendUser.company || backendUser.companyName || '',
      companyId: backendUser.companyId || null,
      country: backendUser.country || 'India',
      city: backendUser.city || '',
      phone: backendUser.phone || '',
      avatarUrl: backendUser.avatarUrl || null,
      joinedAt: backendUser.createdAt || new Date().toISOString(),
      notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
      passwordHash: rawPassword ? await hashPassword(rawPassword) : '',
    };
    setAccounts((prev) => [activeAccount, ...prev.filter((a) => a.id !== activeAccount.id && a.email?.toLowerCase() !== activeAccount.email)]);
    startTransition(() => {
      setSession(newSession(activeAccount.id, activeAccount.role));
    });
    return activeAccount;
  }, [setAccounts, setSession]);

  /** Signs out and clears session-related data (the Buy Now selection). The cart is kept. */
  const logout = useCallback(() => {
    // End this role's session on the server too, so its token stops working (best effort). Only this token is ended.
    const token = getAuthToken();
    if (token) authFetch('/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    if (slotRef.current === 'buyer') removeStorage(STORAGE_KEYS.buyNow);
    startTransition(() => {
      setSession(EMPTY_SESSION);
    });
    setAttempts({ count: 0, lockedUntil: 0 });
  }, [setSession]);

  const updateAccount = useCallback((id, patch) => {
    // Role and password hash can never be changed through profile updates.
    const { role, passwordHash, ...safe } = patch; // eslint-disable-line no-unused-vars
    setAccounts((previous) => previous.map((item) => (item.id === id ? { ...item, ...safe } : item)));
  }, [setAccounts]);

  const updateProfile = useCallback((patch) => {
    if (user && user.role !== 'admin') updateAccount(user.id, patch);
  }, [user, updateAccount]);

  const setPreferences = useCallback((patch) => setPreferenceState((previous) => ({ ...previous, ...patch })), [setPreferenceState]);

  // Public view of accounts for the admin lists: password hashes are left out.
  const publicAccounts = useMemo(() => accounts.map(({ passwordHash, ...rest }) => ({ ...rest, canSignIn: Boolean(passwordHash) })), [accounts]); // eslint-disable-line no-unused-vars

  /* ---------- buyer address book (MySQL via /api/auth/addresses) ---------- */
  const buyerId = user?.role === 'buyer' ? user.id : null;

  const reloadAddresses = useCallback(async () => {
    if (!buyerId) return [];
    setAddressState((previous) => ({ ...previous, ownerId: buyerId, loading: true, error: '' }));
    try {
      const items = await addressService.list();
      setAddressState({ ownerId: buyerId, items, loading: false, error: '' });
      return items;
    } catch (error) {
      setAddressState((previous) => ({ ...previous, ownerId: buyerId, loading: false, error: error.message }));
      return null;
    }
  }, [buyerId]);

  // Load on sign-in and drop the previous buyer's addresses on sign-out or account switch.
  useEffect(() => {
    if (!buyerId) {
      setAddressState({ ownerId: null, items: [], loading: false, error: '' });
      return;
    }
    reloadAddresses();
  }, [buyerId, reloadAddresses]);

  const addresses = useMemo(() => (addressState.ownerId === buyerId ? addressState.items : []), [addressState, buyerId]);
  const addressesLoading = addressState.loading || (Boolean(buyerId) && addressState.ownerId !== buyerId);

  /** Creates or updates an address on the server, then refreshes the list. Throws ApiRequestError on failure. */
  const saveAddress = useCallback(async (values) => {
    const saved = values.id ? await addressService.update(values.id, values) : await addressService.create(values);
    await reloadAddresses();
    return saved;
  }, [reloadAddresses]);

  const deleteAddress = useCallback(async (id) => {
    await addressService.remove(id);
    await reloadAddresses();
  }, [reloadAddresses]);

  const setDefaultAddress = useCallback(async (id) => {
    const saved = await addressService.setDefault(id);
    await reloadAddresses();
    return saved;
  }, [reloadAddresses]);

  const value = useMemo(() => ({
    user, accounts: publicAccounts, isAuthenticated: Boolean(user), login, loginMobile, loginEmailOtp, loginAdmin, register, setAuthUser, logout, updateProfile, updateAccount,
    preferences, setPreferences, addresses, addressesLoading, addressesError: addressState.error, reloadAddresses, saveAddress, deleteAddress, setDefaultAddress, isAdminConfigured,
  }), [user, publicAccounts, login, loginMobile, loginEmailOtp, loginAdmin, register, setAuthUser, logout, updateProfile, updateAccount, preferences, setPreferences,
    addresses, addressesLoading, addressState.error, reloadAddresses, saveAddress, deleteAddress, setDefaultAddress]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
