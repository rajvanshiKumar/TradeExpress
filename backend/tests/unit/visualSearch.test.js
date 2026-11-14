import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../../src/config/db.js';
import { ENV } from '../../src/config/env.js';
import app from '../../src/app.js';
import {
  candidateTerms,
  normaliseAnalysis,
  rankProducts,
  searchByImage,
  singular,
} from '../../src/services/visualSearchService.js';

// All database access goes through this stub; nothing reaches a real database
let prismaStub;
prisma.$use(async (params) => (prismaStub ? prismaStub(params) : null));

const CATEGORIES = [
  { id: 'c1', slug: 'beauty-personal-care', name: 'Beauty & Personal Care', subcategories: ['Makeup', 'Tools'], _count: { products: 3 } },
  { id: 'c2', slug: 'packaging', name: 'Packaging', subcategories: ['Paper Bags'], _count: { products: 1 } },
];
const product = (id, name, categorySlug, subcategory, summary = '') => ({
  id, name, slug: id, categorySlug, subcategory, summary, description: '', status: 'Active', price: 100,
  supplierId: null, images: [], reviews: [], category: { name: categorySlug, slug: categorySlug },
});
const CATALOGUE = [
  product('p-bag', 'Kraft Paper Shopping Bags', 'packaging', 'Paper Bags', 'Twisted handle carry bags.'),
  product('p-lip', 'Velvet Matte Lipstick', 'beauty-personal-care', 'Makeup', 'Long-wear matte lipstick.'),
  product('p-brush', 'Professional Makeup Brush Set (12 pc)', 'beauty-personal-care', 'Tools', 'Twelve synthetic brushes with a travel roll.'),
  product('p-drill', 'Cordless Impact Drill', 'machinery', 'Power Tools'),
];

/** Database stub: categories, and product queries filtered by the OR terms like MySQL "contains" would. */
function stubDatabase(t, { catalogue = CATALOGUE } = {}) {
  const productQueries = [];
  prismaStub = async (q) => {
    if (q.model === 'Category' && q.action === 'findMany') return CATEGORIES;
    if (q.model === 'Product' && (q.action === 'findMany' || q.action === 'count')) {
      productQueries.push(q.args);
      const where = q.args?.where || {};
      const matches = catalogue.filter((p) => {
        if (where.status && p.status !== where.status) return false;
        if (where.name?.in) return where.name.in.includes(p.name);
        if (where.categorySlug && p.categorySlug !== where.categorySlug) return false;
        if (!where.OR) return true;
        return where.OR.some((cond) => {
          const [field, test] = Object.entries(cond)[0];
          return String(p[field] || '').toLowerCase().includes(String(test.contains).toLowerCase());
        });
      });
      return q.action === 'count' ? matches.length : matches;
    }
    if (q.model === 'User' && q.action === 'findMany') return [];
    return null;
  };
  t.after(() => { prismaStub = null; });
  return productQueries;
}

/** Fakes the Gemini API; requests to anything else (the local test server) go through unchanged. */
function fakeGemini(t, answer, { status = 200 } = {}) {
  const calls = [];
  const realFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    if (!String(url).includes('generativelanguage.googleapis.com')) return realFetch(url, options);
    calls.push({ url: String(url), headers: options.headers, body: JSON.parse(options.body) });
    if (status !== 200) return new Response(JSON.stringify({ error: { message: 'failure' } }), { status });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] }), { status: 200 });
  });
  return calls;
}

function withKey(t, key = 'test-gemini-key') {
  const previous = ENV.GEMINI_API_KEY;
  ENV.GEMINI_API_KEY = key;
  t.after(() => { ENV.GEMINI_API_KEY = previous; });
}

const PHOTO = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]); // tiny JPEG-like payload
const MAKEUP_ANSWER = {
  isProduct: true,
  productName: 'makeup brush set in a cosmetic bag',
  searchTerms: ['makeup brush', 'cosmetic bag', 'makeup organizer'],
  categorySlug: 'beauty-personal-care',
  colors: ['pink'],
  material: 'faux leather',
};

describe('Visual search — recognises the photo, not the file name', () => {
  it('finds the makeup product from what is in the photo, best match first', async (t) => {
    withKey(t);
    stubDatabase(t);
    const calls = fakeGemini(t, MAKEUP_ANSWER);

    const result = await searchByImage({ buffer: PHOTO, mimeType: 'image/jpeg' });

    assert.equal(result.matchType, 'product');
    assert.equal(result.products[0].id, 'p-brush', 'the brush set must rank first');
    assert.ok(result.products.some((p) => p.id === 'p-lip'), 'other makeup is a related match');
    assert.ok(!result.products.some((p) => p.id === 'p-drill'), 'unrelated products are excluded');
    assert.equal(result.recognized.category.slug, 'beauty-personal-care');

    // The photo itself was sent for recognition, with the key in a header (never in the URL)
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.contents[0].parts[0].inline_data.data, PHOTO.toString('base64'));
    assert.equal(calls[0].body.contents[0].parts[0].inline_data.mime_type, 'image/jpeg');
    assert.equal(calls[0].headers['x-goog-api-key'], 'test-gemini-key');
    assert.doesNotMatch(calls[0].url, /test-gemini-key/);
  });

  it('only searches active products', async (t) => {
    withKey(t);
    const queries = stubDatabase(t, { catalogue: [{ ...CATALOGUE[2], status: 'Draft' }] });
    fakeGemini(t, MAKEUP_ANSWER);
    const result = await searchByImage({ buffer: PHOTO, mimeType: 'image/jpeg' });
    assert.equal(result.products.length, 0);
    assert.ok(queries.every((args) => !args?.where || args.where.status === 'Active' || args.where.name));
  });

  it('falls back to the recognised category, clearly labelled, when no product name matches', async (t) => {
    withKey(t);
    stubDatabase(t);
    fakeGemini(t, { isProduct: true, productName: 'nail polish', searchTerms: ['nail polish'], categorySlug: 'beauty-personal-care' });
    const result = await searchByImage({ buffer: PHOTO, mimeType: 'image/jpeg' });
    assert.equal(result.matchType, 'category');
    assert.ok(result.products.length > 0);
    assert.ok(result.products.every((p) => p.categorySlug === 'beauty-personal-care'));
  });

  it('returns no matches (not unrelated products) for a photo that is not a product', async (t) => {
    withKey(t);
    stubDatabase(t);
    fakeGemini(t, { isProduct: false, productName: 'mountain landscape', searchTerms: [], categorySlug: '' });
    const result = await searchByImage({ buffer: PHOTO, mimeType: 'image/jpeg' });
    assert.equal(result.matchType, 'none');
    assert.deepEqual(result.products, []);
  });

  it('reports a clear "not available" error when no API key is configured', async (t) => {
    withKey(t, '');
    await assert.rejects(searchByImage({ buffer: PHOTO, mimeType: 'image/jpeg' }), (err) => err.statusCode === 503 && err.errorCode === 'VISUAL_SEARCH_UNAVAILABLE');
  });

  it('reports a temporary failure when the vision service errors', async (t) => {
    withKey(t);
    stubDatabase(t);
    fakeGemini(t, null, { status: 500 });
    await assert.rejects(searchByImage({ buffer: PHOTO, mimeType: 'image/jpeg' }), (err) => err.statusCode === 502 && err.errorCode === 'VISUAL_SEARCH_FAILED');
  });
});

describe('Visual search — model output is sanitised before it reaches the database', () => {
  it('keeps only short plain-text terms and known categories', () => {
    const out = normaliseAnalysis({
      isProduct: true,
      productName: 'bag',
      searchTerms: ['cosmetic bag', '"; DROP TABLE products; --', `${'x'.repeat(200)}`, ''],
      categorySlug: 'not-a-real-category',
    }, ['beauty-personal-care']);
    assert.ok(out.phrases.every((p) => p.length <= 40 && !/[";]/.test(p)));
    assert.equal(out.categorySlug, null);
  });

  it('turns plurals into catalogue words', () => {
    assert.equal(singular('brushes'), 'brush');
    assert.equal(singular('batteries'), 'battery');
    assert.equal(singular('bags'), 'bag');
    assert.equal(singular('boxes'), 'box');
    assert.equal(singular('glass'), 'glass');
    assert.deepEqual(candidateTerms(['makeup brushes']), ['makeup brushes', 'makeup', 'brush']);
  });

  it('matches product names written without spaces or with hyphens ("MakeupBag", "Make-up Bag")', () => {
    const analysis = normaliseAnalysis({ isProduct: true, productName: 'makeup bag', searchTerms: ['makeup bag'], categorySlug: '' }, []);
    const ranked = rankProducts([
      product('p-a', 'MakeupBag', 'beauty-personal-care', 'Bags'),
      product('p-b', 'Make-up Bag Deluxe', 'beauty-personal-care', 'Bags'),
      product('p-c', 'Kraft Paper Shopping Bags', 'packaging', 'Paper Bags'),
    ], analysis);
    assert.deepEqual(ranked.slice(0, 2).map((p) => p.id).sort(), ['p-a', 'p-b']);
  });

  it('ranks phrase matches in the product name above loose word matches', () => {
    const ranked = rankProducts(CATALOGUE, normaliseAnalysis(MAKEUP_ANSWER, ['beauty-personal-care']));
    assert.equal(ranked[0].id, 'p-brush');
    assert.ok(ranked.findIndex((p) => p.id === 'p-bag') === -1 || ranked.findIndex((p) => p.id === 'p-bag') > ranked.findIndex((p) => p.id === 'p-lip'));
  });
});

describe('POST /api/products/visual-search', () => {
  const startServer = async (t) => {
    const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    return `http://127.0.0.1:${server.address().port}/api/products/visual-search`;
  };
  const upload = (url, { type = 'image/jpeg', bytes = PHOTO, name = 'makup.jpg' } = {}) => {
    const form = new FormData();
    form.append('image', new Blob([bytes], { type }), name);
    return fetch(url, { method: 'POST', body: form });
  };

  it('returns matches for an uploaded photo whatever its file name', async (t) => {
    withKey(t);
    stubDatabase(t);
    fakeGemini(t, MAKEUP_ANSWER);
    const url = await startServer(t);
    const res = await upload(url, { name: 'IMG_2041.jpg' });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.products[0].name, 'Professional Makeup Brush Set (12 pc)');
  });

  it('rejects non-image uploads, missing files and oversized photos with 400', async (t) => {
    withKey(t);
    const url = await startServer(t);
    const pdf = await upload(url, { type: 'application/pdf', name: 'file.pdf' });
    assert.equal(pdf.status, 400);
    const none = await fetch(url, { method: 'POST', body: new FormData() });
    assert.equal(none.status, 400);
    const big = await upload(url, { bytes: Buffer.alloc(5 * 1024 * 1024 + 1) });
    assert.equal(big.status, 400);
    assert.match((await big.json()).message, /larger than 5 MB/);
  });

  it('answers 503 with a clear message when visual search is not configured', async (t) => {
    withKey(t, '');
    const url = await startServer(t);
    const res = await upload(url);
    const body = await res.json();
    assert.equal(res.status, 503);
    assert.equal(body.code, 'VISUAL_SEARCH_UNAVAILABLE');
  });
});
