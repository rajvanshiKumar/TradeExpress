import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CartContext } from './contextObjects';
import useLocalStorage from '../hooks/useLocalStorage';
import { BUY_NOW_TTL_MS, STORAGE_KEYS } from '../utils/constants';
import { calculateCartTotals, getLineTotal, getUnitPrice } from '../utils/calculateTotals';
import { readStorage, removeStorage } from '../utils/storage';
import { ProductContext } from './ProductContext';
import seedProducts from '../data/products';
import { NotificationContext } from './NotificationContext';
import { AuthContext } from './AuthContext';
import * as cartApi from '../services/cartApi';
import { isApiConfigured } from '../services/apiClient';

export { CartContext };

/*
 * Cart
 * - Signed-in buyer: the cart in the database is the only source. Every change goes to the server and the screen
 *   shows the server's answer (prices, MOQ and stock checked there). Nothing is shown as added until it is saved.
 * - Guest: a cart in this browser only ("cart-guest"), merged into the buyer's database cart when a buyer signs in.
 * - Sign-out / account switch: the visible cart is cleared at once; answers that arrive for a previous account
 *   are ignored. Saved carts in the database are never deleted by signing out.
 */

const GUEST_KEY = 'cart-guest';
const LEGACY_SHARED_KEY = STORAGE_KEYS.cart; // old cart shared by every account on the browser (owner unknown)

function getDefaultVariant(product) {
  if (!product) return null;
  const entries = Object.entries(product.variants ?? {}).filter(([, options]) => Array.isArray(options) && options.length);
  return entries.length ? Object.fromEntries(entries.map(([name, options]) => [name, options[0]])) : null;
}

/** Same rule as the server: key order and empty values do not matter. */
export function variantKey(variant) {
  if (!variant || typeof variant !== 'object') return '';
  const entries = Object.entries(variant).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => [String(k), String(v)]);
  entries.sort(([a], [b]) => a.localeCompare(b));
  return entries.length ? JSON.stringify(entries) : '';
}

/** Keeps a quantity between the product's MOQ and its stock. */
export function clampQuantity(product, quantity) {
  const wanted = Math.round(Number(quantity)) || product.moq;
  const max = Math.max(product.stock, product.moq);
  return Math.min(Math.max(wanted, product.moq), max);
}

export function CartProvider({ children }) {
  const { products, loading } = useContext(ProductContext);
  const { showToast } = useContext(NotificationContext);
  const { user } = useContext(AuthContext);
  const buyerId = user?.role === 'buyer' && isApiConfigured ? user.id : null;

  // Guest cart (this browser only). Stored shape: [{ productId, sku, slug, quantity, variant }]
  const [guestItems, setGuestItems] = useLocalStorage(GUEST_KEY, []);
  // Buyer cart from the server: { items: [...], totals } for buyerId
  const [server, setServer] = useState({ owner: null, items: [], loaded: false });
  const [busyKeys, setBusyKeys] = useState(() => new Set());
  const ownerRef = useRef(buyerId);
  ownerRef.current = buyerId;

  // The old shared cart cannot be attributed to any account, so it is never merged into one
  useEffect(() => { removeStorage(LEGACY_SHARED_KEY); }, []);

  /** Applies a server answer only if it still belongs to the signed-in buyer. */
  const applyServer = useCallback((owner, data) => {
    if (owner !== ownerRef.current) return false;
    setServer({ owner, items: Array.isArray(data?.items) ? data.items : [], loaded: true });
    return true;
  }, []);

  // Sign-in, sign-out and account switch
  useEffect(() => {
    setServer({ owner: buyerId, items: [], loaded: false });
    if (!buyerId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        // Explicit guest -> buyer merge (only when a buyer signs in on this browser)
        const guest = readStorage(GUEST_KEY, []);
        let data;
        if (Array.isArray(guest) && guest.length) {
          data = await cartApi.mergeGuestCart(guest.map(({ productId, sku, slug, quantity, variant }) => ({ productId, sku, slug, quantity, variant })));
          setGuestItems([]);
          if (data?.skipped?.length) showToast(`${data.skipped.length} item${data.skipped.length === 1 ? '' : 's'} from your earlier cart could not be added: ${data.skipped[0].reason}`, 'warning');
        } else {
          data = await cartApi.getCart();
        }
        if (!cancelled) applyServer(buyerId, data);
      } catch (err) {
        if (!cancelled && buyerId === ownerRef.current) {
          setServer({ owner: buyerId, items: [], loaded: true });
          if (err?.status !== 401) showToast(err?.message || 'Your cart could not be loaded.', 'error');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [buyerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Other tabs: reload the buyer cart when this tab becomes visible again (no polling)
  useEffect(() => {
    if (!buyerId) return undefined;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const owner = ownerRef.current;
      cartApi.getCart().then((data) => applyServer(owner, data)).catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [buyerId, applyServer]);

  /** Finds the catalogue product for a server line (same id, SKU or slug), else builds one from the server data. */
  const catalogueProductFor = useCallback((p) => products.find((entry) => entry.id === p.id || (p.sku && entry.sku === p.sku) || (p.slug && entry.slug === p.slug))
    || seedProducts.find((entry) => (p.sku && entry.sku === p.sku) || (p.slug && entry.slug === p.slug)) || null, [products]);

  /** Runs one server change for the signed-in buyer; refuses repeats of the same change while it is in flight. */
  const runServer = useCallback(async (key, call) => {
    const owner = ownerRef.current;
    if (!owner) return false;
    let duplicate = false;
    setBusyKeys((prev) => { if (prev.has(key)) { duplicate = true; return prev; } const next = new Set(prev); next.add(key); return next; });
    if (duplicate) return false;
    try {
      const data = await call();
      return applyServer(owner, data);
    } catch (err) {
      if (owner === ownerRef.current) showToast(err?.message || 'Your cart could not be updated. Please try again.', 'error');
      return false;
    } finally {
      setBusyKeys((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }
  }, [applyServer, showToast]);

  /* ---------- Lines (same shape for buyer and guest) ---------- */

  const lines = useMemo(() => {
    if (buyerId) {
      return server.items.map((item) => {
        const catalogue = catalogueProductFor(item.product);
        // Price, tiers, MOQ and stock always come from the server answer
        const product = {
          ...(catalogue || { id: item.product.id, slug: item.product.slug, name: item.product.name, photo: item.product.photo, variants: {} }),
          sku: item.product.sku, name: catalogue?.name || item.product.name, unit: item.product.unit,
          price: item.product.price, priceTiers: item.product.priceTiers, moq: item.product.moq, stock: item.product.available,
          status: item.product.status,
        };
        return {
          key: item.id, productId: product.id, dbProductId: item.product.id, quantity: item.quantity, variant: item.variant, product,
          unitPrice: item.unitPrice, lineTotal: item.lineTotal, issue: item.issue,
        };
      });
    }
    return guestItems.map((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      if (!product) return null;
      return { ...item, key: `${item.productId}|${variantKey(item.variant)}`, product, unitPrice: getUnitPrice(product, item.quantity), lineTotal: getLineTotal(product, item.quantity) };
    }).filter(Boolean);
  }, [buyerId, server.items, guestItems, products, catalogueProductFor]);

  // Lines with a problem (product withdrawn, out of stock…) are shown but not counted in totals or checkout
  const orderable = useMemo(() => lines.filter((line) => !line.issue), [lines]);
  const totals = useMemo(() => calculateCartTotals(orderable), [orderable]);

  /** A line for a product id (and optional variant), or a line key. */
  const findLine = useCallback((keyOrProductId, variant) => {
    const byKey = lines.find((line) => line.key === keyOrProductId);
    if (byKey) return byKey;
    const matches = lines.filter((line) => line.productId === keyOrProductId);
    if (variant === undefined) return matches[0] || null;
    return matches.find((line) => variantKey(line.variant) === variantKey(variant)) || null;
  }, [lines]);

  /* ---------- Actions ---------- */

  const addToCart = useCallback(async (product, quantity = product?.moq, variant = null) => {
    if (!product) return false;
    if (product.stock <= 0) { showToast('This product is out of stock.', 'error'); return false; }
    const qty = Math.round(Number(quantity)) || product.moq || 1;
    const chosen = variant && Object.keys(variant).length ? variant : getDefaultVariant(product);
    const key = `add|${product.id}|${variantKey(chosen)}`;
    if (buyerId) {
      return runServer(key, () => cartApi.addItem({ productId: product.id, sku: product.sku, slug: product.slug, quantity: qty, variant: chosen }));
    }
    setGuestItems((previous) => {
      const same = previous.find((item) => item.productId === product.id && variantKey(item.variant) === variantKey(chosen));
      if (same) return previous.map((item) => (item === same ? { ...item, quantity: clampQuantity(product, item.quantity + qty) } : item));
      return [...previous, { productId: product.id, sku: product.sku, slug: product.slug, quantity: clampQuantity(product, qty), variant: chosen }];
    });
    return true;
  }, [buyerId, runServer, setGuestItems, showToast]);

  const updateQuantity = useCallback(async (keyOrProductId, quantity) => {
    const line = findLine(keyOrProductId);
    if (!line) return false;
    const qty = clampQuantity(line.product, quantity);
    if (buyerId) return runServer(`qty|${line.key}`, () => cartApi.updateItem(line.key, qty));
    setGuestItems((previous) => previous.map((item) => (`${item.productId}|${variantKey(item.variant)}` === line.key ? { ...item, quantity: qty } : item)));
    return true;
  }, [buyerId, findLine, runServer, setGuestItems]);

  // Removing is silent: the line disappearing from the cart is the confirmation
  const removeFromCart = useCallback(async (keyOrProductId) => {
    const line = findLine(keyOrProductId);
    if (!line) return false;
    if (buyerId) return runServer(`rm|${line.key}`, () => cartApi.removeItem(line.key));
    setGuestItems((previous) => previous.filter((item) => `${item.productId}|${variantKey(item.variant)}` !== line.key));
    return true;
  }, [buyerId, findLine, runServer, setGuestItems]);

  const toggleCart = useCallback((product, quantity = product?.moq || 1, variant = null) => {
    if (!product) return false;
    if (findLine(product.id)) { removeFromCart(product.id); return false; }
    addToCart(product, quantity, variant);
    return true;
  }, [findLine, removeFromCart, addToCart]);

  const clearCart = useCallback(async () => {
    if (buyerId) return runServer('clear', () => cartApi.clearCart());
    setGuestItems([]);
    return true;
  }, [buyerId, runServer, setGuestItems]);

  /* ---------- Buy Now (single product; never touches the cart) ---------- */
  const [buyNowIntent, setBuyNowIntent] = useLocalStorage(STORAGE_KEYS.buyNow, { productId: null });

  const startBuyNow = useCallback((product, quantity, variant = null) => {
    if (!product) return;
    const minQty = product.moq || 1;
    const maxQty = Math.max(product.stock || minQty, minQty);
    const parsedQty = Math.round(Number(quantity)) || minQty;
    const validQty = Math.min(Math.max(parsedQty, minQty), maxQty);
    const defVariant = getDefaultVariant(product);
    const validVariant = (variant && Object.keys(variant).length > 0) ? { ...defVariant, ...variant } : defVariant;
    setBuyNowIntent({ productId: product.id, productSlug: product.slug, quantity: validQty, variant: validVariant, createdAt: Date.now() });
  }, [setBuyNowIntent]);

  const clearBuyNow = useCallback(() => setBuyNowIntent({ productId: null }), [setBuyNowIntent]);

  /**
   * The Buy Now selection checked against the live catalogue.
   * status: ready | none | expired | missing | unavailable | out-of-stock | below-moq | above-stock | bad-variant
   */
  const buyNow = useMemo(() => {
    const intent = buyNowIntent;
    if (!intent?.productId && !intent?.productSlug) return { status: 'none', line: null, product: null };
    let product = products.find((entry) => entry.id === intent.productId || entry.slug === intent.productId || (intent.productSlug && entry.slug === intent.productSlug)) ?? null;
    if (!product) product = seedProducts.find((entry) => entry.id === intent.productId || entry.slug === intent.productId || (intent.productSlug && entry.slug === intent.productSlug)) ?? null;
    if (!product) return { status: loading ? 'loading' : 'missing', line: null, product: null };
    if (Date.now() - (intent.createdAt ?? 0) > BUY_NOW_TTL_MS) return { status: 'expired', line: null, product };
    if (product.status !== 'Active') return { status: 'unavailable', line: null, product };
    if (product.stock <= 0) return { status: 'out-of-stock', line: null, product };
    const quantity = Math.round(Number(intent.quantity)) || product.moq || 1;
    if (quantity < product.moq) return { status: 'below-moq', line: null, product };
    if (quantity > product.stock) return { status: 'above-stock', line: null, product };
    const options = product.variants ?? {};
    const variant = intent.variant ?? null;
    if (variant && Object.entries(variant).some(([name, value]) => options[name] && !options[name]?.includes(value))) return { status: 'bad-variant', line: null, product };
    const line = { productId: product.id, quantity, variant, product, unitPrice: getUnitPrice(product, quantity), lineTotal: getLineTotal(product, quantity) };
    return { status: 'ready', line, product };
  }, [buyNowIntent, products, loading]);

  const value = useMemo(() => ({
    lines: orderable, allLines: lines, totals,
    count: buyerId && !server.loaded ? 0 : lines.length,
    loading: Boolean(buyerId) && !server.loaded,
    isBusy: (productId) => [...busyKeys].some((k) => k.includes(`|${productId}|`) || k.endsWith(`|${productId}`)),
    addToCart, updateQuantity, removeFromCart, toggleCart, clearCart,
    inCart: (productId) => lines.some((line) => line.productId === productId),
    buyNow, startBuyNow, clearBuyNow,
  }), [orderable, lines, totals, buyerId, server.loaded, busyKeys, addToCart, updateQuantity, removeFromCart, toggleCart, clearCart, buyNow, startBuyNow, clearBuyNow]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
