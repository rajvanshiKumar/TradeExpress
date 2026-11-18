import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(here, p), 'utf8');

describe('Supplier products come from the database everywhere', () => {
  it('Product Catalogue, sidebar badges and the edit page use the shared database list, not the browser catalogue', () => {
    const catalogue = read('../src/pages/supplier/SupplierProducts.jsx');
    assert.match(catalogue, /useMyProducts\(\)/);
    assert.doesNotMatch(catalogue, /updateProduct\(|deleteProduct\(|addProduct\(/, 'no browser-only product changes');
    assert.match(catalogue, /<ErrorState text=\{error\} onRetry=\{reload\} \/>/, 'errors stop loading and offer retry');
    assert.match(read('../src/components/layout/SupplierSidebar.jsx'), /useMyProducts\(\)/);
    assert.match(read('../src/pages/supplier/SupplierProductForm.jsx'), /getMyProduct\(id\)/);
  });

  it('answers for a previous account are ignored, and only suppliers load the list', () => {
    const hook = read('../src/hooks/useMyProducts.js');
    assert.match(hook, /if \(store\.owner !== owner\) return; \/\/ signed out \/ switched meanwhile/);
    assert.match(hook, /user\?\.role === 'supplier'/);
  });
});
