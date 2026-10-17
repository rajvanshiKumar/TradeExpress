import { createContext, useCallback, useContext, useMemo } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { BUY_NOW_TTL_MS, STORAGE_KEYS } from '../utils/constants';
import { calculateCartTotals, getLineTotal, getUnitPrice } from '../utils/calculateTotals';
import { ProductContext } from './ProductContext';
import { NotificationContext } from './NotificationContext';

export const CartContext = createContext(null);

/** Keeps a quantity between the product's MOQ and its stock. */
export function clampQuantity(product, quantity) {
  const wanted = Math.round(Number(quantity)) || product.moq;
  const max = Math.max(product.stock, product.moq);
  return Math.min(Math.max(wanted, product.moq), max);
}

export function CartProvider({ children }) {
  const { products, loading } = useContext(ProductContext);
  const { showToast } = useContext(NotificationContext);
  // Stored shape: [{ productId, quantity, variant }]
  const [items, setItems] = useLocalStorage(STORAGE_KEYS.cart, []);

  // Buy Now keeps its own single-product selection. It never touches the cart items above.
  // Stored shape: { productId, quantity, variant, createdAt } or null.
  const [buyNowIntent, setBuyNowIntent] = useLocalStorage(STORAGE_KEYS.buyNow, { productId: null });

  const startBuyNow = useCallback((product, quantity, variant = null) => {
    setBuyNowIntent({ productId: product.id, quantity, variant, createdAt: Date.now() });
  }, [setBuyNowIntent]);

  const clearBuyNow = useCallback(() => setBuyNowIntent({ productId: null }), [setBuyNowIntent]);

  /**
   * The Buy Now selection checked against the live catalogue.
   * Returns { status, line, product } where status is one of:
   * ready | none | expired | missing | unavailable | out-of-stock | below-moq | above-stock | bad-variant
   */
  const buyNow = useMemo(() => {
    const intent = buyNowIntent;
    if (!intent?.productId) return { status: 'none', line: null, product: null };
    const product = products.find((entry) => entry.id === intent.productId) ?? null;
    if (!product) return { status: loading ? 'loading' : 'missing', line: null, product: null };
    if (Date.now() - (intent.createdAt ?? 0) > BUY_NOW_TTL_MS) return { status: 'expired', line: null, product };
    if (product.status !== 'Active') return { status: 'unavailable', line: null, product };
    if (product.stock <= 0) return { status: 'out-of-stock', line: null, product };
    const quantity = Math.round(Number(intent.quantity));
    if (!quantity || quantity < product.moq) return { status: 'below-moq', line: null, product };
    if (quantity > product.stock) return { status: 'above-stock', line: null, product };
    const options = product.variants ?? {};
    const variant = intent.variant ?? null;
    if (variant && Object.entries(variant).some(([name, value]) => !options[name]?.includes(value))) return { status: 'bad-variant', line: null, product };
    const line = { productId: product.id, quantity, variant, product, unitPrice: getUnitPrice(product, quantity), lineTotal: getLineTotal(product, quantity) };
    return { status: 'ready', line, product };
  }, [buyNowIntent, products, loading]);

  const addToCart = useCallback((product, quantity = product.moq, variant = null) => {
    if (product.stock <= 0) {
      showToast('This product is out of stock.', 'error');
      return;
    }
    const existing = items.find((item) => item.productId === product.id);
    const nextQuantity = clampQuantity(product, existing ? existing.quantity + Number(quantity) : quantity);
    setItems((previous) => (previous.some((item) => item.productId === product.id)
      ? previous.map((item) => (item.productId === product.id ? { ...item, quantity: nextQuantity, variant: variant ?? item.variant } : item))
      : [...previous, { productId: product.id, quantity: nextQuantity, variant }]));
    showToast(existing ? 'Cart quantity updated.' : `${product.name} added to cart.`);
  }, [items, setItems, showToast]);

  const updateQuantity = useCallback((productId, quantity) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    setItems((previous) => previous.map((item) => (item.productId === productId ? { ...item, quantity: clampQuantity(product, quantity) } : item)));
  }, [products, setItems]);

  const removeFromCart = useCallback((productId) => {
    setItems((previous) => previous.filter((item) => item.productId !== productId));
    showToast('Removed from cart.', 'info');
  }, [setItems, showToast]);

  const clearCart = useCallback(() => setItems([]), [setItems]);

  // Join stored lines with live catalogue data, so price or stock edits show up straight away.
  const lines = useMemo(() => items
    .map((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      if (!product) return null;
      return { ...item, product, unitPrice: getUnitPrice(product, item.quantity), lineTotal: getLineTotal(product, item.quantity) };
    })
    .filter(Boolean), [items, products]);

  const totals = useMemo(() => calculateCartTotals(lines), [lines]);

  const value = useMemo(() => ({
    lines, totals, count: loading ? items.length : lines.length, addToCart, updateQuantity, removeFromCart, clearCart,
    inCart: (productId) => items.some((item) => item.productId === productId),
    buyNow, startBuyNow, clearBuyNow,
  }), [lines, totals, loading, items, addToCart, updateQuantity, removeFromCart, clearCart, buyNow, startBuyNow, clearBuyNow]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
