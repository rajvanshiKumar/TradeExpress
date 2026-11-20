import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { uploadDir, uploaderTag } from '../../src/middleware/uploadMiddleware.js';
import { fitText, getListingJob, mapResultToForm, matchCategory, resolveSupplierPhoto } from '../../src/services/listingAiService.js';

// TradeExpress categories as stored in the database
const CATEGORIES = [
  { slug: 'furniture', name: 'Furniture', subcategories: ['Living Room', 'Office', 'Lighting'] },
  { slug: 'fashion-apparel', name: 'Fashion & Apparel', subcategories: ['T-Shirts', 'Hoodies', 'Shirts', 'Bags & Accessories'] },
  { slug: 'electronics', name: 'Electronics', subcategories: ['Audio', 'Wearables', 'Mobile Accessories', 'Computer Peripherals'] },
  { slug: 'sports-outdoors', name: 'Sports & Outdoors', subcategories: ['Footwear', 'Outdoor Gear'] },
  { slug: 'machinery', name: 'Machinery', subcategories: ['Power Tools', 'CNC & Machine Tools'] },
  { slug: 'https://urbansstride.com/', name: 'Raj store', subcategories: ['https://urbansstride.com/'] },
];

const aiCat = (slug, name, parents = []) => ({ slug, name, confidence: 0.95, candidates: [slug, ...parents].map((s) => ({ slug: s })) });

// The real AI answer for the sofa photo, trimmed
const sofaResult = {
  category: aiCat('sofas', 'Sofas', ['living-room-furniture', 'furniture']),
  attributes: [
    { attribute_key: 'color', final_value: 'Dark Brown', routing: 'prefill', requires_review: true },
    { attribute_key: 'material', final_value: 'Genuine Leather', routing: 'prefill' },
    { attribute_key: 'seating_capacity', final_value: 2, routing: 'confirm' },
    { attribute_key: 'brand', final_value: null, routing: 'empty' },
  ],
  content: {
    title: { value: 'Classic Chesterfield 2-Seater Sofa - Dark Brown Genuine Leather with Button Tufting and Rolled Arms' },
    short_title: { value: 'Chesterfield 2-Seater Leather Sofa' },
    short_description: { value: 'Upgrade your living space with this classic 2-seater Chesterfield sofa crafted from premium genuine leather in a rich dark brown finish. Featuring timeless button tufting and elegant rolled arms for sophisticated comfort.' },
    long_description: { value: 'Transform your living room into a sophisticated retreat with this classic Chesterfield 2-seater sofa.' },
    highlights: { value: ['Premium genuine leather', 'Deep button tufting'] },
  },
  quality: { warnings: [{ code: 'attributes_need_confirmation', message: 'Please confirm: seating_capacity' }] },
};

test('Product Listing AI for suppliers', async (t) => {
  await t.test('AI categories map to TradeExpress categories and subcategories', () => {
    assert.deepEqual(matchCategory(sofaResult.category, CATEGORIES), { slug: 'furniture', name: 'Furniture', subcategory: 'Living Room' });
    assert.equal(matchCategory(aiCat('mens-tshirts', 'Men T-Shirts', ['mens-clothing', 'clothing-fashion']), CATEGORIES).slug, 'fashion-apparel');
    assert.equal(matchCategory(aiCat('mens-tshirts', 'Men T-Shirts', ['mens-clothing', 'clothing-fashion']), CATEGORIES).subcategory, 'T-Shirts');
    assert.deepEqual(matchCategory(aiCat('headphones', 'Headphones', ['audio', 'electronics']), CATEGORIES), { slug: 'electronics', name: 'Electronics', subcategory: 'Audio' });
    assert.equal(matchCategory(aiCat('sneakers', 'Sneakers', ['footwear', 'clothing-fashion']), CATEGORIES).subcategory, 'Footwear');
    assert.equal(matchCategory(aiCat('drills', 'Drills', ['power-tools', 'tools-hardware']), CATEGORIES).slug, 'machinery');
  });

  await t.test('no confident match leaves the category for the supplier; malformed categories are ignored', () => {
    assert.equal(matchCategory(aiCat('pet-food', 'Pet Food', ['pet-supplies']), CATEGORIES), null);
    assert.equal(matchCategory(aiCat('urbansstride', 'urbansstride'), CATEGORIES), null);
    assert.equal(matchCategory(null, CATEGORIES), null);
  });

  await t.test('the AI result becomes form suggestions that fit the form limits', () => {
    const form = mapResultToForm(sofaResult, CATEGORIES);
    assert.equal(form.name, 'Chesterfield 2-Seater Leather Sofa', 'the long title (over 90) is replaced by the short title');
    assert.ok(form.summary.length <= 160 && form.summary.length >= 15, form.summary);
    assert.match(form.description, /Highlights:\n• Premium genuine leather\n• Deep button tufting/);
    assert.equal(form.specifications, 'Material: Genuine Leather\nSeating capacity: 2');
    assert.equal(form.colours, 'Dark Brown');
    assert.equal(form.category, 'furniture');
    assert.equal(form.subcategory, 'Living Room');
    assert.deepEqual(form.toConfirm, ['Color', 'Seating capacity']);
    assert.deepEqual(form.warnings, ['Please confirm: seating_capacity']);
  });

  await t.test('commercial terms are never suggested', () => {
    const form = mapResultToForm({ ...sofaResult, attributes: [...sofaResult.attributes, { attribute_key: 'price', final_value: 999, routing: 'prefill' }] }, CATEGORIES);
    for (const key of ['price', 'moq', 'stock', 'hsnCode', 'gstRate', 'leadTimeDays']) assert.ok(!(key in form), key);
    assert.match(form.specifications, /Price: 999/, 'an attribute named price only ever lands in the free-text specifications');
  });

  await t.test('long text is shortened at a word or sentence boundary', () => {
    assert.equal(fitText('Short text.', 160), 'Short text.');
    const cut = fitText('One sentence here. Another sentence that is quite a bit longer than the limit allows for.', 40);
    assert.ok(cut.length <= 40, cut);
    assert.equal(cut, 'One sentence here.');
    assert.ok(fitText('a'.repeat(300), 90).length <= 90);
  });

  await t.test('only the supplier’s own uploaded photos can be sent to the AI', (tt) => {
    const mine = `${uploaderTag('supplier-1')}-sofa_test.jpg`;
    const theirs = `${uploaderTag('supplier-2')}-sofa_test.jpg`;
    for (const name of [mine, theirs]) fs.writeFileSync(path.join(uploadDir, name), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    tt.after(() => [mine, theirs].forEach((name) => fs.rmSync(path.join(uploadDir, name), { force: true })));

    assert.equal(resolveSupplierPhoto(`http://localhost:5000/uploads/${mine}`, 'supplier-1'), path.join(uploadDir, mine));
    assert.equal(resolveSupplierPhoto(`/uploads/${mine}`, 'supplier-1'), path.join(uploadDir, mine));
    for (const url of [`/uploads/${theirs}`, '/uploads/../.env', 'https://evil.example/x.jpg', `/uploads/${mine.replace('.jpg', '.pdf')}`, '']) {
      assert.throws(() => resolveSupplierPhoto(url, 'supplier-1'), (e) => e.errorCode === 'AI_LISTING_PHOTO_INVALID' && e.statusCode === 400, url);
    }
  });

  await t.test('a job token only works for the supplier who started the job', async () => {
    await assert.rejects(getListingJob({ supplierId: 'supplier-1', jobToken: 'forged' }), (e) => e.statusCode === 404 && e.errorCode === 'AI_LISTING_NOT_FOUND');
  });
});
