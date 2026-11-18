import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { markProductsSeen, seenCatalogueStorageKey, unseenProductCount } from '../src/utils/catalogueBadge.js';

describe('Supplier Product Catalogue sidebar badge', () => {
  it('shows products not seen yet, then clears once the catalogue is opened', () => {
    const ids = ['P-1', 'P-2'];
    assert.equal(unseenProductCount(ids, []), 2);
    assert.equal(unseenProductCount(ids, markProductsSeen(ids)), 0, 'the 2 must disappear after viewing');
  });

  it('a newly added product shows again; deleted products never count', () => {
    const seen = markProductsSeen(['P-1', 'P-2']);
    assert.equal(unseenProductCount(['P-1', 'P-2', 'P-3'], seen), 1);
    assert.equal(unseenProductCount(['P-1'], seen), 0);
  });

  it('is stored per supplier, separately from the buyer Saved Products badge', () => {
    assert.match(seenCatalogueStorageKey('U-1'), /seen-catalogue-products:U-1$/);
  });

  it('the sidebar uses the unseen count (not the total product count)', () => {
    const sidebar = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/components/layout/SupplierSidebar.jsx'), 'utf8');
    assert.match(sidebar, /return newProductsCount > 0/);
    assert.doesNotMatch(sidebar, /companyProducts\?\.length > 0 \? companyProducts\.length/);
  });
});
