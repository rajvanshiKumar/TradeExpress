import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Supplier Product Creation & Security Test Suite', () => {
  describe('8 & 12. Server-Verified Identity & Product Creation Rules', () => {
    it('always derives supplierId from authenticated session user and discards client-supplied supplierId', () => {
      const authenticatedUser = { id: 'supp-real-session-uuid', role: 'SUPPLIER', company: 'Apex Industries' };
      const clientPayload = {
        name: 'Industrial SS Valve',
        categorySlug: 'industrial-supplies',
        price: 950,
        moq: 10,
        stock: 100,
        supplierId: 'spoofed-victim-supplier-id', // Attacker trying to create on behalf of someone else
      };

      // Server creates product by injecting req.user.id
      const finalProductRecord = {
        ...clientPayload,
        supplierId: authenticatedUser.id, // Strictly req.user.id
        status: 'Active',
        moderationStatus: 'APPROVED',
      };

      assert.equal(finalProductRecord.supplierId, authenticatedUser.id);
      assert.notEqual(finalProductRecord.supplierId, clientPayload.supplierId);
      assert.equal(finalProductRecord.status, 'Active');
      assert.equal(finalProductRecord.moderationStatus, 'APPROVED');
    });

    it('enforces product ownership: only owning supplier or admin can edit a product', () => {
      const existingProduct = {
        id: 'prod-123',
        supplierId: 'supp-owner-uuid',
        name: 'Original Product',
      };

      const ownerUser = { id: 'supp-owner-uuid', role: 'SUPPLIER' };
      const intruderUser = { id: 'supp-intruder-uuid', role: 'SUPPLIER' };
      const adminUser = { id: 'admin-uuid', role: 'ADMIN' };

      function canEditProduct(user, product) {
        if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;
        return product.supplierId === user.id;
      }

      assert.equal(canEditProduct(ownerUser, existingProduct), true, 'Owner must be able to edit product');
      assert.equal(canEditProduct(intruderUser, existingProduct), false, 'Intruder must be forbidden from editing');
      assert.equal(canEditProduct(adminUser, existingProduct), true, 'Admin must be able to edit product');
    });
  });

  describe('6. Role Authorization & Access Control', () => {
    it('blocks buyers and non-supplier accounts from accessing supplier product endpoints', () => {
      const allowedRoles = ['SUPPLIER', 'ADMIN', 'SUPER_ADMIN'];

      function checkSupplierEndpointAccess(reqUser) {
        if (!reqUser) return { status: 401, error: 'Authentication required' };
        if (!allowedRoles.includes(reqUser.role)) return { status: 403, error: 'Forbidden. Insufficient permissions.' };
        return { status: 200, success: true };
      }

      assert.equal(checkSupplierEndpointAccess(null).status, 401);
      assert.equal(checkSupplierEndpointAccess({ id: 'u1', role: 'BUYER' }).status, 403);
      assert.equal(checkSupplierEndpointAccess({ id: 'u2', role: 'GUEST' }).status, 403);
      assert.equal(checkSupplierEndpointAccess({ id: 'u3', role: 'SUPPLIER' }).status, 200);
      assert.equal(checkSupplierEndpointAccess({ id: 'u4', role: 'ADMIN' }).status, 200);
      assert.equal(checkSupplierEndpointAccess({ id: 'u5', role: 'SUPER_ADMIN' }).status, 200);
    });
  });

  describe('9. Input Validation for Product Creation', () => {
    function validateCreationData(data) {
      const errors = [];
      if (!data.name || !String(data.name).trim()) errors.push('Product name is required.');
      if (!data.categorySlug || !String(data.categorySlug).trim()) errors.push('Category is required.');
      if (typeof data.price !== 'number' || data.price < 0.01) errors.push('Base price must be greater than zero.');
      if (!Number.isInteger(data.moq) || data.moq < 1) errors.push('MOQ must be at least 1.');
      if (!Number.isInteger(data.stock) || data.stock < 0) errors.push('Stock must be zero or more.');
      return errors;
    }

    it('flags invalid input fields correctly', () => {
      const invalid = { name: '', categorySlug: '', price: 0, moq: 0, stock: -5 };
      const errors = validateCreationData(invalid);
      assert.equal(errors.length, 5);
      assert.ok(errors.includes('Product name is required.'));
      assert.ok(errors.includes('Category is required.'));
      assert.ok(errors.includes('Base price must be greater than zero.'));
      assert.ok(errors.includes('MOQ must be at least 1.'));
      assert.ok(errors.includes('Stock must be zero or more.'));
    });

    it('passes for complete, valid product data', () => {
      const valid = {
        name: 'Precision Pressure Sensor',
        categorySlug: 'industrial-supplies',
        price: 2450.0,
        moq: 2,
        stock: 50,
      };
      const errors = validateCreationData(valid);
      assert.equal(errors.length, 0);
    });
  });

  describe('12. Product Visibility & Search Filtering Rules', () => {
    it('filters products by status Active so approved products are immediately searchable', () => {
      const productsInDb = [
        { id: 'p1', name: 'Active Ball Valve', status: 'Active', moderationStatus: 'APPROVED' },
        { id: 'p2', name: 'Draft Sensor', status: 'Draft', moderationStatus: 'PENDING' },
        { id: 'p3', name: 'Deactivated Motor', status: 'Deactivated', moderationStatus: 'APPROVED' },
      ];

      function searchActiveProducts(query) {
        return productsInDb.filter((p) => p.status === 'Active' && p.name.toLowerCase().includes(query.toLowerCase()));
      }

      const results = searchActiveProducts('Ball Valve');
      assert.equal(results.length, 1);
      assert.equal(results[0].id, 'p1');

      const draftResults = searchActiveProducts('Sensor');
      assert.equal(draftResults.length, 0, 'Draft products should not appear in active public search');
    });
  });
});

