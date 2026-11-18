import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORY_TAXONOMY } from '../../src/data/categoryTaxonomy.js';
import {
  SPEC_SCHEMA_VERSION, buildDisplaySpecifications, resolveAttributeSchema, validateSpecificationValues,
} from '../../src/data/categoryAttributes.js';

const slugOf = (name) => CATEGORY_TAXONOMY.find((c) => c.name === name).slug;
const keys = (schema) => schema.attributes.map((a) => a.key);
const labels = (schema) => schema.attributes.map((a) => a.label);

describe('Category specification schema', () => {
  it('resolves a non-empty, duplicate-free schema for all 60 categories', () => {
    for (const c of CATEGORY_TAXONOMY) {
      const s = resolveAttributeSchema(c.slug);
      assert.ok(s.attributes.length >= 4, `${c.name} has too few attributes`);
      assert.equal(new Set(keys(s)).size, s.attributes.length, `duplicate key in ${c.name}`);
      assert.equal(s.version, SPEC_SCHEMA_VERSION);
    }
  });

  it('Ghee (Food & Beverages -> Dairy Products -> Ghee) shows the requested fields with dairy inheritance', () => {
    const s = resolveAttributeSchema(slugOf('Food & Beverages'), 'Dairy Products', 'Ghee');
    for (const l of ['Ghee Type', 'Milk Fat', 'Net Weight', 'Packaging Type', 'Shelf Life', 'Ingredients', 'Certifications']) assert.ok(labels(s).includes(l), l);
    assert.ok(labels(s).includes('Storage Temperature / Conditions'), 'inherited from Dairy Products');
    assert.equal(s.attributes.find((a) => a.key === 'shelf_life_months').required, true, 'dairy makes shelf life required');
  });

  it('Milk inherits the dairy attributes and adds its own', () => {
    const s = resolveAttributeSchema(slugOf('Food & Beverages'), 'Dairy Products', 'Milk');
    for (const k of ['milk_type', 'fat_percent', 'packaging_volume', 'shelf_life_months', 'packaging_type']) assert.ok(keys(s).includes(k), k);
    assert.ok(!keys(s).includes('ghee_type'));
  });

  it('covers the other requested examples', () => {
    const chargers = labels(resolveAttributeSchema(slugOf('Mobiles & Accessories'), 'Chargers'));
    for (const l of ['Charger Type', 'Output Power', 'Input Voltage', 'Output Voltage', 'Connector Type', 'Fast Charging Support', 'Compatible Devices', 'Warranty']) assert.ok(chargers.includes(l), l);
    const tshirt = labels(resolveAttributeSchema(slugOf('Fashion & Apparel'), "Men's Clothing", 'T-Shirts'));
    for (const l of ['Fabric / Material', 'Available Sizes', 'Available Colours', 'Fabric GSM', 'Fit Type', 'Sleeve Type', 'Pattern', 'Washing Instructions']) assert.ok(tshirt.includes(l), l);
    const cnc = labels(resolveAttributeSchema(slugOf('Industrial Machinery'), 'CNC Machines'));
    for (const l of ['Machine Type', 'Number of Axes', 'Power Consumption', 'Operating Voltage', 'Production Capacity', 'Dimensions (L × W × H)', 'Weight', 'Control System', 'Warranty', 'Condition']) assert.ok(cnc.includes(l), l);
    const cement = labels(resolveAttributeSchema(slugOf('Building & Construction Materials'), 'Cement'));
    for (const l of ['Cement Type', 'Grade', 'Packaging Weight', 'Applicable Standard', 'Manufacturing Date', 'Strength Specification', 'Storage Requirements']) assert.ok(cement.includes(l), l);
    const chair = labels(resolveAttributeSchema(slugOf('Furniture'), 'Office Furniture', 'Office Chairs'));
    for (const l of ['Frame Material', 'Upholstery Material', 'Dimensions (L × W × H)', 'Weight Capacity', 'Adjustable Height', 'Colour', 'Assembly Required', 'Warranty']) assert.ok(chair.includes(l), l);
  });

  it('works for existing (legacy) category slugs such as machinery', () => {
    assert.ok(keys(resolveAttributeSchema('machinery', 'CNC Machines')).includes('axes'));
  });
});

describe('Specification validation (server side)', () => {
  const ghee = resolveAttributeSchema(slugOf('Food & Beverages'), 'Dairy Products', 'Ghee');
  const valid = { ghee_type: 'Cow Ghee', milk_fat_percent: '99.5', net_weight: '15', shelf_life_months: '9', packaging_type: 'Tin', storage_conditions: 'Below 25 °C' };

  it('accepts valid values and coerces numbers', () => {
    const { values, errors } = validateSpecificationValues(ghee, valid);
    assert.deepEqual(errors, {});
    assert.equal(values.milk_fat_percent, 99.5);
    assert.equal(values.shelf_life_months, 9);
  });

  it('rejects missing required values, out-of-range percentages, invalid options and unknown keys', () => {
    const { errors } = validateSpecificationValues(ghee, { ...valid, ghee_type: '', milk_fat_percent: '150', packaging_type: 'Sack', hacked_field: 'x' });
    assert.match(errors.ghee_type, /required/);
    assert.match(errors.milk_fat_percent, /at most 100/);
    assert.match(errors.packaging_type, /valid option/);
    assert.match(errors.hacked_field, /not defined/);
  });

  it('rejects non-integers for whole-number fields and validates multiselect options', () => {
    const tshirt = resolveAttributeSchema(slugOf('Fashion & Apparel'), "Men's Clothing", 'T-Shirts');
    const { errors } = validateSpecificationValues(tshirt, { fabric: 'Cotton', size_range: ['M', 'HUGE'], colour: 'Navy', sleeve_type: 'Half Sleeve', gsm: '180.5' });
    assert.match(errors.size_range, /invalid option: HUGE/);
    assert.match(errors.gsm, /whole number/);
  });

  it('builds a clean display map: only filled values, units and Yes/No formatting, product type first', () => {
    const { values } = validateSpecificationValues(ghee, valid);
    const display = buildDisplaySpecifications(ghee, values);
    assert.equal(display['Product Type'], 'Ghee');
    assert.equal(display['Milk Fat'], '99.5 %');
    assert.equal(display['Shelf Life'], '9 months');
    assert.ok(!Object.values(display).some((v) => v === '' || v === undefined || v === null || /undefined/.test(v)));
  });
});
