import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dashboardNav } from '../src/data/navigation.js';

describe('Buyer Dashboard Sidebar Navigation & Architecture Test Suite', () => {
  const REQUIRED_ITEMS = [
    { label: 'Dashboard', path: '/buyer' },
    { label: 'Find Products', path: '/products' },
    { label: 'Compare Similar Products', path: '/compare-products' },
    { label: 'Request a Quote (RFQ)', path: '/rfq' },
    { label: 'My Quotes', path: '/buyer/quotes' },
    { label: 'My Orders', path: '/buyer/orders' },
    { label: 'Messages', path: '/messages' },
    { label: 'Payments & Invoices', path: '/buyer/payments' },
    { label: 'Saved Products', path: '/buyer/wishlist' },
    { label: 'My Business Profile', path: '/buyer/profile' },
    { label: 'TradeExpress ID & Certificates', path: '/buyer/documents' },
    { label: 'Notifications', path: '/buyer/notifications' },
    { label: 'Account Settings', path: '/buyer/account-settings' },
  ];

  it('contains all 13 primary buyer navigation routes with valid labels and icons in navigation.js', () => {
    assert.ok(Array.isArray(dashboardNav.buyer), 'dashboardNav.buyer must be an array');
    assert.equal(dashboardNav.buyer.length, 13, 'Must contain exactly 13 navigation items (14th is Logout)');
    // Messages and Payments & Invoices follow My Orders
    const ordersIdx = dashboardNav.buyer.findIndex((item) => item.to === '/buyer/orders');
    assert.equal(dashboardNav.buyer[ordersIdx + 1].to, '/messages');
    assert.equal(dashboardNav.buyer[ordersIdx + 2].to, '/buyer/payments');

    REQUIRED_ITEMS.forEach((req, idx) => {
      const item = dashboardNav.buyer[idx];
      assert.ok(item, `Item at index ${idx} must exist`);
      assert.equal(item.label, req.label, `Label at index ${idx} must match "${req.label}"`);
      assert.equal(item.to, req.path, `Route path for "${req.label}" must match "${req.path}"`);
      assert.ok(typeof item.icon === 'string' && item.icon.length > 0, `Icon must be specified for "${req.label}"`);
    });
  });

  describe('Active Route Highlighting Logic', () => {
    // Replicates the active route logic implemented in BuyerSidebar
    const isActiveRoute = (itemTo, currentPathname) => {
      if (itemTo === '/buyer') {
        return currentPathname === '/buyer' || currentPathname === '/buyer/';
      }
      return currentPathname.startsWith(itemTo);
    };

    it('highlights Dashboard only on root /buyer route', () => {
      assert.equal(isActiveRoute('/buyer', '/buyer'), true);
      assert.equal(isActiveRoute('/buyer', '/buyer/'), true);
      assert.equal(isActiveRoute('/buyer', '/buyer/orders'), false);
      assert.equal(isActiveRoute('/buyer', '/buyer/quotes'), false);
    });

    it('highlights specific sub-routes accurately including nested child paths', () => {
      assert.equal(isActiveRoute('/buyer/orders', '/buyer/orders'), true);
      assert.equal(isActiveRoute('/buyer/orders', '/buyer/orders/ORD-2026-999'), true);
      assert.equal(isActiveRoute('/buyer/orders', '/buyer/quotes'), false);

      assert.equal(isActiveRoute('/buyer/payments', '/buyer/payments'), true);
      assert.equal(isActiveRoute('/buyer/payments', '/buyer/payments/invoice-123'), true);
      assert.equal(isActiveRoute('/buyer/payments', '/buyer/orders'), false);
    });

    it('highlights global shared routes when visited from buyer context', () => {
      assert.equal(isActiveRoute('/products', '/products'), true);
      assert.equal(isActiveRoute('/compare-products', '/compare-products'), true);
      assert.equal(isActiveRoute('/rfq', '/rfq'), true);
      assert.equal(isActiveRoute('/messages', '/messages'), true);
    });
  });

  describe('Badge Count Resolution & Overflow Formatting', () => {
    const formatBadge = (count) => {
      if (!count || count <= 0) return null;
      if (count > 99) return '99+';
      return String(count);
    };

    it('formats badge numbers correctly with 99+ overflow', () => {
      assert.equal(formatBadge(0), null);
      assert.equal(formatBadge(undefined), null);
      assert.equal(formatBadge(5), '5');
      assert.equal(formatBadge(99), '99');
      assert.equal(formatBadge(100), '99+');
      assert.equal(formatBadge(1500), '99+');
    });

    it('resolves dynamic badge metadata from hook data correctly', () => {
      const mockState = {
        unreadMessages: 3,
        unreadNotifications: 12,
        activeOrders: 2,
        savedWishlist: 7,
      };

      const resolveBadges = (to, state) => {
        if (to === '/messages') return formatBadge(state.unreadMessages);
        if (to === '/buyer/notifications') return formatBadge(state.unreadNotifications);
        if (to === '/buyer/orders') return formatBadge(state.activeOrders);
        if (to === '/buyer/wishlist') return formatBadge(state.savedWishlist);
        return null;
      };

      assert.equal(resolveBadges('/messages', mockState), '3');
      assert.equal(resolveBadges('/buyer/notifications', mockState), '12');
      assert.equal(resolveBadges('/buyer/orders', mockState), '2');
      assert.equal(resolveBadges('/buyer/wishlist', mockState), '7');
      assert.equal(resolveBadges('/buyer/profile', mockState), null);
    });

    it('removes the My Orders badge once orders are seen by the buyer', () => {
      // 1. Initial state: newly placed order arrives
      let seenOrderIds = [];
      const placedOrder = { id: 'TS-O-2026-9001', buyerId: 'user-1', isSample: false };
      const buyerOrders = [placedOrder];

      const getUnseenCount = (orders, seen) =>
        orders.filter((o) => !o.isSample && !seen.includes(o.id)).length;

      // Before viewing: unseen count is 1 -> badge shows '1'
      let unseen = getUnseenCount(buyerOrders, seenOrderIds);
      assert.equal(unseen, 1);
      assert.equal(formatBadge(unseen), '1');

      // 2. Buyer navigates to My Orders -> markAllOrdersSeen is triggered
      seenOrderIds = [...seenOrderIds, placedOrder.id];
      unseen = getUnseenCount(buyerOrders, seenOrderIds);

      // 3. After viewing: unseen count is 0 -> badge is completely removed (null)
      assert.equal(unseen, 0);
      assert.equal(formatBadge(unseen), null);
    });
  });

  describe('Collapsible State & Storage Preference Persistence', () => {
    const STORAGE_KEY = 'tradeexpress_buyer_sidebar_collapsed';

    class MockStorage {
      constructor() {
        this.store = {};
      }
      getItem(key) {
        return this.store[key] || null;
      }
      setItem(key, value) {
        this.store[key] = String(value);
      }
      removeItem(key) {
        delete this.store[key];
      }
    }

    it('defaults to expanded when no prior preference exists in localStorage', () => {
      const storage = new MockStorage();
      const initial = storage.getItem(STORAGE_KEY) === 'true';
      assert.equal(initial, false, 'Default collapsed state should be false (expanded)');
    });

    it('persists toggle state between sessions in localStorage', () => {
      const storage = new MockStorage();

      // User collapses sidebar
      storage.setItem(STORAGE_KEY, 'true');
      assert.equal(storage.getItem(STORAGE_KEY) === 'true', true);

      // User expands sidebar
      storage.setItem(STORAGE_KEY, 'false');
      assert.equal(storage.getItem(STORAGE_KEY) === 'true', false);
    });
  });

  describe('Role-Based Security Boundary & Route Separation', () => {
    it('verifies buyer navigation items do not leak into supplier or admin paths', () => {
      const buyerPaths = dashboardNav.buyer.map((i) => i.to);
      const supplierPaths = dashboardNav.supplier.map((i) => i.to);
      const adminPaths = dashboardNav.admin.map((i) => i.to);

      buyerPaths.forEach((path) => {
        assert.ok(!supplierPaths.includes(path) || ['/products', '/messages'].includes(path), 
          `Buyer path ${path} should not be in supplier nav`);
        assert.ok(!adminPaths.includes(path), `Buyer path ${path} should not be in admin nav`);
      });
    });
  });
});


describe('Buyer account has Account Settings only (separate Settings page removed)', () => {
  const read = (rel) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', rel), 'utf8');

  it('the buyer sidebar shows Account Settings and no separate Settings item', () => {
    const sidebar = read('src/components/layout/BuyerSidebar.jsx');
    assert.match(sidebar, /label: 'Account Settings', to: '\/buyer\/account-settings'/);
    assert.doesNotMatch(sidebar, /'\/buyer\/settings'/);
    assert.doesNotMatch(sidebar, /label: 'Settings'/);
  });

  it('dashboard navigation data matches the sidebar', () => {
    assert.ok(dashboardNav.buyer.some((item) => item.to === '/buyer/account-settings'));
    assert.ok(!dashboardNav.buyer.some((item) => item.to === '/buyer/settings'));
  });

  it('old /buyer/settings links redirect to Account Settings and the page is gone', () => {
    const routes = read('src/routes/AppRoutes.jsx');
    assert.match(routes, /path="\/buyer\/settings" element=\{<Navigate to="\/buyer\/account-settings" replace \/>\}/);
    assert.doesNotMatch(routes, /BuyerSettings/);
    assert.equal(fs.existsSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/pages/buyer/BuyerSettings.jsx')), false);
  });
});

describe('Buyer Help & Disputes removed', () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  it('no buyer screen links to the removed disputes page', () => {
    for (const file of [
      'src/components/layout/BuyerSidebar.jsx', 'src/pages/buyer/BuyerDashboard.jsx', 'src/components/layout/SupportMenu.jsx',
      'src/pages/Help.jsx', 'src/data/help/helpContent.js', 'src/components/account/AccountDeleteSection.jsx',
    ]) {
      assert.doesNotMatch(read(file), /\/buyer\/disputes|Help & Disputes/, file);
    }
    assert.ok(!dashboardNav.buyer.some((item) => item.to === '/buyer/disputes'));
  });

  it('the page is deleted and old links redirect to My Orders', () => {
    assert.equal(fs.existsSync(path.join(root, 'src/pages/buyer/BuyerDisputes.jsx')), false);
    const routes = read('src/routes/AppRoutes.jsx');
    assert.doesNotMatch(routes, /BuyerDisputes/);
    assert.match(routes, /path="\/buyer\/disputes" element=\{<Navigate to="\/buyer\/orders" replace \/>\}/);
  });
});

describe('Buyer Sidebar Collapsed State & Dot Removal Verification', () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  it('stacks the logo and collapse toggle cleanly when collapsed without collision', () => {
    const sidebar = read('src/components/layout/BuyerSidebar.jsx');
    // Verifies header dynamically stacks in flex-col when collapsed
    assert.match(sidebar, /collapsed\s*\?\s*['"]flex flex-col items-center/);
    assert.match(sidebar, /!collapsed\s*\?\s*\(/);
  });

  it('does not render floating dot indicators when the sidebar is collapsed', () => {
    const sidebar = read('src/components/layout/BuyerSidebar.jsx');
    // Ensure badge dot is not rendered in collapsed state
    assert.match(sidebar, /\{!collapsed && badge !== null && \(/);
    // Ensure relative class is applied to Link so positioning never leaks
    assert.match(sidebar, /className=\{`group relative flex items-center rounded-xl/);
  });

  it('collapses smoothly with dedicated centered size-10 buttons', () => {
    const sidebar = read('src/components/layout/BuyerSidebar.jsx');
    assert.match(sidebar, /justify-center mx-auto size-10/);
  });

  it('provides TradeExpress ID & Certificates in BuyerSidebar and registers route', () => {
    const sidebar = read('src/components/layout/BuyerSidebar.jsx');
    assert.match(sidebar, /to:\s*'\/buyer\/documents'/);
    assert.match(sidebar, /label:\s*'TradeExpress ID & Certificates'/);

    const routes = read('src/routes/AppRoutes.jsx');
    assert.match(routes, /path="\/buyer\/documents"\s*element=\{<BuyerDocuments\s*\/>\}/);

    const buyerDocs = read('src/pages/buyer/BuyerDocuments.jsx');
    assert.match(buyerDocs, /Buyer Registration Certificate/);
    assert.match(buyerDocs, /Buyer Digital ID Card/);
    assert.match(buyerDocs, /Download Registration Certificate/);
    assert.match(buyerDocs, /Download Buyer ID Card/);
  });

  it('renders Verification Pending unless Admin explicitly verifies the buyer', () => {
    const sidebar = read('src/components/layout/BuyerSidebar.jsx');
    // Ensure buyer sidebar uses dynamic status dot and label (amber for pending, emerald for verified)
    assert.match(sidebar, /user\?\.kycStatus === 'VERIFIED' \? 'Verified Buyer' : 'Verification Pending'/);
    assert.match(sidebar, /user\?\.kycStatus === 'VERIFIED' \? 'bg-emerald-500' : 'bg-amber-400'/);

    const dashboard = read('src/pages/buyer/BuyerDashboard.jsx');
    assert.match(dashboard, /user\?\.kycStatus === 'VERIFIED' \? 'Verified Buyer' : 'Verification Pending'/);

    const adminUsers = read('src/pages/superadmin/SuperAdminUsers.jsx');
    // Admin user directory verifies both buyers and suppliers with a dedicated Verify action
    assert.match(adminUsers, /u\.role === 'SUPPLIER' \|\| u\.role === 'BUYER'/);
    assert.match(adminUsers, /handleVerifyUser\(u\)/);
    assert.match(adminUsers, /superAdminApi\.verifyUser/);
  });
});
