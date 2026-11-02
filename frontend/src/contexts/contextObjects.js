import { createContext } from 'react';

/*
 * Every app-wide React context object is created here, once.
 *
 * This module has no dependencies besides React, so it is never re-executed when a provider file
 * (AuthContext.jsx, NotificationContext.jsx, ...) or anything those files import changes. During
 * development, Vite re-runs provider files on hot update; if a provider file created its own context,
 * the re-run would create a second context object, and components still holding the first one
 * (e.g. ToastViewport via useNotifications) would read an empty context and crash.
 *
 * Providers import their context from here and re-export it, so existing imports keep working.
 */

function namedContext(displayName) {
  const context = createContext(null);
  context.displayName = displayName;
  return context;
}

export const AuthContext = namedContext('AuthContext');
export const NotificationContext = namedContext('NotificationContext');
export const ProductContext = namedContext('ProductContext');
export const WishlistContext = namedContext('WishlistContext');
export const CartContext = namedContext('CartContext');
export const InquiryContext = namedContext('InquiryContext');
export const MessageContext = namedContext('MessageContext');
export const OrderContext = namedContext('OrderContext');
export const LanguageContext = namedContext('LanguageContext');

// Editing this file would replace every context at once, so ask Vite for a full page reload instead.
if (import.meta.hot) import.meta.hot.decline();
