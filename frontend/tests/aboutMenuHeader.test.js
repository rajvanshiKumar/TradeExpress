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
    // RFQ (moved from the buyer dashboard): shown as "RFQ" to guests and buyers, not suppliers/admins
    assert.ok(headerContent.includes('{ label: "RFQ", to: "/rfq"'), 'Header navigation contains RFQ');
    assert.ok(headerContent.includes('(!user || user.role === "buyer")'), 'RFQ is for guests and buyers only');
    // Deals is shown from 1280px up (wideOnly), so it may carry extra options after its path
    assert.ok(/\{ label: "Deals", to: "\/products\?deal=1"[ ,}]/.test(headerContent), 'Must contain Deals link');
  });

  it('verifies AboutMenu contains only About TradeExpress (How It Works removed)', () => {
    assert.ok(aboutMenuContent.includes('/info/about'), 'AboutMenu must contain /info/about');
    assert.ok(!aboutMenuContent.includes('/info/about#how-it-works'), 'AboutMenu must not contain How It Works');
    assert.ok(!aboutMenuContent.includes('/info/buyer-protection'), 'AboutMenu must not contain /info/buyer-protection');
    assert.ok(!aboutMenuContent.includes("to: '/help'"), 'AboutMenu must not contain /help');
    assert.ok(!aboutMenuContent.includes('/info/contact'), 'AboutMenu must not contain /info/contact');
  });

  it('verifies /about route redirects to /info/about in AppRoutes', () => {
    assert.ok(
      appRoutesContent.includes('<Route path="/about" element={<Navigate to="/info/about" replace />} />'),
      'AppRoutes must redirect /about to /info/about'
    );
  });

  it('verifies AboutUs page contains all user-specified sections and content', () => {
    const aboutUsContent = fs.readFileSync(
      path.resolve(__dirname, '../src/pages/AboutUs.jsx'),
      'utf-8'
    );
    assert.ok(aboutUsContent.includes('Connecting Businesses. Creating Opportunities. Powering Growth.'), 'Must contain tagline');
    assert.ok(aboutUsContent.includes('Who We Are'), 'Must contain Who We Are');
    assert.ok(aboutUsContent.includes('Our Mission'), 'Must contain Our Mission');
    assert.ok(aboutUsContent.includes('Our Vision'), 'Must contain Our Vision');
    assert.ok(aboutUsContent.includes('What We Offer'), 'Must contain What We Offer');
    assert.ok(aboutUsContent.includes('id="how-it-works"'), 'Must contain id="how-it-works" for anchor navigation');
    assert.ok(aboutUsContent.includes('Why Choose TradeExpress?'), 'Must contain Why Choose TradeExpress?');
    assert.ok(aboutUsContent.includes('Our Core Values'), 'Must contain Our Core Values');
    assert.ok(aboutUsContent.includes('Our Commitment'), 'Must contain Our Commitment');
    assert.ok(aboutUsContent.includes('Grow Your Business with TradeExpress'), 'Must contain Grow Your Business');
    assert.ok(aboutUsContent.includes('Discover More. Connect Better. Trade Smarter.'), 'Must contain closing slogan');
    assert.ok(aboutUsContent.includes('TradeExpress operates as a digital B2B marketplace'), 'Must contain disclaimer');
  });
});

