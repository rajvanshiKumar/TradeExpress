import { authorizedRequest } from './authorizedApi';

/** Signed-in buyer's cart in the database (every call answers with the whole cart: { items, totals }). */
export const getCart = () => authorizedRequest('GET', 'cart');
export const addItem = ({ productId, sku, slug, quantity, variant }) => authorizedRequest('POST', 'cart/items', { productId, sku, slug, quantity, variant });
export const updateItem = (itemId, quantity) => authorizedRequest('PATCH', `cart/items/${encodeURIComponent(itemId)}`, { quantity });
export const removeItem = (itemId) => authorizedRequest('DELETE', `cart/items/${encodeURIComponent(itemId)}`);
export const clearCart = () => authorizedRequest('DELETE', 'cart');
/** Guest -> buyer merge after sign-in; answers with the cart plus { skipped } for lines that no longer apply. */
export const mergeGuestCart = (items) => authorizedRequest('POST', 'cart/merge', { items });
