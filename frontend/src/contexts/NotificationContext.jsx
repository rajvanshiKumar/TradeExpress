import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import seedNotifications from '../data/notifications';
import { STORAGE_KEYS } from '../utils/constants';
import makeId from '../utils/ids';
import { AuthContext } from './AuthContext';
import { apiGet, apiPatch, isApiConfigured } from '../services/apiClient';

// Two things live here: short-lived toasts, and the saved notification list shown in the header.
export const NotificationContext = createContext(null);

const matchesUser = (notification, user) =>
  Boolean(user) && (notification.audience === user.id || notification.audience === `role:${user.role}` || (user.companyId && notification.audience === `company:${user.companyId}`));

export function NotificationProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [all, setAll] = useLocalStorage(STORAGE_KEYS.notifications, seedNotifications);
  const [backendItems, setBackendItems] = useState([]);
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  // Fetch backend notifications when user is authenticated
  useEffect(() => {
    if (!user?.id || !isApiConfigured) return;
    let isMounted = true;

    async function fetchBackendNotifications() {
      try {
        const res = await apiGet(`notifications?userId=${encodeURIComponent(user.id)}`);
        if (isMounted && res && res.success && res.data?.notifications) {
          const mapped = res.data.notifications.map((n) => ({
            id: n.id,
            audience: n.userId,
            type: n.type?.toLowerCase() || 'orders',
            title: n.title,
            body: n.message,
            link: n.link || '',
            read: n.read,
            at: n.createdAt,
            isBackend: true,
          }));
          setBackendItems(mapped);
        }
      } catch (err) {
        console.warn('[TradeExpress] Could not sync backend notifications:', err.message);
      }
    }

    fetchBackendNotifications();
    const interval = setInterval(fetchBackendNotifications, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user?.id]);

  const dismissToast = useCallback((id) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  /** tone: success | error | info */
  const showToast = useCallback((message, tone = 'success') => {
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
      apiPatch(`notifications/${encodeURIComponent(id)}/read`, {}).catch(() => {});
    }
  }, [setAll]);

  const markAllRead = useCallback(() => {
    setAll((previous) => previous.map((item) => (matchesUser(item, user) ? { ...item, read: true } : item)));
    setBackendItems((previous) => previous.map((item) => ({ ...item, read: true })));

    if (isApiConfigured && user?.id) {
      apiPatch(`notifications/read-all`, { userId: user.id }).catch(() => {});
    }
  }, [setAll, user]);

  const clearNotifications = useCallback(() => {
    setAll((previous) => previous.filter((item) => !matchesUser(item, user)));
    setBackendItems([]);
  }, [setAll, user]);

  const value = useMemo(() => ({
    toasts, showToast, dismissToast, notifications, unreadCount, addNotification, markRead, markAllRead, clearNotifications,
  }), [toasts, showToast, dismissToast, notifications, unreadCount, addNotification, markRead, markAllRead, clearNotifications]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
