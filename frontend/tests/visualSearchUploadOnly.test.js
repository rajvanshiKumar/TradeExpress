import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Visual search (search-bar image button) is upload-only', () => {
  const modal = read('src/components/common/VisualSearchModal.jsx');
  const searchForm = read('src/components/forms/SearchForm.jsx');

  it('has no live camera: no camera tab, stream, capture input or camera permission request', () => {
    for (const pattern of [/Live Camera/, /getUserMedia/, /mediaDevices/, /capture="environment"/, /<video/, /activeTab/, /permissions\s*\.query/]) {
      assert.doesNotMatch(modal, pattern);
    }
    assert.equal(fs.existsSync(path.join(root, 'src/utils/cameraErrors.js')), false);
  });

  it('still searches by an uploaded image', () => {
    assert.match(modal, /type="file"\s+accept="image\/\*"/);
    assert.match(modal, /onChange=\{handleFileUpload\}/);
    assert.match(modal, /Upload a product image to find matching wholesale products/);
  });

  it('the search-bar button offers image search, not camera search', () => {
    assert.match(searchForm, /aria-label="Search by image"/);
    assert.doesNotMatch(searchForm, /camera/i);
  });
});

describe('Visual search recognises the photo (server-side AI), not the file name', () => {
  const modal = read('src/components/common/VisualSearchModal.jsx');
  const api = read('src/services/visualSearchApi.js');

  it('uploads the photo to the visual search endpoint', () => {
    assert.match(modal, /searchProductsByImage\(file, \{ signal: controller\.signal \}\)/);
    assert.match(api, /apiPost\('products\/visual-search', form/);
    assert.match(api, /form\.append\('image', image/);
  });

  it('no longer matches by file name, uses demo data or shows invented match percentages', () => {
    assert.doesNotMatch(modal, /extractKeywords|seedProducts|STOP_WORDS/);
    assert.doesNotMatch(modal, /% Match/);
  });

  it('labels category-only results and explains unavailable or failed searches', () => {
    assert.match(modal, /No exact match — similar products in/);
    assert.match(modal, /VISUAL_SEARCH_UNAVAILABLE/);
    assert.match(modal, /Try Again/);
  });

  it('cancels a running search when a new one starts or the window closes', () => {
    assert.match(modal, /requestRef\.current\?\.abort\(\)/);
    assert.match(modal, /if \(!isOpen\) reset\(\)/);
  });
});

describe('Visual search image resizing', () => {
  it('scales large photos down to 1280px on the longest side and never scales up', async () => {
    const { fitWithin } = await import('../src/utils/imageResize.js');
    assert.deepEqual(fitWithin(4032, 3024), { width: 1280, height: 960 });
    assert.deepEqual(fitWithin(3024, 4032), { width: 960, height: 1280 });
    assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600 });
  });
});
