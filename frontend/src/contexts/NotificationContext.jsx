import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import seedNotifications from '../data/notifications';
import { STORAGE_KEYS } from '../utils/constants';
import makeId from '../utils/ids';
import { AuthContext } from './AuthContext';

// Two things live here: short-lived toasts, and the saved notification list shown in the header.
export const NotificationContext = createContext(null);

const matchesUser = (notification, user) =>
  Boolean(user) && (notification.audience === user.id || notification.audience === `role:${user.role}` || (user.companyId && notification.audience === `company:${user.companyId}`));

export function NotificationProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [all, setAll] = useLocalStorage(STORAGE_KEYS.notifications, seedNotifications);
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

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

  const notifications = useMemo(() => all.filter((item) => matchesUser(item, user)), [all, user]);
  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  const markRead = useCallback((id) => setAll((previous) => previous.map((item) => (item.id === id ? { ...item, read: true } : item))), [setAll]);
  const markAllRead = useCallback(() => {
    setAll((previous) => previous.map((item) => (matchesUser(item, user) ? { ...item, read: true } : item)));
  }, [setAll, user]);
  const clearNotifications = useCallback(() => setAll((previous) => previous.filter((item) => !matchesUser(item, user))), [setAll, user]);

  const value = useMemo(() => ({
    toasts, showToast, dismissToast, notifications, unreadCount, addNotification, markRead, markAllRead, clearNotifications,
  }), [toasts, showToast, dismissToast, notifications, unreadCount, addNotification, markRead, markAllRead, clearNotifications]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
