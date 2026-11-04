import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { matchSegments } from '../src/utils/textHighlight.js';

describe('Search suggestion highlighting', () => {
  it('marks every case-insensitive occurrence, including inside words', () => {
    const segments = matchSegments('ANC Wireless Gaming Headset', 'ea');
    assert.deepEqual(segments.filter((s) => s.match).map((s) => s.text), ['ea']);
    assert.equal(segments.map((s) => s.text).join(''), 'ANC Wireless Gaming Headset');
    assert.deepEqual(matchSegments('Cotton Cot', 'cot').filter((s) => s.match).map((s) => s.text), ['Cot', 'Cot']);
  });

  it('works for a single character and leaves text untouched without a query', () => {
    assert.ok(matchSegments('Electric Saw', 'e').filter((s) => s.match).length >= 2);
    assert.deepEqual(matchSegments('Electric Saw', ''), [{ text: 'Electric Saw', match: false }]);
  });

  it('treats regular-expression characters literally', () => {
    assert.doesNotThrow(() => matchSegments('Size (L) 100%', '(l'));
    assert.deepEqual(matchSegments('Size (L) 100%', '(l').filter((s) => s.match).map((s) => s.text), ['(L']);
  });
});

describe('Live search wiring', () => {
  const hook = fs.readFileSync(path.resolve('src/hooks/useSearchSuggestions.js'), 'utf8');
  const form = fs.readFileSync(path.resolve('src/components/forms/SearchForm.jsx'), 'utf8');
  const panel = fs.readFileSync(path.resolve('src/components/search/SearchSuggestions.jsx'), 'utf8');

  it('debounces by 300 ms, cancels stale requests and caches answers', () => {
    assert.match(hook, /SUGGESTION_DEBOUNCE_MS = 300/);
    assert.match(hook, /controllerRef\.current\?\.abort\(\)/);
    assert.match(hook, /cache\.get\(key\)/);
    assert.match(hook, /\/products\/suggest\?q=/);
  });

  it('supports arrow keys, Enter and Escape, and closes on outside clicks', () => {
    for (const key of ["'ArrowDown'", "'ArrowUp'", "'Enter'", "'Escape'"]) assert.ok(form.includes(`event.key === ${key}`), `missing ${key}`);
    assert.match(form, /if \(!formRef\.current\?\.contains\(event\.target\)\) setSuggestOpen\(false\)/);
    assert.match(form, /role=\{suggestionsEnabled \? 'combobox' : undefined\}/);
  });

  it('shows loading, error and no-results states', () => {
    assert.match(panel, /Searching…/);
    assert.match(panel, /Suggestions are unavailable right now/);
    assert.match(panel, /No results found for/);
  });
});
