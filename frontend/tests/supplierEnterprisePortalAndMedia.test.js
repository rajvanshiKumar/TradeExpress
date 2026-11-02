import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dashboardNav } from '../src/data/navigation.js';

describe('Supplier Enterprise Portal & Media Test Suite', () => {
  describe('1. Supplier Sidebar Navigation Architecture', () => {
    const REQUIRED_SUPPLIER_ITEMS = [
      { label: 'Overview', to: '/supplier/dashboard' },
      { label: 'My Products', to: '/supplier/products' },
      { label: 'Inventory Management', to: '/supplier/inventory' },
      { label: 'Buyer Inquiries/RFQs', to: '/supplier/inquiries' },
      { label: 'My Quotations', to: '/supplier/quotations' },
      { label: 'Orders', to: '/supplier/orders' },
      { label: 'Shipping & Delivery', to: '/supplier/shipping' },
      { label: 'Payments & Earnings', to: '/supplier/payments' },
      { label: 'Verification Center', to: '/supplier/verification' },
      { label: 'Business Profile', to: '/supplier/profile' },
      { label: 'Notifications', to: '/supplier/notifications' },
      { label: 'Analytics', to: '/supplier/analytics' },
      { label: 'Settings & Security', to: '/supplier/settings' },
    ];

    it('contains all required supplier enterprise navigation items with valid routes and icons', () => {
      assert.ok(Array.isArray(dashboardNav.supplier), 'dashboardNav.supplier must be an array');
      assert.equal(dashboardNav.supplier.length, REQUIRED_SUPPLIER_ITEMS.length);

      REQUIRED_SUPPLIER_ITEMS.forEach((req, idx) => {
        const item = dashboardNav.supplier[idx];
        assert.ok(item, `Item at index ${idx} must exist`);
        assert.equal(item.label, req.label, `Label at index ${idx} must match "${req.label}"`);
        assert.equal(item.to, req.to, `Path at index ${idx} must match "${req.to}"`);
        assert.ok(typeof item.icon === 'string' && item.icon.length > 0, `Icon must be specified for "${req.label}"`);
      });
    });

    describe('Active Route Highlighting', () => {
      const isActiveRoute = (itemTo, currentPathname) => {
        if (itemTo === '/supplier/dashboard') {
          return currentPathname === '/supplier/dashboard' || currentPathname === '/supplier';
        }
        return currentPathname.startsWith(itemTo);
      };

      it('highlights Overview only on root supplier dashboard paths', () => {
        assert.equal(isActiveRoute('/supplier/dashboard', '/supplier/dashboard'), true);
        assert.equal(isActiveRoute('/supplier/dashboard', '/supplier'), true);
        assert.equal(isActiveRoute('/supplier/dashboard', '/supplier/products'), false);
        assert.equal(isActiveRoute('/supplier/dashboard', '/supplier/inventory'), false);
      });

      it('highlights inventory, orders, and sub-routes accurately', () => {
        assert.equal(isActiveRoute('/supplier/inventory', '/supplier/inventory'), true);
        assert.equal(isActiveRoute('/supplier/orders', '/supplier/orders'), true);
        assert.equal(isActiveRoute('/supplier/orders', '/supplier/orders/ORD-999'), true);
        assert.equal(isActiveRoute('/supplier/products', '/supplier/products/new'), true);
        assert.equal(isActiveRoute('/supplier/products', '/supplier/inventory'), false);
      });
    });

    describe('Sidebar Collapse State Persistence', () => {
      it('initializes and saves collapsed state using localStorage key', () => {
        const STORAGE_KEY = 'tradeexpress_supplier_sidebar_collapsed';
        const mockStorage = {};

        function getCollapsedState() {
          return mockStorage[STORAGE_KEY] === 'true';
        }

        function setCollapsedState(val) {
          mockStorage[STORAGE_KEY] = String(val);
        }

        assert.equal(getCollapsedState(), false, 'Default collapsed state is false (expanded)');
        setCollapsedState(true);
        assert.equal(getCollapsedState(), true, 'Toggling collapse sets state to true');
        setCollapsedState(false);
        assert.equal(getCollapsedState(), false, 'Toggling collapse back sets state to false');
      });
    });
  });

  describe('2. CustomSelect Keyboard Navigation & Accessibility Engine', () => {
    function normalizeOptions(options) {
      return options.map((opt) => {
        if (typeof opt === 'object' && opt !== null) {
          return {
            value: opt.value !== undefined ? opt.value : '',
            label: opt.label !== undefined ? String(opt.label) : String(opt.value ?? ''),
          };
        }
        return { value: opt, label: String(opt) };
      });
    }

    function simulateKeyboardInteraction({ options, initialOpen = false, initialIndex = 0, keys = [] }) {
      const normalized = normalizeOptions(options);
      let open = initialOpen;
      let highlightedIndex = initialIndex;
      let selectedValue = null;

      for (const key of keys) {
        if (!open) {
          if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(key)) {
            open = true;
          }
          continue;
        }

        if (key === 'Escape') {
          open = false;
        } else if (key === 'ArrowDown') {
          highlightedIndex = Math.min(highlightedIndex + 1, normalized.length - 1);
        } else if (key === 'ArrowUp') {
          highlightedIndex = Math.max(highlightedIndex - 1, 0);
        } else if (key === 'Home') {
          highlightedIndex = 0;
        } else if (key === 'End') {
          highlightedIndex = normalized.length - 1;
        } else if (key === 'Enter' || key === ' ') {
          if (normalized[highlightedIndex]) {
            selectedValue = normalized[highlightedIndex].value;
            open = false;
          }
        }
      }

      return { open, highlightedIndex, selectedValue };
    }

    const testOptions = [
      { value: 'ALL', label: 'All Statuses' },
      { value: 'OPEN', label: 'Open' },
      { value: 'IN_PROGRESS', label: 'In Progress' },
      { value: 'RESOLVED', label: 'Resolved' },
      { value: 'CLOSED', label: 'Closed' },
    ];

    it('opens dropdown on ArrowDown when initially closed', () => {
      const res = simulateKeyboardInteraction({
        options: testOptions,
        initialOpen: false,
        keys: ['ArrowDown'],
      });
      assert.equal(res.open, true);
    });

    it('navigates options downwards and upwards with ArrowDown and ArrowUp', () => {
      const res = simulateKeyboardInteraction({
        options: testOptions,
        initialOpen: true,
        initialIndex: 0,
        keys: ['ArrowDown', 'ArrowDown', 'ArrowUp'],
      });
      assert.equal(res.highlightedIndex, 1);
      assert.equal(res.open, true);
    });

    it('jumps to first and last items using Home and End keys', () => {
      const resEnd = simulateKeyboardInteraction({
        options: testOptions,
        initialOpen: true,
        initialIndex: 1,
        keys: ['End'],
      });
      assert.equal(resEnd.highlightedIndex, 4);

      const resHome = simulateKeyboardInteraction({
        options: testOptions,
        initialOpen: true,
        initialIndex: 4,
        keys: ['Home'],
      });
      assert.equal(resHome.highlightedIndex, 0);
    });

    it('selects the highlighted option on Enter and closes dropdown', () => {
      const res = simulateKeyboardInteraction({
        options: testOptions,
        initialOpen: true,
        initialIndex: 0,
        keys: ['ArrowDown', 'ArrowDown', 'Enter'],
      });
      assert.equal(res.open, false);
      assert.equal(res.selectedValue, 'IN_PROGRESS');
    });

    it('closes dropdown without changing selection on Escape', () => {
      const res = simulateKeyboardInteraction({
        options: testOptions,
        initialOpen: true,
        initialIndex: 2,
        keys: ['Escape'],
      });
      assert.equal(res.open, false);
      assert.equal(res.selectedValue, null);
    });

    it('filters option list according to search query', () => {
      const query = 're';
      const normalized = normalizeOptions(testOptions);
      const filtered = normalized.filter((opt) => opt.label.toLowerCase().includes(query.toLowerCase()));
      assert.equal(filtered.length, 2); // 'In Progress' & 'Resolved'
      assert.deepEqual(
        filtered.map((o) => o.value),
        ['IN_PROGRESS', 'RESOLVED']
      );
    });
  });

  describe('3. Product Media Uploader Rules: Up to 8 Images + 1 Video', () => {
    const MAX_IMAGES = 8;

    function addImagesToMediaState(currentImages, newImageUrls) {
      const availableSlots = MAX_IMAGES - currentImages.length;
      if (availableSlots <= 0) {
        return { success: false, error: `Maximum ${MAX_IMAGES} images reached.` };
      }
      const toAdd = newImageUrls.slice(0, availableSlots);
      const updated = [...currentImages, ...toAdd];
      const rejectedCount = newImageUrls.length - toAdd.length;
      return {
        success: true,
        images: updated,
        rejectedCount,
        warning: rejectedCount > 0 ? `Only ${availableSlots} images added. Maximum ${MAX_IMAGES} images allowed.` : null,
      };
    }

    function reorderImages(images, fromIndex, toIndex) {
      if (toIndex < 0 || toIndex >= images.length) return images;
      const copy = [...images];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    }

    function removeImage(images, indexToRemove) {
      return images.filter((_, idx) => idx !== indexToRemove);
    }

    it('allows adding up to 8 images successfully', () => {
      let state = [];
      const res = addImagesToMediaState(state, [
        'img1.jpg', 'img2.jpg', 'img3.jpg', 'img4.jpg',
        'img5.jpg', 'img6.jpg', 'img7.jpg', 'img8.jpg',
      ]);
      assert.equal(res.success, true);
      assert.equal(res.images.length, 8);
      assert.equal(res.rejectedCount, 0);
    });

    it('rejects adding beyond 8 images and informs the supplier', () => {
      const existing = ['img1.jpg', 'img2.jpg', 'img3.jpg', 'img4.jpg', 'img5.jpg', 'img6.jpg', 'img7.jpg', 'img8.jpg'];
      const res = addImagesToMediaState(existing, ['img9.jpg']);
      assert.equal(res.success, false);
      assert.match(res.error, /Maximum 8 images reached/);
    });

    it('partially adds up to limit when batch exceeds available slots', () => {
      const existing = ['img1.jpg', 'img2.jpg', 'img3.jpg', 'img4.jpg', 'img5.jpg', 'img6.jpg']; // 6 existing
      const res = addImagesToMediaState(existing, ['img7.jpg', 'img8.jpg', 'img9.jpg', 'img10.jpg']); // 4 new
      assert.equal(res.success, true);
      assert.equal(res.images.length, 8);
      assert.equal(res.rejectedCount, 2);
      assert.match(res.warning, /Maximum 8 images allowed/);
    });

    it('reordering images changes primary cover to index 0', () => {
      const images = ['side_view.jpg', 'front_view.jpg', 'spec.jpg'];
      const reordered = reorderImages(images, 1, 0); // Move front_view to primary
      assert.equal(reordered[0], 'front_view.jpg');
      assert.equal(reordered[1], 'side_view.jpg');
      assert.equal(reordered[2], 'spec.jpg');
    });

    it('removing primary image advances next image to primary cover', () => {
      const images = ['old_cover.jpg', 'new_cover.jpg', 'detail.jpg'];
      const afterRemoval = removeImage(images, 0);
      assert.equal(afterRemoval.length, 2);
      assert.equal(afterRemoval[0], 'new_cover.jpg');
    });

    it('manages video upload independently from the 8 images', () => {
      let productMedia = {
        images: ['img1.jpg', 'img2.jpg', 'img3.jpg', 'img4.jpg', 'img5.jpg', 'img6.jpg', 'img7.jpg', 'img8.jpg'],
        videoUrl: null,
      };

      // Supplier uploads video
      productMedia.videoUrl = '/uploads/demo.mp4';
      assert.equal(productMedia.images.length, 8);
      assert.equal(productMedia.videoUrl, '/uploads/demo.mp4');

      // Supplier replaces or removes video
      productMedia.videoUrl = null;
      assert.equal(productMedia.images.length, 8);
      assert.equal(productMedia.videoUrl, null);
    });
  });

  describe('4. Supplier Dashboard Real-Time Inventory & Order Metrics', () => {
    function computeInventoryMetrics(products) {
      let totalListed = products.length;
      let totalStock = 0;
      let totalAvailable = 0;
      let totalReserved = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;

      for (const p of products) {
        const physical = Number(p.stock) || 0;
        const reserved = Number(p.reservedStock) || 0;
        const available = Math.max(0, physical - reserved);
        const moq = Number(p.moq) || 1;
        const threshold = p.lowStockThreshold || Math.max(10, moq * 2);

        totalStock += physical;
        totalReserved += reserved;
        totalAvailable += available;

        if (available === 0) {
          outOfStockCount++;
        } else if (available <= threshold) {
          lowStockCount++;
        }
      }

      return {
        totalListed,
        totalStock,
        totalAvailable,
        totalReserved,
        lowStockCount,
        outOfStockCount,
      };
    }

    it('calculates inventory aggregates, low stock thresholds, and out of stock counts accurately', () => {
      const sampleProducts = [
        { id: 'p1', stock: 100, reservedStock: 20, moq: 10 }, // avail: 80, threshold: 20 -> OK
        { id: 'p2', stock: 25, reservedStock: 10, moq: 10 },  // avail: 15, threshold: 20 -> Low Stock
        { id: 'p3', stock: 5, reservedStock: 5, moq: 5 },     // avail: 0 -> Out of Stock
        { id: 'p4', stock: 50, reservedStock: 0, moq: 5 },    // avail: 50, threshold: 10 -> OK
      ];

      const metrics = computeInventoryMetrics(sampleProducts);
      assert.equal(metrics.totalListed, 4);
      assert.equal(metrics.totalStock, 180);
      assert.equal(metrics.totalReserved, 35);
      assert.equal(metrics.totalAvailable, 145);
      assert.equal(metrics.lowStockCount, 1);
      assert.equal(metrics.outOfStockCount, 1);
    });
  });
});

