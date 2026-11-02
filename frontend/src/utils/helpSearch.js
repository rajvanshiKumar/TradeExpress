// Help Center search: in-browser keyword search over the help articles.
// Pure functions (no React, no DOM) so they can be unit-tested and reused by future search pages.

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'can', 'do', 'does', 'for', 'how', 'i', 'in', 'is', 'it', 'my', 'of', 'on', 'or',
  'the', 'to', 'what', 'when', 'where', 'which', 'why', 'with', 'you', 'your',
]);

/** Lower-cases and strips punctuation so "RFQ?" and "rfq" match. */
export function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9%₹]+/g, ' ')
    .trim();
}

/** Search terms from a query: normalised words without stop words (kept if the query is only stop words). */
export function tokenize(query) {
  const words = normalizeText(query).split(' ').filter(Boolean);
  const meaningful = words.filter((word) => !STOP_WORDS.has(word));
  return meaningful.length ? meaningful : words;
}

/** Flattens an article body (paragraphs, steps, lists, notes) into plain text. */
export function articleBodyText(article) {
  return (article.body || [])
    .map((block) => {
      if (typeof block === 'string') return block;
      return [...(block.steps || []), ...(block.list || []), block.note || ''].join(' ');
    })
    .join(' ');
}

const wordsOf = (text) => normalizeText(text).split(' ').filter(Boolean);

/** Score for one term in one field: whole-word match beats a prefix match (for search-as-you-type). */
function termScore(term, words, weight) {
  if (words.includes(term)) return weight;
  if (term.length >= 2 && words.some((word) => word.startsWith(term))) return weight * 0.6;
  return 0;
}

/**
 * Ranks articles for a query. Every term must match somewhere in the article.
 * Weights: title 10, keywords 6, summary 3, category 2, body 1; a full-phrase match in the title adds 8.
 * Options: audience ('buyer' | 'supplier' | 'all'), category (id), categories (for category title matching), limit.
 * Returns [{ article, score }] in descending score order.
 */
export function searchHelpArticles(articles, query, { audience = 'all', category = '', categories = [], limit = 0 } = {}) {
  const terms = tokenize(query);
  const categoryTitles = new Map(categories.map((c) => [c.id, c.title]));

  const candidates = articles.filter((article) => {
    if (article.published === false) return false;
    if (category && article.category !== category) return false;
    if (audience !== 'all' && article.audience !== 'all' && article.audience !== audience) return false;
    return true;
  });

  if (!terms.length) {
    const all = candidates.map((article) => ({ article, score: 0 }));
    return limit ? all.slice(0, limit) : all;
  }

  const phrase = normalizeText(query);
  const results = [];
  for (const article of candidates) {
    const fields = {
      title: wordsOf(article.title),
      keywords: wordsOf((article.keywords || []).join(' ')),
      summary: wordsOf(article.summary),
      category: wordsOf(categoryTitles.get(article.category) || ''),
      body: wordsOf(articleBodyText(article)),
    };

    let score = 0;
    let allTermsMatch = true;
    for (const term of terms) {
      const termTotal = termScore(term, fields.title, 10)
        + termScore(term, fields.keywords, 6)
        + termScore(term, fields.summary, 3)
        + termScore(term, fields.category, 2)
        + termScore(term, fields.body, 1);
      if (termTotal === 0) {
        allTermsMatch = false;
        break;
      }
      score += termTotal;
    }
    if (!allTermsMatch) continue;

    if (phrase.includes(' ') && normalizeText(article.title).includes(phrase)) score += 8;
    // Multi-word keyword phrases (e.g. "cash on delivery") count as a strong signal
    if ((article.keywords || []).some((keyword) => normalizeText(keyword) === phrase)) score += 6;
    results.push({ article, score });
  }

  results.sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title));
  return limit ? results.slice(0, limit) : results;
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Splits text into segments for highlighting the query terms (word starts, case-insensitive).
 * Returns [{ text, match }]; render matches with <mark>. No HTML is produced, so it is safe to render.
 */
export function highlightSegments(text, query) {
  const source = String(text ?? '');
  const terms = tokenize(query).filter((term) => term.length >= 2);
  if (!source || !terms.length) return [{ text: source, match: false }];

  const pattern = new RegExp(`\\b(${terms.map(escapeRegExp).sort((a, b) => b.length - a.length).join('|')})`, 'gi');
  const segments = [];
  let lastIndex = 0;
  for (const found of source.matchAll(pattern)) {
    if (found.index > lastIndex) segments.push({ text: source.slice(lastIndex, found.index), match: false });
    segments.push({ text: found[0], match: true });
    lastIndex = found.index + found[0].length;
  }
  if (lastIndex < source.length) segments.push({ text: source.slice(lastIndex), match: false });
  return segments.length ? segments : [{ text: source, match: false }];
}
