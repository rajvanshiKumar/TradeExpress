import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as backendData from '../../src/utils/countryData.js';
import * as frontendData from '../../../frontend/src/utils/countryData.js';
import { clearExchangeRateCache, getExchangeRates } from '../../src/services/exchangeRateService.js';

const { COUNTRY_CODES, COUNTRY_CURRENCY, NO_POSTAL_CODE, POSTAL_RULES, validatePostalCode, postalRequirement, defaultCurrencyFor } = backendData;

describe('Country data', () => {
  it('lists all 249 ISO 3166-1 codes once, each with a currency', () => {
    assert.equal(COUNTRY_CODES.length, 249);
    assert.equal(new Set(COUNTRY_CODES).size, 249);
    COUNTRY_CODES.forEach((code) => assert.match(COUNTRY_CURRENCY[code] || '', /^[A-Z]{3}$/, code));
    [...NO_POSTAL_CODE, ...Object.keys(POSTAL_RULES)].forEach((code) => assert.ok(COUNTRY_CODES.includes(code), code));
  });

  it('is identical in the frontend and the backend', () => {
    for (const key of ['COUNTRY_CODES', 'COUNTRY_CURRENCY', 'NO_POSTAL_CODE', 'POSTAL_RULES']) assert.deepEqual(frontendData[key], backendData[key], key);
    assert.deepEqual(frontendData.validatePostalCode('GB', 'sw1a1aa'), backendData.validatePostalCode('GB', 'sw1a1aa'));
  });

  it('accepts the example of every postal format', () => {
    for (const [code, rule] of Object.entries(POSTAL_RULES)) assert.ok(validatePostalCode(code, rule.example).ok, `${code} ${rule.example}`);
  });

  it('checks each country against its own format', () => {
    assert.equal(validatePostalCode('IN', '110001').ok, true);
    assert.equal(validatePostalCode('IN', '010001').ok, false);
    assert.equal(validatePostalCode('US', '10001').ok, true);
    assert.equal(validatePostalCode('US', '10001-1234').ok, true);
    assert.equal(validatePostalCode('US', '110001').ok, false);
    // The same code is valid in one country and not in another
    assert.equal(validatePostalCode('IN', '10001').ok, false);
    assert.deepEqual(validatePostalCode('GB', 'sw1a1aa'), { ok: true, value: 'SW1A 1AA', message: '' });
    assert.equal(validatePostalCode('GB', '12345').ok, false);
    assert.equal(validatePostalCode('CA', 'k1a0b1').value, 'K1A 0B1');
    assert.equal(validatePostalCode('JP', '1000001').value, '100-0001');
    assert.match(validatePostalCode('IN', '').message, /PIN code/);
  });

  it('does not ask for a postal code where none is used, and keeps others optional unless a format is known', () => {
    assert.equal(postalRequirement('AE'), 'none');
    assert.deepEqual(validatePostalCode('AE', ''), { ok: true, value: '', message: '' });
    assert.equal(validatePostalCode('AE', '00000').ok, true);
    assert.equal(validatePostalCode('AE', '!!').ok, false);
    assert.equal(postalRequirement('IN'), 'required');
    assert.equal(postalRequirement('IE'), 'optional');
    assert.equal(postalRequirement('KZ'), 'optional');
    assert.equal(validatePostalCode('KZ', '').ok, true);
    assert.equal(validatePostalCode('KZ', '050000').ok, true);
    assert.equal(validatePostalCode('KZ', '!').ok, false);
  });

  it('picks the default currency for a country', () => {
    assert.deepEqual(['IN', 'US', 'GB', 'DE', 'AE', 'CN', 'JP', 'SA'].map(defaultCurrencyFor), ['INR', 'USD', 'GBP', 'EUR', 'AED', 'CNY', 'JPY', 'SAR']);
  });
});

describe('Exchange rates', () => {
  const reply = (status, data) => async () => ({ status, data });
  const good = { result: 'success', base_code: 'INR', time_last_update_utc: 'Mon, 10 Nov 2026 00:00:01 +0000', rates: { INR: 1, USD: 0.0114, GBP: 0.0089, BAD: -1, nope: 2 } };

  it('keeps only valid positive rates', async () => {
    clearExchangeRateCache();
    const result = await getExchangeRates({ request: reply(200, good) });
    assert.deepEqual(Object.keys(result.rates).sort(), ['GBP', 'INR', 'USD']);
    assert.equal(result.stale, false);
  });

  it('serves the last rates for a while when the provider fails, then reports them unavailable', async () => {
    clearExchangeRateCache();
    const start = Date.now();
    await getExchangeRates({ request: reply(200, good), now: start });
    const later = await getExchangeRates({ request: reply(500, {}), now: start + 7 * 3600e3 });
    assert.equal(later.stale, true);
    await assert.rejects(getExchangeRates({ request: reply(500, {}), now: start + 49 * 3600e3 }), { statusCode: 503 });
  });

  it('never makes up rates when the provider has never answered', async () => {
    clearExchangeRateCache();
    await assert.rejects(getExchangeRates({ request: async () => { throw new Error('offline'); } }), { statusCode: 503 });
    await assert.rejects(getExchangeRates({ request: reply(200, { result: 'error' }) }), { statusCode: 503 });
  });
});
