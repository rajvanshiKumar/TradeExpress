import { ROLE_HOME } from './constants.js';
import { slotForPath, slotForRole } from './authSession.js';

/**
 * Where a successful sign-in or sign-up lands (password, OTP, Google; buyer and supplier sign-up).
 *
 * - Buyers and suppliers land on the Home page ("/"). Their dashboards open only when they choose them
 *   (profile menu, or a dashboard link they followed).
 * - Admin and Super Admin keep their console, as before.
 * - When sign-in was asked for by a specific page or action (a protected page, "Contact supplier", wishlist),
 *   `from` brings the user back there, provided their role may open it.
 */
export function postAuthPath(user, from) {
  const role = user?.role;
  const home = role === 'admin' || role === 'super_admin' ? (ROLE_HOME[role] || '/') : '/';
  if (!from || typeof from !== 'string' || !from.startsWith('/')) return home;
  if (from.includes('/login') || from.includes('/sign-in') || from.includes('/register')) return home;

  const roleMayOpen = role === 'admin'
    ? from.startsWith('/admin') || from === '/messages'
    : role === 'super_admin'
      ? from.startsWith('/super-admin') || from.startsWith('/admin') || from === '/messages'
      : !from.startsWith('/admin') && !from.startsWith('/super-admin');
  // Never return to another role's dashboard: that would switch this window to that role
  const sameRoleArea = !slotForPath(from) || slotForPath(from) === slotForRole(role);
  return roleMayOpen && sameRoleArea ? from : home;
}
