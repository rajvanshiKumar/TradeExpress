/*
 * Fetches a portal's page code in the background (when the browser is idle), so opening any page from the
 * sidebar shows it at once instead of waiting for its code. Each page is fetched once per visit; a failed
 * fetch is simply retried by React when the page is opened.
 */

const PORTAL_PAGES = {
  buyer: [
    () => import('../pages/buyer/BuyerDashboard'),
    () => import('../pages/buyer/BuyerOrders'),
    () => import('../pages/buyer/BuyerQuotes'),
    () => import('../pages/Messages'),
    () => import('../pages/buyer/BuyerPayments'),
    () => import('../pages/buyer/BuyerNotifications'),
    () => import('../pages/buyer/BuyerDocuments'),
    () => import('../pages/buyer/BuyerAddresses'),
  ],
};

const started = new Set();

export function preloadPortalPages(role) {
  const pages = PORTAL_PAGES[role];
  if (!pages || started.has(role) || typeof window === 'undefined') return;
  started.add(role);
  const whenIdle = window.requestIdleCallback || ((fn) => window.setTimeout(fn, 1200));
  // One page at a time, so the current page's own requests always go first
  const next = (i) => {
    if (i >= pages.length) return;
    whenIdle(() => {
      pages[i]().catch(() => {}).finally(() => next(i + 1));
    });
  };
  next(0);
}
