import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateOrderNumber } from '../../src/utils/orderNumber.js';
import { signJwt, verifyJwt } from '../../src/utils/jwt.js';
import { requireRole } from '../../src/middleware/authMiddleware.js';

describe('TradeExpress Core Unit Test Suite', () => {
  describe('Order Number Generation', () => {
    it('generates order number in TS-YYMMDD-XXXXXX format', () => {
      const orderNum = generateOrderNumber();
      assert.match(orderNum, /^TS-\d{6}-[A-F0-9]{6}$/, 'Order number matches TS-YYMMDD-HEX pattern');
    });

    it('generates distinct order numbers sequentially', () => {
      const set = new Set();
      for (let i = 0; i < 50; i++) {
        set.add(generateOrderNumber());
      }
      assert.equal(set.size, 50, 'All 50 generated order numbers must be unique');
    });
  });

  describe('JWT Utility Functions', () => {
    it('signs and verifies payload successfully', () => {
      const payload = { userId: 'usr-12345', role: 'SUPPLIER' };
      const token = signJwt(payload);
      assert.ok(token && typeof token === 'string' && token.length > 20);

      const decoded = verifyJwt(token);
      assert.ok(decoded);
      assert.equal(decoded.userId, 'usr-12345');
      assert.equal(decoded.role, 'SUPPLIER');
    });

    it('returns null for an invalid or tampered token', () => {
      const tampered = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature';
      const result = verifyJwt(tampered);
      assert.equal(result, null, 'Tampered token must return null');
    });

    it('returns null for empty or non-string token', () => {
      assert.equal(verifyJwt(''), null);
      assert.equal(verifyJwt(null), null);
    });
  });

  describe('Role-Based Authorization Middleware (requireRole)', () => {
    function createMockRes() {
      const res = {
        statusCode: 200,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.body = data;
          return this;
        },
      };
      return res;
    }

    it('returns 401 when request has no authenticated user', () => {
      const middleware = requireRole('SUPPLIER');
      const req = { user: null };
      const res = createMockRes();
      let nextCalled = false;

      middleware(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 401);
      assert.equal(res.body?.success, false);
    });

    it('allows access when user has matching role', () => {
      const middleware = requireRole('SUPPLIER', 'ADMIN');
      const req = { user: { role: 'SUPPLIER' } };
      const res = createMockRes();
      let nextCalled = false;

      middleware(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, true);
      assert.equal(res.statusCode, 200);
    });

    it('denies access (403) when user has wrong role', () => {
      const middleware = requireRole('SUPPLIER');
      const req = { user: { role: 'BUYER' } };
      const res = createMockRes();
      let nextCalled = false;

      middleware(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body?.message, 'Forbidden. Insufficient permissions.');
    });

    it('always allows SUPER_ADMIN regardless of required roles', () => {
      const middleware = requireRole('BUYER');
      const req = { user: { role: 'SUPER_ADMIN' } };
      const res = createMockRes();
      let nextCalled = false;

      middleware(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, true);
    });
  });
});

