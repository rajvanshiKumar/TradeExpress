import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Supplier Dashboard Sidebar Navigation Test Suite', () => {
  const sidebarContent = fs.readFileSync(
    path.resolve(__dirname, '../src/components/layout/SupplierSidebar.jsx'),
    'utf-8'
  );

  // Extract isActiveRoute logic directly from SupplierSidebar.jsx
  const isActiveRoute = (itemTo, pathname) => {
    if (itemTo === '/supplier') {
      return (
        pathname === '/supplier' ||
        pathname === '/supplier/' ||
        pathname === '/supplier/dashboard'
      );
    }
    if (itemTo === '/supplier/products') {
      return (
        (pathname === '/supplier/products' ||
          pathname === '/supplier/products/' ||
          pathname.startsWith('/supplier/products/')) &&
        !pathname.startsWith('/supplier/products/new')
      );
    }
    return pathname === itemTo || pathname.startsWith(`${itemTo}/`);
  };

  it('verifies SupplierSidebar.jsx contains the exclusion for /supplier/products/new', () => {
    assert.ok(
      sidebarContent.includes("!location.pathname.startsWith('/supplier/products/new')"),
      'SupplierSidebar must exclude /supplier/products/new from Product Catalogue active route'
    );
  });

  describe('Add New Product vs Product Catalogue selection', () => {
    it('only selects "Add New Product" when on /supplier/products/new', () => {
      const currentPath = '/supplier/products/new';
      assert.equal(isActiveRoute('/supplier/products/new', currentPath), true, 'Add New Product should be selected');
      assert.equal(isActiveRoute('/supplier/products', currentPath), false, 'Product Catalogue should NOT be selected');
    });

    it('only selects "Product Catalogue" when on /supplier/products', () => {
      const currentPath = '/supplier/products';
      assert.equal(isActiveRoute('/supplier/products', currentPath), true, 'Product Catalogue should be selected');
      assert.equal(isActiveRoute('/supplier/products/new', currentPath), false, 'Add New Product should NOT be selected');
    });

    it('selects "Product Catalogue" for edit routes like /supplier/products/123/edit', () => {
      const currentPath = '/supplier/products/123/edit';
      assert.equal(isActiveRoute('/supplier/products', currentPath), true, 'Product Catalogue should be selected for editing');
      assert.equal(isActiveRoute('/supplier/products/new', currentPath), false, 'Add New Product should NOT be selected');
    });

    it('selects only Dashboard Overview on root /supplier', () => {
      assert.equal(isActiveRoute('/supplier', '/supplier'), true);
      assert.equal(isActiveRoute('/supplier', '/supplier/dashboard'), true);
      assert.equal(isActiveRoute('/supplier', '/supplier/analytics'), false);
      assert.equal(isActiveRoute('/supplier', '/supplier/products'), false);
    });

    it('selects only Performance Analytics on /supplier/analytics', () => {
      assert.equal(isActiveRoute('/supplier/analytics', '/supplier/analytics'), true);
      assert.equal(isActiveRoute('/supplier', '/supplier/analytics'), false);
    });
  });
});
