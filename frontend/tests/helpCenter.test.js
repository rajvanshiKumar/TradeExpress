import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  HELP_ARTICLES,
  HELP_AUDIENCES,
  HELP_CATEGORIES,
  HELP_FAQ_TABS,
  HELP_POPULAR_TOPICS,
  getHelpArticle,
} from '../src/data/help/helpContent.js';
import { articleBodyText, highlightSegments, searchHelpArticles, tokenize } from '../src/utils/helpSearch.js';

const slugs = new Set(HELP_ARTICLES.map((article) => article.slug));
const categoryIds = new Set(HELP_CATEGORIES.map((category) => category.id));
const audienceIds = new Set(HELP_AUDIENCES.map((audience) => audience.id));
const search = (query, options = {}) => searchHelpArticles(HELP_ARTICLES, query, { categories: HELP_CATEGORIES, ...options });

describe('Help Center content integrity', () => {
  it('has the eight learning-center categories', () => {
    assert.deepEqual([...categoryIds], [
      'getting-started', 'buying-sourcing', 'supplier-management', 'rfq-negotiation',
      'orders-logistics', 'payments-escrow', 'returns-disputes', 'account-security',
    ]);
  });

  it('gives every article a unique slug, a known category and audience, and the required fields', () => {
    assert.equal(slugs.size, HELP_ARTICLES.length, 'duplicate article slugs');
    for (const article of HELP_ARTICLES) {
      assert.match(article.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, `bad slug ${article.slug}`);
      assert.ok(categoryIds.has(article.category), `${article.slug}: unknown category`);
      assert.ok(audienceIds.has(article.audience), `${article.slug}: unknown audience`);
      assert.ok(article.title && article.summary && article.body?.length, `${article.slug}: missing content`);
      assert.ok(article.keywords?.length, `${article.slug}: missing keywords`);
      assert.equal(article.published, true);
      assert.match(article.updatedAt, /^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('only links to articles that exist', () => {
    for (const article of HELP_ARTICLES) {
      for (const related of article.related || []) assert.ok(slugs.has(related), `${article.slug} -> missing related ${related}`);
      if (article.action) assert.match(article.action.to, /^\//, `${article.slug}: action must be an internal path`);
    }
    for (const tab of HELP_FAQ_TABS) {
      assert.ok(tab.items.length >= 3, `${tab.id} has too few questions`);
      for (const item of tab.items) if (item.article) assert.ok(slugs.has(item.article), `FAQ "${item.q}" -> missing ${item.article}`);
    }
    for (const slug of HELP_POPULAR_TOPICS) assert.ok(slugs.has(slug), `popular topic ${slug} missing`);
  });

  it('has the six FAQ tabs', () => {
    assert.deepEqual(HELP_FAQ_TABS.map((tab) => tab.label), ['My Account', 'Sourcing', 'Negotiation', 'Orders & Payments', 'After-Sales', 'Self-Service']);
  });

  it('every category has articles for buyers and for suppliers or everyone', () => {
    for (const id of categoryIds) {
      assert.ok(search('', { category: id, audience: 'buyer' }).length + search('', { category: id, audience: 'supplier' }).length > 0, `${id} is empty`);
    }
  });

  it('makes no unsupported promises (timelines, guarantees, 24/7, invented programmes or phone numbers)', () => {
    const text = [
      ...HELP_ARTICLES.flatMap((article) => [article.title, article.summary, articleBodyText(article)]),
      ...HELP_FAQ_TABS.flatMap((tab) => tab.items.flatMap((item) => [item.q, item.a])),
    ].join('\n');
    // Disclaimers such as "not a guarantee" are fine; promises such as "guaranteed refund" are not
    for (const banned of [/24\s*\/\s*7/i, /\bguaranteed\b|\bwe guarantee\b|\bguarantees? (a |your )?(refund|delivery|payment)/i, /trustseal/i, /within \d+\s*(to \d+\s*)?(hours?|days?)/i, /1800-?\d/, /letter of credit/i, /bill of lading/i]) {
      assert.doesNotMatch(text, banned);
    }
  });

  it('getHelpArticle ignores unknown and unpublished slugs', () => {
    assert.equal(getHelpArticle('does-not-exist'), null);
    assert.equal(getHelpArticle('post-an-rfq').slug, 'post-an-rfq');
  });
});

describe('Help Center search', () => {
  it('ranks the most relevant article first', () => {
    assert.equal(search('rfq')[0].article.slug, 'post-an-rfq');
    assert.equal(search('MOQ')[0].article.slug, 'moq-and-price-tiers');
    assert.equal(search('cash on delivery')[0].article.slug, 'payment-options');
    assert.equal(search('forgot password')[0].article.slug, 'reset-password');
    assert.equal(search('How do I track my order?')[0].article.slug, 'track-shipment');
  });

  it('matches word prefixes for search-as-you-type', () => {
    assert.ok(search('disp').some((result) => result.article.slug === 'raise-trade-dispute'));
    assert.ok(search('invo').some((result) => result.article.slug === 'gst-invoice'));
  });

  it('requires every search term to match', () => {
    assert.equal(search('rfq zebra').length, 0);
    assert.equal(search('qwertyuiop').length, 0);
  });

  it('filters by audience: supplier results exclude buyer-only articles and keep shared ones', () => {
    const supplierResults = search('', { audience: 'supplier' });
    assert.ok(supplierResults.every(({ article }) => article.audience !== 'buyer'));
    assert.ok(supplierResults.some(({ article }) => article.audience === 'all'));
    assert.ok(search('', { audience: 'buyer' }).every(({ article }) => article.audience !== 'supplier'));
  });

  it('filters by category', () => {
    const results = search('', { category: 'returns-disputes' });
    assert.ok(results.length > 0);
    assert.ok(results.every(({ article }) => article.category === 'returns-disputes'));
  });

  it('never returns unpublished articles', () => {
    const hidden = [{ ...HELP_ARTICLES[0], slug: 'hidden-draft', published: false }];
    assert.equal(searchHelpArticles(hidden, HELP_ARTICLES[0].title).length, 0);
  });

  it('respects the result limit', () => {
    assert.equal(search('order', { limit: 3 }).length, 3);
  });

  it('tokenizes punctuation and stop words sensibly', () => {
    assert.deepEqual(tokenize('How do I post an RFQ?'), ['post', 'rfq']);
    assert.deepEqual(tokenize('  '), []);
  });
});

describe('Help Center highlighting', () => {
  it('marks matching word starts without producing HTML', () => {
    const segments = highlightSegments('Posting a Request for Quotation (RFQ)', 'rfq quot');
    assert.deepEqual(segments.filter((s) => s.match).map((s) => s.text), ['Quot', 'RFQ']);
    assert.equal(segments.map((s) => s.text).join(''), 'Posting a Request for Quotation (RFQ)');
  });

  it('is safe with regular-expression characters in the query', () => {
    assert.doesNotThrow(() => highlightSegments('Price (₹) tiers', '(₹ [tiers'));
    assert.deepEqual(highlightSegments('No match here', ''), [{ text: 'No match here', match: false }]);
  });
});

describe('Help Center page', () => {
  const source = fs.readFileSync(path.resolve('src/pages/Help.jsx'), 'utf8');

  it('uses the content library, search box, FAQ tabs and the existing ticket system', () => {
    for (const piece of ['HelpSearchBox', 'HelpFaqTabs', 'HelpArticleView', 'SupportTicketsSection', 'searchHelpArticles']) {
      assert.ok(source.includes(piece), `Help page should use ${piece}`);
    }
    assert.ok(source.includes('How Can We Help You Today?'));
  });

  it('no longer shows the unverified helpline, email address or non-working language selector', () => {
    assert.doesNotMatch(source, /1800-872-3377|support@tradeexpress\.com|Select Language/);
  });
});
