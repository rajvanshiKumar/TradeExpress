import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORY_GROUPS, CATEGORY_TAXONOMY, slugify } from '../../src/data/categoryTaxonomy.js';

// (category slug, subcategory) pairs used by existing products, read from the database on 2026-11-16
const EXISTING_PRODUCT_PAIRS = {
  agriculture: ['Farm Equipment', 'Gardening'],
  automotive: ['Garage Equipment', 'Interior Accessories'],
  'beauty-personal-care': ['Makeup', 'Skincare', 'Sun Care', 'Tools'],
  electronics: ['Audio', 'Computer Peripherals', 'Mobile Accessories', 'Wearables'],
  'fashion-apparel': ['Bags & Accessories', 'Denim', 'Hoodies', 'Knitwear', 'Outerwear', 'Shirts', 'T-Shirts'],
  furniture: ['Lighting', 'Living Room', 'Office'],
  'home-kitchen': ['Bedding', 'Home Decor', 'Home Fragrance', 'Tableware'],
  'industrial-supplies': ['Hand Tools', 'Safety & PPE', 'Valves & Fittings'],
  machinery: ['CNC & Machine Tools', 'Power Tools', 'Workshop Equipment'],
  packaging: ['Corrugated Boxes', 'Cosmetic Packaging', 'Glass Packaging', 'Paper Packaging'],
  'sports-outdoors': ['Footwear', 'Outdoor Gear'],
  'toys-games': ['Gaming Accessories', 'Wooden Toys'],
};

describe('B2B category taxonomy', () => {
  it('has exactly 60 main categories in 10 industry groups', () => {
    assert.equal(CATEGORY_TAXONOMY.length, 60);
    assert.equal(CATEGORY_GROUPS.length, 10);
    assert.equal(CATEGORY_GROUPS.reduce((n, g) => n + g.categories.length, 0), 60);
  });

  it('has no duplicate category slugs or names, and URL-safe slugs', () => {
    const slugs = CATEGORY_TAXONOMY.map((c) => c.slug);
    assert.equal(new Set(slugs).size, slugs.length, 'duplicate category slug');
    assert.equal(new Set(CATEGORY_TAXONOMY.map((c) => c.name.toLowerCase())).size, 60, 'duplicate category name');
    slugs.forEach((s) => assert.match(s, /^[a-z0-9]+(-[a-z0-9]+)*$/, s));
  });

  it('has no duplicate subcategory slugs within a category, and every category has subcategories', () => {
    for (const c of CATEGORY_TAXONOMY) {
      assert.ok(c.subcategories.length >= 5, `${c.name} has too few subcategories`);
      const subSlugs = c.subcategories.map((s) => s.slug);
      assert.equal(new Set(subSlugs).size, subSlugs.length, `duplicate subcategory in ${c.name}`);
    }
  });

  it('keeps the 12 existing category slugs so no existing product changes category', () => {
    const slugs = new Set(CATEGORY_TAXONOMY.map((c) => c.slug));
    for (const legacy of Object.keys(EXISTING_PRODUCT_PAIRS)) assert.ok(slugs.has(legacy), `missing existing slug ${legacy}`);
  });

  it('keeps every subcategory existing products use, so no listing is misclassified', () => {
    for (const [slug, subs] of Object.entries(EXISTING_PRODUCT_PAIRS)) {
      const cat = CATEGORY_TAXONOMY.find((c) => c.slug === slug);
      const names = new Set(cat.subcategories.map((s) => s.name.toLowerCase()));
      for (const sub of subs) assert.ok(names.has(sub.toLowerCase()), `${slug} lost subcategory "${sub}"`);
    }
  });

  it('places requested subcategories under the right main category (spot checks) and supports product types', () => {
    const sub = (cat, name) => CATEGORY_TAXONOMY.find((c) => c.name === cat)?.subcategories.find((s) => s.name === name);
    assert.ok(sub('Food & Beverages', 'Ghee'));
    assert.ok(sub('Industrial Machinery', 'CNC Machines'));
    assert.ok(sub('Solar & Renewable Energy', 'Solar Inverters'));
    assert.ok(sub('Garden, Outdoor & Landscaping', 'Greenhouse Equipment'));
    assert.ok(sub('Industrial Machinery', 'CNC Machines').productTypes.some((t) => t.name === 'CNC Lathe Machines'));
    assert.ok(sub('Food & Beverages', 'Dairy Products').productTypes.some((t) => t.name === 'Ghee'));
    assert.equal(slugify("Men's Clothing"), 'mens-clothing');
  });

  it('marks regulated sectors', () => {
    const regulated = CATEGORY_TAXONOMY.filter((c) => c.regulated).map((c) => c.name);
    for (const name of ['Pharmaceuticals & Healthcare Supplies', 'Medical & Healthcare Equipment', 'Industrial Chemicals', 'Agriculture & Farming']) {
      assert.ok(regulated.includes(name), `${name} should be regulated`);
    }
  });
});
