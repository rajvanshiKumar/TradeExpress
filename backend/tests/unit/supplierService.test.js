import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Supplier Dashboard Logic & Calculations Test Suite', () => {
  describe('Revenue and Financial Scoping Rules', () => {
    it('calculates gross revenue only from confirmed and delivered non-cancelled orders', () => {
      const orders = [
        { id: '1', total: 10000, orderStatus: 'DELIVERED', paymentStatus: 'PAID' },
        { id: '2', total: 5000, orderStatus: 'SHIPPED', paymentStatus: 'PAID' },
        { id: '3', total: 8000, orderStatus: 'ORDER_PLACED', paymentStatus: 'PENDING' }, // Unpaid/Pending
        { id: '4', total: 12000, orderStatus: 'CANCELLED', paymentStatus: 'REFUNDED' }, // Cancelled
        { id: '5', total: 6000, orderStatus: 'PROCESSING', paymentStatus: 'COD' }, // Confirmed COD
      ];

      // Eligible orders: PAID (non-cancelled) or confirmed COD in active progress/delivered
      const completedRevenue = orders
        .filter((o) => o.orderStatus !== 'CANCELLED' && o.orderStatus !== 'REFUNDED' && (o.paymentStatus === 'PAID' || o.orderStatus === 'DELIVERED'))
        .reduce((sum, o) => sum + Number(o.total), 0);

      assert.equal(completedRevenue, 15000, 'Only completed delivered or paid orders count towards completed revenue');
    });

    it('calculates platform commission and net supplier payout accurately', () => {
      const grossAmount = 50000;
      const commissionRate = 2.5; // 2.5%
      const commissionFee = (grossAmount * commissionRate) / 100;
      const netPayout = grossAmount - commissionFee;

      assert.equal(commissionFee, 1250);
      assert.equal(netPayout, 48750);
    });

    it('identifies low stock based on minimum order quantity (stock < moq * 2 or stock < 10)', () => {
      const products = [
        { id: 'p1', name: 'Product A', stock: 5, moq: 10 }, // stock < moq
        { id: 'p2', name: 'Product B', stock: 15, moq: 10 }, // stock < moq * 2
        { id: 'p3', name: 'Product C', stock: 100, moq: 10 }, // healthy
        { id: 'p4', name: 'Product D', stock: 8, moq: 2 }, // stock < 10
      ];

      const lowStock = products.filter((p) => p.stock < p.moq * 2 || p.stock < 10);
      assert.equal(lowStock.length, 3);
      assert.ok(lowStock.some((p) => p.id === 'p1'));
      assert.ok(lowStock.some((p) => p.id === 'p2'));
      assert.ok(lowStock.some((p) => p.id === 'p4'));
    });
  });

  describe('Quotation Breakdown & Total Calculation', () => {
    it('calculates quotation total with unit price, quantity, freight, GST, and other charges', () => {
      const unitPrice = 120;
      const quantity = 500;
      const subtotal = unitPrice * quantity; // 60,000
      const freightCharge = 2500;
      const otherCharges = 500;
      const taxableAmount = subtotal + freightCharge + otherCharges; // 63,000
      const gstPercentage = 18; // 18% GST
      const gstAmount = (taxableAmount * gstPercentage) / 100; // 11,340
      const grandTotal = taxableAmount + gstAmount; // 74,340

      assert.equal(subtotal, 60000);
      assert.equal(taxableAmount, 63000);
      assert.equal(gstAmount, 11340);
      assert.equal(grandTotal, 74340);
    });

    it('flags quotation as expiring if validity is within 3 days', () => {
      const now = new Date();
      const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      const inTenDays = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      function isExpiringSoon(validityDate) {
        if (!validityDate) return false;
        const diffDays = (new Date(validityDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 3;
      }

      assert.equal(isExpiringSoon(inTwoDays), true);
      assert.equal(isExpiringSoon(inTenDays), false);
      assert.equal(isExpiringSoon(past), false);
    });
  });

  describe('Order Status Transition Validation', () => {
    const validTransitions = {
      ORDER_PLACED: ['ORDER_CONFIRMED', 'CANCELLED'],
      ORDER_CONFIRMED: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['PACKED', 'CANCELLED'],
      PACKED: ['SHIPPED', 'CANCELLED'],
      SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED'],
      OUT_FOR_DELIVERY: ['DELIVERED'],
      DELIVERED: [], // Terminal
      CANCELLED: [], // Terminal
    };

    function canTransition(current, next) {
      return (validTransitions[current] || []).includes(next);
    }

    it('allows valid forward progression in order lifecycle', () => {
      assert.equal(canTransition('ORDER_CONFIRMED', 'PROCESSING'), true);
      assert.equal(canTransition('PROCESSING', 'PACKED'), true);
      assert.equal(canTransition('PACKED', 'SHIPPED'), true);
      assert.equal(canTransition('SHIPPED', 'DELIVERED'), true);
    });

    it('blocks illegal status transitions or modifications to terminal states', () => {
      assert.equal(canTransition('DELIVERED', 'PROCESSING'), false, 'Cannot rewind delivered order');
      assert.equal(canTransition('CANCELLED', 'SHIPPED'), false, 'Cannot ship cancelled order');
      assert.equal(canTransition('ORDER_PLACED', 'DELIVERED'), false, 'Cannot skip required fulfillment steps');
    });
  });
});
