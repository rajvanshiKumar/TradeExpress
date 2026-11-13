import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Header & About Section Navigation Test Suite', () => {
  const headerContent = fs.readFileSync(
    path.resolve(__dirname, '../src/components/layout/Header.jsx'),
    'utf-8'
  );
  const aboutMenuContent = fs.readFileSync(
    path.resolve(__dirname, '../src/components/layout/AboutMenu.jsx'),
    'utf-8'
  );
  const appRoutesContent = fs.readFileSync(
    path.resolve(__dirname, '../src/routes/AppRoutes.jsx'),
    'utf-8'
  );

  it('verifies Header imports and renders AboutMenu', () => {
    assert.ok(
      headerContent.includes("import AboutMenu from \"./AboutMenu\";"),
      'Header must import AboutMenu'
    );
    assert.ok(
      headerContent.includes("<AboutMenu active={isActive(\"/info/about\", location)} />"),
      'Header must render AboutMenu with active state'
    );
  });

  it('verifies Header navigation contains core B2B marketplace links', () => {
    assert.ok(headerContent.includes('{ label: "Products", to: "/products" }'), 'Must contain Products link');
    assert.ok(headerContent.includes('{ label: "Categories", to: "/categories", megaMenu: true }'), 'Must contain Categories link');
    assert.ok(headerContent.includes('{ label: "Suppliers", to: "/suppliers" }'), 'Must contain Suppliers link');
    assert.ok(headerContent.includes('{ label: "Request a Quote", to: "/rfq" }'), 'Must contain Request a Quote link');
    assert.ok(headerContent.includes('{ label: "Deals", to: "/products?deal=1" }'), 'Must contain Deals link');
  });

  it('verifies AboutMenu contains all 5 key subsections', () => {
    const requiredSections = [
      '/info/about',
      '/info/about#how-it-works',
      '/info/buyer-protection',
      '/help',
      '/info/contact',
    ];
    requiredSections.forEach((section) => {
      assert.ok(
        aboutMenuContent.includes(section),
        `AboutMenu must contain link to ${section}`
      );
    });
  });

  it('verifies /about route redirects to /info/about in AppRoutes', () => {
    assert.ok(
      appRoutesContent.includes('<Route path="/about" element={<Navigate to="/info/about" replace />} />'),
      'AppRoutes must redirect /about to /info/about'
    );
  });
});

