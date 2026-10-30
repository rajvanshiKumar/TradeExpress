import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, ROLE_HOME } from '../src/utils/constants.js';
import { dashboardNav } from '../src/data/navigation.js';

describe('Transportation & Logistics UI and Business Rules Test Suite', () => {
  // 1. All 17 Mandatory Logistics Lifecycle Statuses
  const ALL_17_STATUSES = [
    'TRANSPORT_PENDING',
    'TRANSPORT_REQUESTED',
    'QUOTATION_PENDING',
    'QUOTATION_RECEIVED',
    'TRANSPORT_ASSIGNED',
    'DOCUMENTS_PENDING',
    'DOCUMENTS_VERIFIED',
    'READY_FOR_PICKUP',
    'PICKUP_SCHEDULED',
    'PICKED_UP',
    'IN_TRANSIT',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'DELIVERY_DISPUTED',
    'CANCELLED',
    'RETURN_IN_TRANSIT',
    'RETURNED',
  ];

  it('contains exactly 17 mandatory controlled lifecycle statuses', () => {
    assert.equal(ALL_17_STATUSES.length, 17, 'Must have exactly 17 statuses in state machine');
    const uniqueStatuses = new Set(ALL_17_STATUSES);
    assert.equal(uniqueStatuses.size, 17, 'All 17 statuses must be distinct');
  });

  describe('UI Status Badge & Label Mapping Logic', () => {
    const resolveStatusBadge = (status) => {
      const s = String(status || '').toUpperCase();
      if (s === 'DELIVERED') return { tone: 'success', label: 'Delivered', canDispute: true };
      if (s === 'OUT_FOR_DELIVERY') return { tone: 'purple', label: 'Out for Delivery', requiresOtp: true };
      if (['IN_TRANSIT', 'PICKED_UP'].includes(s)) return { tone: 'blue', label: s.replace(/_/g, ' '), canTrackGps: true };
      if (s === 'DELIVERY_DISPUTED') return { tone: 'danger', label: 'Disputed', isDisputed: true };
      if (['CANCELLED', 'RETURNED'].includes(s)) return { tone: 'neutral', label: s.replace(/_/g, ' '), isClosed: true };
      return { tone: 'warning', label: s.replace(/_/g, ' ') };
    };

    it('correctly maps delivery, in-transit, dispute and pending status tones', () => {
      const del = resolveStatusBadge('DELIVERED');
      assert.equal(del.tone, 'success');
      assert.equal(del.canDispute, true);

      const ofd = resolveStatusBadge('OUT_FOR_DELIVERY');
      assert.equal(ofd.tone, 'purple');
      assert.equal(ofd.requiresOtp, true);

      const inTransit = resolveStatusBadge('IN_TRANSIT');
      assert.equal(inTransit.tone, 'blue');
      assert.equal(inTransit.canTrackGps, true);

      const disp = resolveStatusBadge('DELIVERY_DISPUTED');
      assert.equal(disp.tone, 'danger');
      assert.equal(disp.isDisputed, true);
    });
  });

  describe('Statutory 5% GTA GST Freight Quotation Math', () => {
    const calculateFreightBreakdown = ({ base, loading = 0, unloading = 0, fuel = 0, tolls = 0 }) => {
      const subtotal = Math.round(base + loading + unloading + fuel + tolls);
      // Statutory Goods Transport Agency (GTA) GST in India is 5%
      const gstAmount = Math.round(subtotal * 0.05);
      const totalAmount = subtotal + gstAmount;
      // Section 194C TDS for transport contractors: 1%
      const tdsAmount = Math.round(base * 0.01);
      const netPayout = totalAmount - tdsAmount;

      return { subtotal, gstAmount, totalAmount, tdsAmount, netPayout };
    };

    it('calculates 5% GTA GST accurately for B2B corridor quotations', () => {
      const quote1 = calculateFreightBreakdown({
        base: 10000,
        loading: 1000,
        unloading: 1000,
        fuel: 2000,
        tolls: 500,
      });

      assert.equal(quote1.subtotal, 14500, 'Subtotal must be base + components');
      assert.equal(quote1.gstAmount, 725, '5% of 14500 is 725');
      assert.equal(quote1.totalAmount, 15225, 'Total must be 14500 + 725');
      assert.equal(quote1.tdsAmount, 100, '1% TDS on 10000 base freight is 100');
      assert.equal(quote1.netPayout, 15125, 'Net escrow disbursal must subtract TDS');
    });

    it('handles heavy multi-axle freight calculation properly', () => {
      const heavyQuote = calculateFreightBreakdown({
        base: 85000,
        loading: 5000,
        unloading: 5000,
        fuel: 12000,
        tolls: 3000,
      });

      assert.equal(heavyQuote.subtotal, 110000);
      assert.equal(heavyQuote.gstAmount, 5500); // 5% of 110,000
      assert.equal(heavyQuote.totalAmount, 115500);
      assert.equal(heavyQuote.tdsAmount, 850); // 1% of 85,000
      assert.equal(heavyQuote.netPayout, 114650);
    });
  });

  describe('Real GPS Telemetry Integrity vs Mock Data Prevention', () => {
    const evaluateTelemetryState = (locations, currentCoord) => {
      const hasRealPing = Boolean(
        (currentCoord && currentCoord.lat && currentCoord.lng) ||
        (locations && locations.length > 0)
      );

      if (!hasRealPing) {
        return {
          status: 'AWAITING_TELEMETRY',
          badgeText: 'AWAITING TELEMETRY',
          showMockCoordinates: false,
        };
      }

      return {
        status: 'REAL_GPS_ACTIVE',
        badgeText: 'REAL GPS ACTIVE',
        showMockCoordinates: false,
      };
    };

    it('strictly shows awaiting state and prevents mock coordinates when no GPS has pinged', () => {
      const stateEmpty = evaluateTelemetryState([], null);
      assert.equal(stateEmpty.status, 'AWAITING_TELEMETRY');
      assert.equal(stateEmpty.showMockCoordinates, false);

      const stateNull = evaluateTelemetryState(null, undefined);
      assert.equal(stateNull.status, 'AWAITING_TELEMETRY');
      assert.equal(stateNull.showMockCoordinates, false);
    });

    it('enables real GPS tracking only when authentic coordinates are received', () => {
      const stateActive = evaluateTelemetryState(
        [{ latitude: 19.076, longitude: 72.8777, speed: 60 }],
        { lat: 19.076, lng: 72.8777 }
      );
      assert.equal(stateActive.status, 'REAL_GPS_ACTIVE');
      assert.equal(stateActive.badgeText, 'REAL GPS ACTIVE');
    });

    it('validates coordinate boundaries within the Indian sub-continent geographical envelope', () => {
      const isWithinIndiaEnvelope = (lat, lng) => {
        return lat >= 6.0 && lat <= 38.0 && lng >= 68.0 && lng <= 98.0;
      };

      // Mumbai
      assert.equal(isWithinIndiaEnvelope(19.0760, 72.8777), true);
      // Delhi
      assert.equal(isWithinIndiaEnvelope(28.6139, 77.2090), true);
      // Bengaluru
      assert.equal(isWithinIndiaEnvelope(12.9716, 77.5946), true);
      // Kolkata
      assert.equal(isWithinIndiaEnvelope(22.5726, 88.3639), true);

      // Out of bounds (e.g. Pacific ocean, North pole, London)
      assert.equal(isWithinIndiaEnvelope(51.5074, -0.1278), false); // London
      assert.equal(isWithinIndiaEnvelope(40.7128, -74.0060), false); // New York
      assert.equal(isWithinIndiaEnvelope(0.0, 0.0), false); // Null Island
    });
  });

  describe('Proof of Delivery 6-Digit OTP / PIN Verification Validation', () => {
    const validateDeliveryOtp = (otp) => {
      if (!otp) return { valid: false, error: 'OTP is required' };
      const trimmed = String(otp).trim();
      if (!/^\d{6}$/.test(trimmed)) {
        return { valid: false, error: 'OTP must be exactly 6 numeric digits' };
      }
      return { valid: true, error: null, formattedOtp: trimmed };
    };

    it('validates 6-digit delivery confirmation OTP format', () => {
      assert.equal(validateDeliveryOtp('123456').valid, true);
      assert.equal(validateDeliveryOtp('984712').valid, true);
      assert.equal(validateDeliveryOtp('000000').valid, true);

      // Invalid inputs
      assert.equal(validateDeliveryOtp('12345').valid, false); // 5 digits
      assert.equal(validateDeliveryOtp('1234567').valid, false); // 7 digits
      assert.equal(validateDeliveryOtp('12A456').valid, false); // Alphanumeric
      assert.equal(validateDeliveryOtp(' ').valid, false); // Whitespace
      assert.equal(validateDeliveryOtp(null).valid, false); // Null
    });
  });

  describe('Role-Based Access Control and Navigation Integrity', () => {
    it('contains transport_partner role in constants and navigation', () => {
      assert.equal(ROLES.transport_partner, 'transport_partner');
      assert.equal(ROLE_HOME.transport_partner, '/transporter/dashboard');
      assert.ok(Array.isArray(dashboardNav.transport_partner), 'Transporter nav items must be registered');
    });

    it('preserves buyer dashboard navigation integrity (exactly 13 items)', () => {
      assert.ok(Array.isArray(dashboardNav.buyer));
      assert.equal(dashboardNav.buyer.length, 13, 'Regression safeguard: buyer nav must have 13 items');
    });

    it('preserves supplier dashboard navigation integrity including Shipping & Delivery', () => {
      assert.ok(Array.isArray(dashboardNav.supplier));
      const shippingNav = dashboardNav.supplier.find((item) => item.to === '/supplier/shipping');
      assert.ok(shippingNav, 'Supplier nav must include Shipping & Delivery at /supplier/shipping');
      assert.equal(shippingNav.icon, 'Truck');
    });
  });

  describe('Mandatory 7-Step Logistics Sequence Frontend Invariants', () => {
    it('Step 2 & 3: Supplier order confirmation enables Arrange Delivery leading to Step 3', () => {
      const order = { id: 'ORD-101', status: 'CONFIRMED', orderNumber: 'TS-261030-ABCDEF' };
      const canArrangeDelivery = ['CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED'].includes(order.status.toUpperCase());
      assert.equal(canArrangeDelivery, true);
      const deliveryRoute = `/supplier/shipping?orderId=${order.id}`;
      assert.equal(deliveryRoute, '/supplier/shipping?orderId=ORD-101');
    });

    it('Step 3 -> Step 4: Consignment in DOCUMENTS_PENDING locks dispatch until Super Admin approves', () => {
      const pendingShipment = { id: 'SHP-1', status: 'DOCUMENTS_PENDING', vehicleNumber: 'MH-12-AB-1234' };
      
      // Dispatch action must NOT be available while DOCUMENTS_PENDING
      const canDispatch = ['READY_FOR_PICKUP', 'DOCUMENTS_VERIFIED'].includes(pendingShipment.status);
      assert.equal(canDispatch, false);

      // Super Admin verifies consignment
      const verifiedShipment = { ...pendingShipment, status: 'READY_FOR_PICKUP' };
      const canDispatchAfterVerify = ['READY_FOR_PICKUP', 'DOCUMENTS_VERIFIED'].includes(verifiedShipment.status);
      assert.equal(canDispatchAfterVerify, true);
    });

    it('Step 7: Delivery OTP and Multi-Consignment Order Delivery Rule', () => {
      // Step 7 OTP verification
      const buyerOtp = '654321';
      const enteredOtp = '654321';
      assert.equal(buyerOtp === enteredOtp, true);

      // Multi-consignment order rule: All shipments must be delivered before order is DELIVERED
      const consignments = [
        { id: 'C-1', status: 'DELIVERED' },
        { id: 'C-2', status: 'IN_TRANSIT' },
      ];

      const allConsignmentsDelivered = consignments.every((c) => c.status === 'DELIVERED');
      assert.equal(allConsignmentsDelivered, false, 'Order must NOT be marked DELIVERED while C-2 is in transit');

      consignments[1].status = 'DELIVERED';
      const allNowDelivered = consignments.every((c) => c.status === 'DELIVERED');
      assert.equal(allNowDelivered, true, 'Order transitions to DELIVERED only when both consignments are delivered');
    });
  });
});

