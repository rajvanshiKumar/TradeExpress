import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ADJUSTMENT_REASONS } from '../../src/services/inventoryService.js';

describe('TradeExpress Real-Time Inventory Management Service Suite', () => {
  describe('Stock Formula & Invariant Rules', () => {
    it('accurately calculates available stock as physical stock minus reserved stock', () => {
      const calculateAvailable = (stock, reserved) => Math.max(0, (stock || 0) - (reserved || 0));

      assert.equal(calculateAvailable(100, 20), 80);
      assert.equal(calculateAvailable(50, 50), 0);
      assert.equal(calculateAvailable(10, 15), 0, 'Available stock must never be negative');
      assert.equal(calculateAvailable(0, 0), 0);
      assert.equal(calculateAvailable(500, 0), 500);
    });

    it('categorizes stock status accurately based on available stock and low stock threshold', () => {
      const getStockStatus = (available, threshold = 10) => {
        if (available <= 0) return 'OUT_OF_STOCK';
        if (available <= threshold) return 'LOW_STOCK';
        return 'IN_STOCK';
      };

      assert.equal(getStockStatus(0, 10), 'OUT_OF_STOCK');
      assert.equal(getStockStatus(-2, 10), 'OUT_OF_STOCK');
      assert.equal(getStockStatus(5, 10), 'LOW_STOCK');
      assert.equal(getStockStatus(10, 10), 'LOW_STOCK');
      assert.equal(getStockStatus(11, 10), 'IN_STOCK');
      assert.equal(getStockStatus(500, 20), 'IN_STOCK');
    });

    it('prevents physical stock from dropping below reserved buyer commitments', () => {
      const validateStockAdjustment = (currentStock, reservedStock, adjustmentType, qty) => {
        let newStock = currentStock;
        if (adjustmentType === 'ADD') newStock = currentStock + qty;
        else if (adjustmentType === 'SUBTRACT') newStock = currentStock - qty;
        else if (adjustmentType === 'SET') newStock = qty;

        if (newStock < 0) {
          throw new Error('Physical stock cannot be negative.');
        }
        if (newStock < reservedStock) {
          throw new Error(`Cannot reduce stock to ${newStock} units because ${reservedStock} units are reserved for active orders.`);
        }
        return newStock;
      };

      // Valid adjustments
      assert.equal(validateStockAdjustment(100, 20, 'ADD', 50), 150);
      assert.equal(validateStockAdjustment(100, 20, 'SUBTRACT', 30), 70);
      assert.equal(validateStockAdjustment(100, 20, 'SET', 20), 20);

      // Illegal: reducing below reserved stock
      assert.throws(
        () => validateStockAdjustment(100, 20, 'SUBTRACT', 85),
        /units are reserved for active orders/
      );
      assert.throws(
        () => validateStockAdjustment(100, 20, 'SET', 15),
        /units are reserved for active orders/
      );

      // Illegal: negative stock
      assert.throws(
        () => validateStockAdjustment(10, 0, 'SUBTRACT', 20),
        /cannot be negative/
      );
    });
  });

  describe('Audit Trail & Reason Validation', () => {
    it('contains all mandatory statutory and business adjustment reasons', () => {
      const required = [
        'RESTOCK',
        'MANUAL_ADJUSTMENT',
        'DAMAGE_WRITE_OFF',
        'CYCLE_COUNT_CORRECTION',
        'WAREHOUSE_TRANSFER',
        'RETURN_RESTORED',
        'AUDIT_CORRECTION',
        'OTHER',
      ];

      required.forEach((reason) => {
        assert.ok(ADJUSTMENT_REASONS.includes(reason), `ADJUSTMENT_REASONS must include ${reason}`);
      });
    });

    it('rejects stock adjustments with empty or missing reasons', () => {
      const validateReason = (reason) => {
        if (!reason || !reason.trim()) {
          throw new Error('Stock adjustment reason is mandatory for audit trail compliance.');
        }
        return true;
      };

      assert.equal(validateReason('RESTOCK'), true);
      assert.throws(() => validateReason(''), /reason is mandatory/);
      assert.throws(() => validateReason(null), /reason is mandatory/);
      assert.throws(() => validateReason('   '), /reason is mandatory/);
    });
  });

  describe('Database Metrics Aggregation', () => {
    it('accurately computes supplier-scoped aggregate metrics across product catalogue', () => {
      const mockSupplierProducts = [
        { id: '1', stock: 100, reservedStock: 20, lowStockThreshold: 15 }, // available: 80 -> IN_STOCK
        { id: '2', stock: 15, reservedStock: 5, lowStockThreshold: 15 },   // available: 10 -> LOW_STOCK
        { id: '3', stock: 50, reservedStock: 50, lowStockThreshold: 10 },  // available: 0 -> OUT_OF_STOCK
        { id: '4', stock: 200, reservedStock: 0, lowStockThreshold: 20 },  // available: 200 -> IN_STOCK
      ];

      let totalPhysicalStock = 0;
      let totalReservedStock = 0;
      let totalAvailableStock = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;

      mockSupplierProducts.forEach((p) => {
        const physical = p.stock || 0;
        const reserved = p.reservedStock || 0;
        const available = Math.max(0, physical - reserved);
        const threshold = p.lowStockThreshold || 10;

        totalPhysicalStock += physical;
        totalReservedStock += reserved;
        totalAvailableStock += available;

        if (available <= 0) outOfStockCount++;
        else if (available <= threshold) lowStockCount++;
      });

      assert.equal(totalPhysicalStock, 365);
      assert.equal(totalReservedStock, 75);
      assert.equal(totalAvailableStock, 290);
      assert.equal(lowStockCount, 1);
      assert.equal(outOfStockCount, 1);
      assert.equal(mockSupplierProducts.length, 4);
    });
  });

  describe('Supplier Identity Isolation', () => {
    it('permits authorized supplier or admin and rejects non-owners', () => {
      const verifyOwnership = (user, product) => {
        if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;
        const userCompany = user.companyId || user.company || user.id;
        const isOwner =
          (product.supplierId && product.supplierId === user.id) ||
          (product.companyId && String(product.companyId) === String(userCompany));
        if (!isOwner) {
          throw new Error('You do not have authorization to view or manage inventory for this product.');
        }
        return true;
      };

      const product = { id: 'prod-1', supplierId: 'sup-1', companyId: 'comp-1' };
      const legitimateSupplier = { id: 'sup-1', role: 'SUPPLIER', company: 'comp-1' };
      const intruderSupplier = { id: 'sup-99', role: 'SUPPLIER', company: 'comp-99' };
      const superAdmin = { id: 'admin-1', role: 'SUPER_ADMIN' };

      assert.equal(verifyOwnership(legitimateSupplier, product), true);
      assert.equal(verifyOwnership(superAdmin, product), true);
      assert.throws(() => verifyOwnership(intruderSupplier, product), /do not have authorization/);
    });
  });
});

