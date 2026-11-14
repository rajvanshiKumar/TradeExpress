import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeCountryName, countryName } from '../src/utils/countryData.js';
import { COUNTRY_FLAGS } from '../src/utils/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Supplier Country Filter & Full Country Name Normalization', () => {
  it('normalizes 2-letter country codes and abbreviations to full country names', () => {
    assert.equal(normalizeCountryName('IN'), 'India');
    assert.equal(normalizeCountryName('in'), 'India');
    assert.equal(normalizeCountryName('BN'), 'Brunei');
    assert.equal(normalizeCountryName('bn'), 'Brunei');
    assert.equal(normalizeCountryName('BD'), 'Bangladesh');
    assert.equal(normalizeCountryName('US'), 'United States');
    assert.equal(normalizeCountryName('USA'), 'United States');
    assert.equal(normalizeCountryName('UK'), 'United Kingdom');
    assert.equal(normalizeCountryName('GB'), 'United Kingdom');
    assert.equal(normalizeCountryName('UAE'), 'United Arab Emirates');
    assert.equal(normalizeCountryName('AE'), 'United Arab Emirates');
    assert.equal(normalizeCountryName('CN'), 'China');
    assert.equal(normalizeCountryName('IT'), 'Italy');
    assert.equal(normalizeCountryName('DE'), 'Germany');

    // Already full names
    assert.equal(normalizeCountryName('India'), 'India');
    assert.equal(normalizeCountryName('China'), 'China');
    assert.equal(normalizeCountryName('Bangladesh'), 'Bangladesh');
    assert.equal(normalizeCountryName('Brunei'), 'Brunei');
    assert.equal(normalizeCountryName('United States'), 'United States');

    // countryName helper also normalizes
    assert.equal(countryName('IN'), 'India');
    assert.equal(countryName('BN'), 'Brunei');
  });

  it('provides flag emojis for full country names as well as codes', () => {
    assert.equal(COUNTRY_FLAGS['India'], '🇮🇳');
    assert.equal(COUNTRY_FLAGS['IN'], '🇮🇳');
    assert.equal(COUNTRY_FLAGS['Brunei'], '🇧🇳');
    assert.equal(COUNTRY_FLAGS['BN'], '🇧🇳');
    assert.equal(COUNTRY_FLAGS['Bangladesh'], '🇧🇩');
    assert.equal(COUNTRY_FLAGS['BD'], '🇧🇩');
    assert.equal(COUNTRY_FLAGS['United States'], '🇺🇸');
    assert.equal(COUNTRY_FLAGS['USA'], '🇺🇸');
  });

  it('normalizes supplier country list and eliminates 2-letter codes like IN and BN', () => {
    const rawActiveSuppliers = [
      { id: '1', name: 'Mumbai Textiles', country: 'India', status: 'Active' },
      { id: '2', name: 'Delhi Handicrafts', country: 'IN', status: 'Active' },
      { id: '3', name: 'Dhaka Cotton', country: 'BD', status: 'Active' },
      { id: '4', name: 'Brunei Craft Ltd', country: 'BN', status: 'Active' },
      { id: '5', name: 'Austin GreenSupply', country: 'USA', status: 'Active' },
    ];

    const countrySet = new Set();
    rawActiveSuppliers.forEach((company) => {
      const full = normalizeCountryName(company.country);
      if (full) countrySet.add(full);
    });
    const countries = Array.from(countrySet).sort((a, b) => a.localeCompare(b));

    // Must not contain any 2-letter codes or abbreviations
    assert.ok(!countries.includes('IN'), 'Must not contain IN');
    assert.ok(!countries.includes('BN'), 'Must not contain BN');
    assert.ok(!countries.includes('BD'), 'Must not contain BD');
    assert.ok(!countries.includes('USA'), 'Must not contain USA');

    // Must contain full country names
    assert.ok(countries.includes('India'), 'Must contain full name India');
    assert.ok(countries.includes('Bangladesh'), 'Must contain full name Bangladesh');
    assert.ok(countries.includes('Brunei'), 'Must contain full name Brunei');
    assert.ok(countries.includes('United States'), 'Must contain full name United States');

    // Deduplication check: 'India' and 'IN' became a single entry
    assert.equal(countries.filter((c) => c === 'India').length, 1);
  });

  it('verifies Suppliers.jsx, SupplierFilters.jsx, and supplierService.js use normalizeCountryName', () => {
    const suppliersCode = fs.readFileSync(path.resolve(__dirname, '../src/pages/Suppliers.jsx'), 'utf-8');
    const filtersCode = fs.readFileSync(path.resolve(__dirname, '../src/components/suppliers/SupplierFilters.jsx'), 'utf-8');
    const serviceCode = fs.readFileSync(path.resolve(__dirname, '../src/services/supplierService.js'), 'utf-8');

    assert.ok(
      suppliersCode.includes('normalizeCountryName'),
      'Suppliers.jsx must import and use normalizeCountryName to deduplicate and display full country names'
    );
    assert.ok(
      filtersCode.includes('normalizeCountryName'),
      'SupplierFilters.jsx must import and use normalizeCountryName for dropdown labels and applied chips'
    );
    assert.ok(
      serviceCode.includes('normalizeCountryName'),
      'supplierService.js must import and use normalizeCountryName for supplier records and filtering'
    );
  });
});
