import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Supplier Real-Time Inventory Management Frontend Suite', () => {
  describe('Stock Metrics & Available Calculation', () => {
    const calculateAvailable = (physical, reserved) => Math.max(0, (physical || 0) - (reserved || 0));

    it('calculates available units as physical stock minus reserved orders', () => {
      assert.equal(calculateAvailable(100, 25), 75);
      assert.equal(calculateAvailable(50, 50), 0);
      assert.equal(calculateAvailable(10, 20), 0, 'Must clamp to 0 rather than negative');
      assert.equal(calculateAvailable(0, 0), 0);
    });

    it('correctly classifies stock status with low-stock threshold', () => {
      const getStatus = (available, threshold = 10) => {
        if (available <= 0) return 'OUT_OF_STOCK';
        if (available <= threshold) return 'LOW_STOCK';
        return 'IN_STOCK';
      };

      assert.equal(getStatus(0, 10), 'OUT_OF_STOCK');
      assert.equal(getStatus(-5, 10), 'OUT_OF_STOCK');
      assert.equal(getStatus(8, 10), 'LOW_STOCK');
      assert.equal(getStatus(10, 10), 'LOW_STOCK');
      assert.equal(getStatus(11, 10), 'IN_STOCK');
      assert.equal(getStatus(100, 15), 'IN_STOCK');
    });
  });

  describe('Stock Adjustment Previews & Validation', () => {
    const computeAdjustmentPreview = (currentStock, reservedStock, adjustType, qty) => {
      const parsed = parseInt(qty, 10) || 0;
      let nextPhysical = currentStock;

      if (adjustType === 'ADD') nextPhysical = currentStock + parsed;
      else if (adjustType === 'SUBTRACT') nextPhysical = Math.max(0, currentStock - parsed);
      else if (adjustType === 'SET') nextPhysical = parsed;

      const nextAvailable = Math.max(0, nextPhysical - reservedStock);
      const isValid = nextPhysical >= reservedStock && nextPhysical >= 0;

      return {
        nextPhysical,
        nextAvailable,
        delta: nextPhysical - currentStock,
        isValid,
      };
    };

    it('computes restock additions accurately', () => {
      const preview = computeAdjustmentPreview(100, 20, 'ADD', 50);
      assert.equal(preview.nextPhysical, 150);
      assert.equal(preview.nextAvailable, 130);
      assert.equal(preview.delta, 50);
      assert.equal(preview.isValid, true);
    });

    it('computes write-off deductions and flags illegal reductions below reserved units', () => {
      // Valid subtraction
      const validPreview = computeAdjustmentPreview(100, 20, 'SUBTRACT', 40);
      assert.equal(validPreview.nextPhysical, 60);
      assert.equal(validPreview.nextAvailable, 40);
      assert.equal(validPreview.isValid, true);

      // Illegal subtraction: reducing below reserved 20
      const invalidPreview = computeAdjustmentPreview(100, 20, 'SUBTRACT', 90);
      assert.equal(invalidPreview.nextPhysical, 10);
      assert.equal(invalidPreview.isValid, false, 'Should be invalid because 10 < 20 reserved');
    });

    it('validates cycle count set value against active reservations', () => {
      const validSet = computeAdjustmentPreview(100, 25, 'SET', 30);
      assert.equal(validSet.nextPhysical, 30);
      assert.equal(validSet.nextAvailable, 5);
      assert.equal(validSet.isValid, true);

      const invalidSet = computeAdjustmentPreview(100, 25, 'SET', 20);
      assert.equal(invalidSet.nextPhysical, 20);
      assert.equal(invalidSet.isValid, false, 'Setting physical below 25 reserved must be invalid');
    });
  });

  describe('Real-Time Socket Event Reconciliation', () => {
    it('patches product row and recalculates aggregate metrics on live inventory:updated event', () => {
      const initialProducts = [
        { id: 'p1', sku: 'SKU-001', stock: 100, reservedStock: 10, availableStock: 90, lowStockThreshold: 10, stockStatus: 'IN_STOCK' },
        { id: 'p2', sku: 'SKU-002', stock: 20, reservedStock: 10, availableStock: 10, lowStockThreshold: 10, stockStatus: 'LOW_STOCK' },
        { id: 'p3', sku: 'SKU-003', stock: 5, reservedStock: 5, availableStock: 0, lowStockThreshold: 5, stockStatus: 'OUT_OF_STOCK' },
      ];

      // Simulate incoming WebSocket update for p2 (restocked by +50 physical)
      const livePayload = {
        productId: 'p2',
        sku: 'SKU-002',
        stock: 70,
        reservedStock: 10,
        availableStock: 60,
        lowStockThreshold: 10,
      };

      const updatedProducts = initialProducts.map((p) => {
        if (p.id === livePayload.productId) {
          const physical = livePayload.stock;
          const reserved = livePayload.reservedStock;
          const available = livePayload.availableStock;
          const threshold = livePayload.lowStockThreshold;

          let status = 'IN_STOCK';
          if (available <= 0) status = 'OUT_OF_STOCK';
          else if (available <= threshold) status = 'LOW_STOCK';

          return {
            ...p,
            stock: physical,
            reservedStock: reserved,
            availableStock: available,
            stockStatus: status,
          };
        }
        return p;
      });

      // Recalculate metrics
      let totalPhysical = 0;
      let totalReserved = 0;
      let totalAvailable = 0;
      let lowCount = 0;
      let outCount = 0;

      updatedProducts.forEach((item) => {
        totalPhysical += item.stock;
        totalReserved += item.reservedStock;
        totalAvailable += item.availableStock;
        if (item.availableStock <= 0) outCount++;
        else if (item.availableStock <= item.lowStockThreshold) lowCount++;
      });

      assert.equal(totalPhysical, 100 + 70 + 5);
      assert.equal(totalReserved, 10 + 10 + 5);
      assert.equal(totalAvailable, 90 + 60 + 0);
      assert.equal(lowCount, 0, 'SKU-002 recovered from low-stock to in-stock');
      assert.equal(outCount, 1);
    });
  });

  describe('Inventory Filtering Logic', () => {
    it('filters inventory by status tab correctly', () => {
      const items = [
        { id: '1', availableStock: 50, lowStockThreshold: 10 }, // healthy
        { id: '2', availableStock: 8, lowStockThreshold: 10 },  // low
        { id: '3', availableStock: 0, lowStockThreshold: 10 },  // out
      ];

      const filterByStatus = (status) => {
        if (status === 'in_stock') return items.filter((i) => i.availableStock > i.lowStockThreshold);
        if (status === 'low_stock') return items.filter((i) => i.availableStock > 0 && i.availableStock <= i.lowStockThreshold);
        if (status === 'out_of_stock') return items.filter((i) => i.availableStock <= 0);
        return items;
      };

      assert.equal(filterByStatus('all').length, 3);
      assert.equal(filterByStatus('in_stock').length, 1);
      assert.equal(filterByStatus('low_stock').length, 1);
      assert.equal(filterByStatus('out_of_stock').length, 1);
    });
  });
});

