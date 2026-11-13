import axios from 'axios';

/**
 * Live exchange rates for showing approximate prices in a buyer's own currency. Display only: orders, invoices,
 * RFQs and quotations always keep their real currency.
 *
 * Source: ExchangeRate-API's free open endpoint (no key needed), which updates once a day.
 * Rates are cached for 6 hours. If the provider cannot be reached, the last rates are used for up to 2 days;
 * after that the service reports that rates are unavailable, and prices are shown in their original currency.
 * Rates are never made up.
 */
const PROVIDER_URL = process.env.EXCHANGE_RATE_API_URL || 'https://open.er-api.com/v6/latest/INR';
const FRESH_MS = 6 * 60 * 60 * 1000;
const STALE_LIMIT_MS = 48 * 60 * 60 * 1000;

let cache = null; // { base, rates, updatedAt, fetchedAt }
let inFlight = null;

function fail(message, statusCode = 503) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function fetchRates(request) {
  const response = await request(PROVIDER_URL, { timeout: 8000, validateStatus: () => true });
  const body = response?.data;
  if (response?.status !== 200 || body?.result !== 'success' || !body.rates || typeof body.rates !== 'object') {
    throw fail(`Exchange rate provider answered with status ${response?.status}.`);
  }
  // Only well-formed, positive rates are kept
  const rates = Object.fromEntries(
    Object.entries(body.rates).filter(([code, rate]) => /^[A-Z]{3}$/.test(code) && Number.isFinite(rate) && rate > 0),
  );
  if (!rates.INR || !rates.USD) throw fail('Exchange rate provider returned incomplete rates.');
  return {
    base: body.base_code || 'INR',
    rates,
    updatedAt: body.time_last_update_utc ? new Date(body.time_last_update_utc).toISOString() : new Date().toISOString(),
    fetchedAt: Date.now(),
  };
}

/** Rates relative to 1 INR. `request` can be replaced in tests. */
export async function getExchangeRates({ request = axios.get, now = Date.now() } = {}) {
  if (cache && now - cache.fetchedAt < FRESH_MS) return { ...cache, stale: false };
  if (!inFlight) {
    inFlight = fetchRates(request)
      .then((fresh) => {
        cache = fresh;
        return fresh;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  try {
    return { ...(await inFlight), stale: false };
  } catch (error) {
    if (cache && now - cache.fetchedAt < STALE_LIMIT_MS) return { ...cache, stale: true };
    console.warn('[Exchange Rates] Rates unavailable:', error.message);
    throw fail('Exchange rates are unavailable right now. Prices are shown in their original currency.');
  }
}

/** Test helper. */
export function clearExchangeRateCache() {
  cache = null;
  inFlight = null;
}
