import { DEFAULT_SHIPPING_METHOD, TAX_RATE, SHIPPING_METHODS } from './constants.js';

/** The quantity tier that applies to `quantity` (the highest tier whose minimum is reached). */
export function getActiveTier(product, quantity) {
  const tiers = product?.priceTiers ?? [];
  if (!tiers.length) return null;
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  let active = sorted[0];
  for (const tier of sorted) if (quantity >= tier.minQty) active = tier;
  return active;
}

/** Unit price in INR for a quantity, taken from the product's price tiers. */
export function getUnitPrice(product, quantity) {
  return getActiveTier(product, quantity)?.price ?? product?.price ?? 0;
}

export function getPriceRange(product) {
  const prices = (product?.priceTiers ?? []).map((tier) => tier.price);
  if (!prices.length) return { min: product?.price ?? 0, max: product?.price ?? 0 };
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function getLineTotal(product, quantity) {
  return Math.round(getUnitPrice(product, quantity) * quantity * 100) / 100;
}

export function getShippingMethod(id) {
  return SHIPPING_METHODS.find((method) => method.id === id) ?? SHIPPING_METHODS.find((method) => method.id === DEFAULT_SHIPPING_METHOD);
}

/**
 * Totals for a cart. `lines` = [{ product, quantity }]. All amounts are in INR.
 * Shipping and tax are estimates controlled by constants.js.
 */
export function calculateCartTotals(lines, shippingMethodId = DEFAULT_SHIPPING_METHOD) {
  const valid = lines.filter((line) => line.product);
  const subtotal = valid.reduce((sum, line) => sum + getLineTotal(line.product, line.quantity), 0);
  const units = valid.reduce((sum, line) => sum + line.quantity, 0);
  const method = getShippingMethod(shippingMethodId);
  const shipping = valid.length ? Math.round((method.base + subtotal * method.rate) * 100) / 100 : 0;
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  return {
    lineCount: valid.length,
    units,
    subtotal: Math.round(subtotal * 100) / 100,
    shipping,
    tax,
    total: Math.round((subtotal + shipping + tax) * 100) / 100,
    shippingMethod: method,
  };
}
