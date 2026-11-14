import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EMPTY_COMPARISON_FILTERS,
  applyComparisonFilters,
  buildFilterOptions,
  compareSizes,
  countActiveFilters,
  hasListedMoq,
  matchingSizes,
  matchingValues,
  moqUnitLabel,
  withinMoqLimit,
} from '../src/utils/comparisonFilters.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const sellers = [
  {
    id: 'a',
    moq: 50,
    moqListed: true,
    unit: 'piece',
    variants: { color: ['Navy Blue', 'White'], size: ['S', 'M', 'L'] },
    supplier: { isVerified: true },
    sampleAvailable: true,
    readyToShip: true,
  },
  {
    id: 'b',
    moq: 150,
    moqListed: true,
    unit: 'piece',
    variants: { color: ['Red'], size: ['XL', 'On request'] },
    supplier: { isVerified: false },
    sampleAvailable: false,
    readyToShip: true,
  },
  {
    id: 'c',
    moq: 400,
    moqListed: true,
    unit: 'piece',
    specifications: { Colour: 'White' },
    supplier: { isVerified: true },
    sampleAvailable: true,
    readyToShip: false,
  },
  // MOQ not supplied by the seller: normalised to 1 for display, but flagged as not listed
  { id: 'd', moq: 1, moqListed: false, unit: 'piece', supplier: { isVerified: true }, readyToShip: true },
];

const ids = (list) => list.map((p) => p.id);
const withFilters = (patch) => ({ ...EMPTY_COMPARISON_FILTERS, ...patch });

describe('Comparison filters — options from real comparison data', () => {
  it('builds color and size options with seller counts', () => {
    const { colors, sizes } = buildFilterOptions(sellers);
    assert.deepEqual(colors.find((c) => c.name === 'White'), { name: 'White', count: 2 });
    assert.deepEqual(colors.find((c) => c.name === 'Red'), { name: 'Red', count: 1 });
    assert.deepEqual(sizes.map((s) => s.name), ['S', 'M', 'L', 'XL', 'On request']);
  });

  it('returns no options when sellers list no colors or sizes (nothing invented)', () => {
    const { colors, sizes } = buildFilterOptions([{ id: 'x', moq: 10 }]);
    assert.equal(colors.length, 0);
    assert.equal(sizes.length, 0);
  });

  it('orders apparel sizes, then capacities naturally, with "On request" last', () => {
    const sorted = ['On request', '500 ml', 'XL', '1000 ml', 'XS', '250 ml', 'M'].sort(compareSizes);
    assert.deepEqual(sorted, ['XS', 'M', 'XL', '250 ml', '500 ml', '1000 ml', 'On request']);
  });
});

describe('Comparison filters — selection semantics', () => {
  it('no filters returns every seller', () => {
    assert.deepEqual(ids(applyComparisonFilters(sellers, EMPTY_COMPARISON_FILTERS)), ['a', 'b', 'c', 'd']);
  });

  it('multiple colors match any selected color (OR within the group)', () => {
    assert.deepEqual(ids(applyComparisonFilters(sellers, withFilters({ colors: ['Red', 'White'] }))), ['a', 'b', 'c']);
  });

  it('keeps the existing partial colour match ("Blue" matches "Navy Blue")', () => {
    assert.deepEqual(ids(applyComparisonFilters(sellers, withFilters({ colors: ['Blue'] }))), ['a']);
    assert.deepEqual(matchingValues(['Navy Blue', 'White'], ['Blue', 'Red']), ['Blue']);
  });

  it('multiple sizes match any selected size', () => {
    assert.deepEqual(ids(applyComparisonFilters(sellers, withFilters({ sizes: ['M', 'On request'] }))), ['a', 'b']);
  });

  it('sizes match exactly, so "S" does not match "XS" or "On request"', () => {
    assert.deepEqual(ids(applyComparisonFilters(sellers, withFilters({ sizes: ['S'] }))), ['a']);
    assert.deepEqual(matchingSizes(['XS', 'On request'], ['S']), []);
    assert.deepEqual(matchingSizes(['on  Request'], ['On request']), ['On request']);
  });

  it('combines groups with AND', () => {
    const result = applyComparisonFilters(
      sellers,
      withFilters({ colors: ['White', 'Red'], readyToShip: true, verifiedOnly: true })
    );
    assert.deepEqual(ids(result), ['a']);
  });

  it('credential and logistics checks can be enabled together', () => {
    assert.deepEqual(ids(applyComparisonFilters(sellers, withFilters({ verifiedOnly: true }))), ['a', 'c', 'd']);
    assert.deepEqual(ids(applyComparisonFilters(sellers, withFilters({ sampleOnly: true }))), ['a', 'c', 'd']);
    assert.deepEqual(ids(applyComparisonFilters(sellers, withFilters({ verifiedOnly: true, readyToShip: true }))), ['a', 'd']);
  });

  it('counts each individual selection as an active filter', () => {
    assert.equal(countActiveFilters(EMPTY_COMPARISON_FILTERS), 0);
    assert.equal(countActiveFilters(withFilters({ colors: ['Red', 'White'], maxMoq: 100, sampleOnly: true })), 4);
  });
});

describe('Comparison filters — Maximum MOQ', () => {
  it('filters by actual MOQ values', () => {
    assert.deepEqual(ids(applyComparisonFilters(sellers, withFilters({ maxMoq: 100 }))), ['a']);
    assert.deepEqual(ids(applyComparisonFilters(sellers, withFilters({ maxMoq: 200 }))), ['a', 'b']);
    assert.deepEqual(ids(applyComparisonFilters(sellers, withFilters({ maxMoq: 500 }))), ['a', 'b', 'c']);
  });

  it('never treats a missing MOQ as a low MOQ', () => {
    assert.equal(withinMoqLimit(sellers[3], 500), false);
    assert.equal(hasListedMoq(undefined), false);
    assert.equal(hasListedMoq(null), false);
    assert.equal(hasListedMoq(''), false);
    assert.equal(hasListedMoq(0), false);
    assert.equal(hasListedMoq(120), true);
    assert.equal(hasListedMoq('250 pcs'), true);
  });

  it('labels MOQ options with the sellers’ own unit', () => {
    assert.equal(moqUnitLabel(sellers), 'pcs');
    assert.equal(moqUnitLabel([{ unit: 'kg' }, { unit: 'kg' }]), 'kg');
    assert.equal(moqUnitLabel([{ unit: 'set' }]), 'sets');
    assert.equal(moqUnitLabel([{ unit: 'kg' }, { unit: 'piece' }]), 'units');
  });
});

describe('Comparison page uses the dropdown filters', () => {
  const page = read('src/pages/buyer/ProductComparison.jsx');
  const dropdown = read('src/components/products/ComparisonFilterDropdown.jsx');

  it('renders the four filter groups as dropdowns with a Clear All action', () => {
    assert.equal((page.match(/<ComparisonFilterDropdown/g) || []).length, 4);
    for (const label of ['All Colors', 'All Sizes', 'All MOQ', 'Clear All Filters', 'Hide Filters', 'Show Filters']) {
      assert.ok(page.includes(label), `missing "${label}"`);
    }
    assert.ok(page.includes('of {comparedProducts.length} Sellers'), 'seller counter missing');
  });

  it('dropdown closes on outside click and Escape and supports keyboard navigation', () => {
    assert.ok(dropdown.includes("addEventListener('mousedown'"));
    assert.ok(dropdown.includes("event.key === 'Escape'"));
    assert.ok(dropdown.includes("'ArrowDown'") && dropdown.includes("'Home'") && dropdown.includes("'End'"));
    assert.ok(dropdown.includes('aria-expanded'));
    assert.ok(dropdown.includes('max-h-64 overflow-y-auto'));
  });

  it('Color and Size apply and close on each pick; Credentials stays open for several checks', () => {
    const block = (label) => page.slice(page.indexOf(`label="${label}"`), page.indexOf('/>', page.indexOf(`label="${label}"`)));
    assert.match(block('Color'), /closeOnSelect/);
    assert.match(block('Size \/ Capacity'), /closeOnSelect/);
    assert.doesNotMatch(block('Credentials & Logistics'), /closeOnSelect/);
    assert.match(dropdown, /if \(closeOnSelect\) close\(true\);/);
  });

  it('pressing an option keeps focus in the panel so the click can select it', () => {
    // Regression: mousedown on an option moved focus to the app's focusable <main>, the blur handler
    // treated that as leaving the dropdown and closed it before the click, so nothing was ever selected.
    assert.match(dropdown, /onMouseDown=\{onPanelMouseDown\}/);
    assert.match(dropdown, /const onPanelMouseDown = \(event\) => \{\s*if \(event\.target !== searchRef\.current\) event\.preventDefault\(\);/);
  });
});
