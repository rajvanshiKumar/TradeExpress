import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NotificationContext } from './contextObjects';
import useLocalStorage from '../hooks/useLocalStorage';
import seedNotifications from '../data/notifications';
import { STORAGE_KEYS } from '../utils/constants';
import makeId from '../utils/ids';
import { AuthContext } from './AuthContext';
import { apiGet, apiPatch, isApiConfigured } from '../services/apiClient';

// Two things live here: short-lived toasts, and the saved notification list shown in the header.
export { NotificationContext };

const matchesUser = (notification, user) =>
  Boolean(user) && (
    notification.audience === 'all' ||
    notification.audience === user.id ||
    notification.audience === `role:${user.role}` ||
    (user.companyId && notification.audience === `company:${user.companyId}`)
  );

const NOTIFICATION_POLL_INTERVAL_MS = 45000; // 45 seconds (within 30-60s requirement)
const MIN_VISIBILITY_REFRESH_MS = 30000;

export function NotificationProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [all, setAll] = useLocalStorage(STORAGE_KEYS.notifications, seedNotifications);
  const [backendItems, setBackendItems] = useState([]);
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const inFlightRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  const abortControllerRef = useRef(null);

  const fetchBackendNotifications = useCallback(async (force = false) => {
    if (!user?.id || !isApiConfigured) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible' && !force) {
      return;
    }
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Use authenticated session token identity; do not pass untrusted userId parameters
      const res = await apiGet('notifications?limit=50', { signal: controller.signal });
      lastFetchTimeRef.current = Date.now();
      const list = res?.data?.notifications || (Array.isArray(res?.data) ? res.data : []);
      if (res && res.success && Array.isArray(list)) {
        const mapped = list.map((n) => ({
          id: n.id,
          audience: n.userId || user.id,
          type: n.type?.toLowerCase() || 'orders',
          rawType: n.type,
          title: n.title,
          body: n.message || n.body,
          message: n.message || n.body,
          link: n.link || '',
          read: Boolean(n.read || n.isRead),
          isRead: Boolean(n.read || n.isRead),
          at: n.createdAt || n.at || new Date().toISOString(),
          createdAt: n.createdAt || n.at || new Date().toISOString(),
          isBackend: true,
        }));
        setBackendItems(mapped);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[TradeExpress] Could not sync backend notifications:', err.message);
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [user?.id]);

  // Centralized polling with tab visibility guard and automatic cleanup
  useEffect(() => {
    if (!user?.id || !isApiConfigured) {
      setBackendItems([]);
      abortControllerRef.current?.abort();
      return;
    }

    fetchBackendNotifications(true);

    const interval = setInterval(() => {
      fetchBackendNotifications(false);
    }, NOTIFICATION_POLL_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastFetchTimeRef.current;
        if (elapsed >= MIN_VISIBILITY_REFRESH_MS) {
          fetchBackendNotifications(true);
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      abortControllerRef.current?.abort();
      inFlightRef.current = false;
    };
  }, [user?.id, fetchBackendNotifications]);

  const dismissToast = useCallback((id) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  /**
   * tone: error | warning are shown. success | info are confirmations of a click, which the page itself already shows,
   * so they do not pop up. Use 'warning' for guidance a person must see, such as "Please sign in".
   */
  const showToast = useCallback((message, tone = 'success') => {
    if (tone !== 'error' && tone !== 'warning') return null;
    const id = makeId('toast');
    setToasts((previous) => [...previous.slice(-3), { id, message, tone }]);
    timers.current.set(id, window.setTimeout(() => dismissToast(id), 4200));
    return id;
  }, [dismissToast]);

  /** Saves a notification for a user, a company ("company:<id>") or a role ("role:<role>"). */
  const addNotification = useCallback(({ audience, type = 'orders', title, body, link = '' }) => {
    // Respect the signed-in user's own notification preferences.
    if (user && audience === user.id && user.notificationPrefs?.[type] === false) return;
    setAll((previous) => [{ id: makeId('TS-N'), audience, type, title, body, link, read: false, at: new Date().toISOString() }, ...previous].slice(0, 80));
  }, [setAll, user]);

  const notifications = useMemo(() => {
    const localUserNotifications = all.filter((item) => matchesUser(item, user));
    // Merge backend and local items by unique id/title, sorted newest first
    const seen = new Set();
    const combined = [...backendItems, ...localUserNotifications].filter((item) => {
      const key = `${item.id}-${item.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return combined.sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [all, backendItems, user]);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  const markRead = useCallback((id) => {
    setAll((previous) => previous.map((item) => (item.id === id ? { ...item, read: true } : item)));
    setBackendItems((previous) => previous.map((item) => (item.id === id ? { ...item, read: true } : item)));

    if (isApiConfigured && id) {
      apiPatch(`notifications/${encodeURIComponent(id)}/read`, {}).catch(() => { });
    }
  }, [setAll]);

  const markAllRead = useCallback(() => {
    setAll((previous) => previous.map((item) => (matchesUser(item, user) ? { ...item, read: true } : item)));
    setBackendItems((previous) => previous.map((item) => ({ ...item, read: true })));

    if (isApiConfigured && user?.id) {
      apiPatch('notifications/read-all', {}).catch(() => { });
    }
  }, [setAll, user]);

  const clearNotifications = useCallback(() => {
    setAll((previous) => previous.filter((item) => !matchesUser(item, user)));
    setBackendItems([]);
  }, [setAll, user]);

  const value = useMemo(() => ({
    toasts, showToast, dismissToast, notifications, unreadCount, addNotification, markRead, markAllRead, clearNotifications, refreshNotifications: fetchBackendNotifications,
  }), [toasts, showToast, dismissToast, notifications, unreadCount, addNotification, markRead, markAllRead, clearNotifications, fetchBackendNotifications]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
