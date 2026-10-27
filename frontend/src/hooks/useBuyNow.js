import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useCart from './useCart';
import useNotifications from './useNotifications';
import { quantityLabel } from '../utils/units';

export const BUY_NOW_CHECKOUT_PATH = '/checkout?mode=buynow';

/** First option of every variant group, or null when the product has no variants. */
export function defaultVariant(product) {
  if (!product) return null;
  const entries = Object.entries(product.variants ?? {}).filter(([, options]) => Array.isArray(options) && options.length);
  return entries.length ? Object.fromEntries(entries.map(([name, options]) => [name, options[0]])) : null;
}

/**
 * Returns buyNow(product, { quantity, variant }) which validates the selection, saves it
 * as a separate checkout selection (the cart is left alone) and opens checkout.
 * Without options it uses the default variant and the smallest valid quantity:
 * 1, or the product's minimum order when that is higher.
 */
export default function useBuyNow() {
  const { startBuyNow } = useCart();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  return useCallback((product, { quantity, variant } = {}) => {
    if (!product || (product.status && product.status !== 'Active')) {
      showToast('This product is no longer available.', 'error');
      return false;
    }
    if ((product.stock ?? 0) <= 0) {
      showToast('This product is out of stock.', 'error');
      return false;
    }
    const minMoq = product.moq || 1;
    const parsedQty = Number(quantity);
    const wanted = (!parsedQty || isNaN(parsedQty) || parsedQty < minMoq) ? minMoq : Math.round(parsedQty);

    if (wanted > product.stock) {
      if (product.stock < minMoq) {
        showToast(`This product only has ${quantityLabel(product.stock, product.unit)} in stock (MOQ is ${quantityLabel(minMoq, product.unit)}).`, 'error');
        return false;
      }
      showToast(`Only ${quantityLabel(product.stock, product.unit)} are in stock.`, 'error');
      return false;
    }
    const options = product.variants ?? {};
    const def = defaultVariant(product);
    const chosen = (variant && Object.keys(variant).length > 0) ? { ...def, ...variant } : def;
    if (chosen && Object.entries(chosen).some(([name, value]) => options[name] && !options[name]?.includes(value))) {
      showToast('Please choose a valid product option.', 'error');
      return false;
    }
    // Clicking twice simply saves the same selection again, so no duplicate is created.
    startBuyNow(product, wanted, chosen);
    navigate(BUY_NOW_CHECKOUT_PATH);
    return true;
  }, [startBuyNow, showToast, navigate]);
}
