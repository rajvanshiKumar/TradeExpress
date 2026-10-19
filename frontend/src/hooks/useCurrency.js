import { useCallback, useEffect, useState } from 'react';
import formatCurrency from '../utils/formatCurrency';
import { CURRENCY } from '../utils/constants';

const STORAGE_CURRENCY_KEY = 'tradesphere:active_currency';

export const RATES = {
  INR: 1,
  USD: 1 / 86.50, // 1 USD ≈ 86.50 INR
  EUR: 1 / 93.00, // 1 EUR ≈ 93.00 INR
};

export const SUPPORTED_CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee (Base)', rate: 1 },
  { code: 'USD', symbol: '$', name: 'US Dollar (Wholesale Ex)', rate: 86.50 },
  { code: 'EUR', symbol: '€', name: 'Euro (Wholesale Ex)', rate: 93.00 },
];

/**
 * Multi-Currency wholesale converter.
 * Base prices in DB are in INR. When USD or EUR is active, amounts convert seamlessly.
 */
export default function useCurrency() {
  const [currency, setCurrencyState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_CURRENCY_KEY) || CURRENCY.code;
    } catch {
      return CURRENCY.code;
    }
  });

  const setCurrency = useCallback((newCode) => {
    const valid = RATES[newCode] ? newCode : 'INR';
    setCurrencyState(valid);
    try {
      localStorage.setItem(STORAGE_CURRENCY_KEY, valid);
      window.dispatchEvent(new Event('tradesphere_currency_change'));
    } catch {}
  }, []);

  useEffect(() => {
    const handleSync = () => {
      try {
        const stored = localStorage.getItem(STORAGE_CURRENCY_KEY) || 'INR';
        setCurrencyState(stored);
      } catch {}
    };
    window.addEventListener('tradesphere_currency_change', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('tradesphere_currency_change', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const money = useCallback((amountInInr) => {
    const val = Number(amountInInr) || 0;
    if (currency === 'INR') {
      return formatCurrency(val);
    }

    if (currency === 'USD') {
      const converted = val * RATES.USD;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: converted < 50 && !Number.isInteger(converted) ? 2 : 0,
        maximumFractionDigits: 2,
      }).format(converted);
    }

    if (currency === 'EUR') {
      const converted = val * RATES.EUR;
      return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: converted < 50 && !Number.isInteger(converted) ? 2 : 0,
        maximumFractionDigits: 2,
      }).format(converted);
    }

    return formatCurrency(val);
  }, [currency]);

  return {
    currency,
    setCurrency,
    money,
    currencies: SUPPORTED_CURRENCIES,
  };
}
