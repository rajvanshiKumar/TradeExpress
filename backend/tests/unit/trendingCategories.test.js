import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rankTrendingCategories } from '../../src/services/trendingCategoryService.js';

const live = { electronics: 10, packaging: 4, toys: 2, furniture: 6, empty: 0 };
const slugs = (rows) => rows.map((row) => row.slug);

describe('Trending categories', () => {
  it('ranks by recent orders, counting each order once per category', () => {
    const orderLines = [
      // One order with three packaging lines still counts as one order
      { orderId: 'o1', categorySlug: 'packaging' }, { orderId: 'o1', categorySlug: 'packaging' }, { orderId: 'o1', categorySlug: 'packaging' },
      { orderId: 'o2', categorySlug: 'toys' }, { orderId: 'o3', categorySlug: 'toys' },
    ];
    const ranked = rankTrendingCategories({ orderLines, liveProducts: live, limit: 3 });
    assert.deepEqual(slugs(ranked), ['toys', 'packaging', 'electronics']);
    assert.equal(ranked[1].orders, 1);
  });

  it('lets a Super Admin promote a category by marking its products trending', () => {
    const ranked = rankTrendingCategories({ orderLines: [{ orderId: 'o1', categorySlug: 'toys' }], adminTrending: { furniture: 1 }, liveProducts: live, limit: 2 });
    assert.deepEqual(slugs(ranked), ['furniture', 'toys']);
  });

  it('marking many products in one category does not outweigh real orders', () => {
    const orderLines = [1, 2, 3, 4, 5].map((n) => ({ orderId: 'o' + n, categorySlug: 'toys' }));
    const ranked = rankTrendingCategories({ orderLines, adminTrending: { furniture: 40 }, liveProducts: live, limit: 2 });
    assert.deepEqual(slugs(ranked), ['toys', 'furniture']);
  });

  it('fills remaining places by number of live products, so a new site still shows a full row', () => {
    assert.deepEqual(slugs(rankTrendingCategories({ liveProducts: live, limit: 3 })), ['electronics', 'furniture', 'packaging']);
  });

  it('never shows a category without live products, even if it had orders', () => {
    const ranked = rankTrendingCategories({ orderLines: [{ orderId: 'o1', categorySlug: 'empty' }, { orderId: 'o2', categorySlug: 'gone' }], liveProducts: live, limit: 10 });
    assert.ok(!slugs(ranked).includes('empty'));
    assert.ok(!slugs(ranked).includes('gone'));
  });

  it('keeps the list size within sensible bounds', () => {
    assert.equal(rankTrendingCategories({ liveProducts: live, limit: 0 }).length, 1);
    assert.equal(rankTrendingCategories({ liveProducts: live, limit: 500 }).length, 4);
  });
});
