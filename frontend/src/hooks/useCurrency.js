import { useCallback, useEffect, useMemo, useState } from 'react';
import formatCurrency from '../utils/formatCurrency';
import useLocationPreference from './useLocationPreference';
import { API_BASE } from '../services/authorizedApi';

/**
 * Prices and the buyer's display currency.
 *
 * - money(amount): the real amount in INR, unconverted. Used for carts, checkout, orders, invoices, payments, RFQs and
 *   quotations, which must always show the transaction currency.
 * - displayMoney(amount, fromCurrency): a browsing price shown in the buyer's display currency, marked "≈" when converted,
 *   using live rates from the server. Without rates (offline, or a currency the provider lacks) the original price is shown.
 */

// Currencies offered when choosing one by hand; the selected country's own currency is always added
const POPULAR = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'CNY', 'JPY', 'SGD', 'AUD', 'CAD', 'CHF'];

let ratesRequest = null;
function loadRates() {
  if (!ratesRequest) {
    ratesRequest = fetch(`${API_BASE}/currency/rates`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
      .then((response) => response.json())
      .then((body) => (body?.success && body.data?.rates ? body.data : null))
      .catch(() => null)
      .then((data) => {
        // A failed request is tried again on the next page
        if (!data) ratesRequest = null;
        return data;
      });
  }
  return ratesRequest;
}

const currencyNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'currency' });
  } catch {
    return null;
  }
})();

export function currencySymbol(code) {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'symbol' })
      .formatToParts(0).find((part) => part.type === 'currency')?.value || code;
  } catch {
    return code;
  }
}

/** An amount in its own currency: rupees with Indian grouping, others with a symbol that tells the currencies apart (A$, CA$, HK$). */
export function formatMoney(amount, code = 'INR') {
  const value = Number(amount) || 0;
  if (code === 'INR') return formatCurrency(value);
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'symbol',
      maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
    }).format(value);
  } catch {
    return `${code} ${value.toLocaleString('en')}`;
  }
}

export default function useCurrency() {
  const { location, setDisplayCurrency } = useLocationPreference();
  const [rates, setRates] = useState(null);
  const currency = location.displayCurrency;

  useEffect(() => {
    if (currency === 'INR') return undefined;
    let active = true;
    loadRates().then((data) => {
      if (active) setRates(data);
    });
    return () => {
      active = false;
    };
  }, [currency]);

  const money = useCallback((amount) => formatCurrency(Number(amount) || 0), []);

  const convert = useCallback((amount, from = 'INR') => {
    const value = Number(amount) || 0;
    if (currency === from) return { value, code: from, converted: false };
    const fromRate = rates?.rates?.[from];
    const toRate = rates?.rates?.[currency];
    if (!fromRate || !toRate) return { value, code: from, converted: false };
    return { value: (value * toRate) / fromRate, code: currency, converted: true };
  }, [currency, rates]);

  const displayMoney = useCallback((amount, from = 'INR') => {
    const result = convert(amount, from);
    return result.converted ? `≈ ${formatMoney(result.value, result.code)}` : formatMoney(result.value, result.code);
  }, [convert]);

  const currencies = useMemo(() => [...new Set([...POPULAR, location.displayCurrency])].map((code) => ({
    code,
    symbol: currencySymbol(code),
    name: currencyNames?.of(code) || code,
  })), [location.displayCurrency]);

  return {
    currency,
    setCurrency: setDisplayCurrency,
    money,
    displayMoney,
    convert,
    /** True when browsing prices are shown converted into another currency. */
    isConverting: currency !== 'INR' && Boolean(rates?.rates?.[currency]),
    ratesUpdatedAt: rates?.updatedAt || null,
    currencies,
  };
}
