import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { incompatibleValueKeys, isVisible, pickSchemaValues, validateSpecValues } from '../src/utils/specValidation.js';

const schema = {
  attributes: [
    { key: 'ghee_type', label: 'Ghee Type', type: 'select', options: ['Cow Ghee', 'Buffalo Ghee'], required: true },
    { key: 'milk_fat_percent', label: 'Milk Fat', type: 'decimal', unit: '%', min: 0, max: 100, required: true },
    { key: 'shelf_life_months', label: 'Shelf Life', type: 'number', unit: 'months', min: 1, max: 120 },
    { key: 'certifications', label: 'Certifications', type: 'multiselect', options: ['FSSAI', 'ISO 9001'] },
    { key: 'organic_body', label: 'Certifying Body', type: 'text', required: true, showIf: { key: 'certifications', in: [['Organic']] } },
  ],
};

describe('Dynamic specification checks (client side)', () => {
  it('flags missing required fields, out-of-range numbers, whole-number fields and invalid options', () => {
    const errors = validateSpecValues(schema, { ghee_type: 'Goat Ghee', milk_fat_percent: '120', shelf_life_months: '6.5', certifications: ['FSSAI', 'Fake'] });
    assert.match(errors.ghee_type, /valid option/);
    assert.match(errors.milk_fat_percent, /at most 100 %/);
    assert.match(errors.shelf_life_months, /whole number/);
    assert.match(errors.certifications, /invalid option: Fake/);
    assert.match(validateSpecValues(schema, {}).ghee_type, /required/);
  });

  it('accepts valid values and skips hidden conditional fields', () => {
    assert.deepEqual(validateSpecValues(schema, { ghee_type: 'Cow Ghee', milk_fat_percent: '99.5', shelf_life_months: '9' }), {});
    assert.equal(isVisible(schema.attributes[4], {}), false);
  });

  it('sends only filled values defined by the schema, and reports values that no longer apply', () => {
    const values = { ghee_type: 'Cow Ghee', milk_fat_percent: '', axes: '5' };
    assert.deepEqual(pickSchemaValues(schema, values), { ghee_type: 'Cow Ghee' });
    assert.deepEqual(incompatibleValueKeys(schema, values), ['axes']);
  });
});
