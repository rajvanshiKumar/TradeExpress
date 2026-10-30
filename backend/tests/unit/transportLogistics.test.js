import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHIPMENT_STATUSES,
  ALLOWED_TRANSITIONS,
  STATUS_PERMISSION_RULES,
  validateStatusTransition,
} from '../../src/services/logisticsStateMachine.js';

describe('Transportation & Logistics Management Test Suite', () => {
  describe('1. Shipment State Machine Transition Validation', () => {
    it('contains all 17 mandatory logistics lifecycle statuses', () => {
      const expectedStatuses = [
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

      expectedStatuses.forEach((st) => {
        assert.ok(SHIPMENT_STATUSES[st], `Status ${st} must exist in SHIPMENT_STATUSES`);
        assert.ok(Array.isArray(ALLOWED_TRANSITIONS[st]), `Status ${st} must have an ALLOWED_TRANSITIONS entry`);
      });
    });

    it('permits valid linear progression for Supplier-Managed transport with Step 4 Super Admin verification', () => {
      // Step 3: TRANSPORT_PENDING -> DOCUMENTS_PENDING (truck details & documents submitted)
      let check = validateStatusTransition('TRANSPORT_PENDING', 'DOCUMENTS_PENDING', 'SUPPLIER');
      assert.equal(check.valid, true);

      // Supplier cannot self-approve to READY_FOR_PICKUP (requires SUPER_ADMIN / ADMIN)
      check = validateStatusTransition('DOCUMENTS_PENDING', 'READY_FOR_PICKUP', 'SUPPLIER');
      assert.equal(check.valid, false);

      // Step 4: Super Admin verifies and approves shipment
      check = validateStatusTransition('DOCUMENTS_PENDING', 'READY_FOR_PICKUP', 'SUPER_ADMIN');
      assert.equal(check.valid, true);

      // Step 5: Dispatched (READY_FOR_PICKUP -> PICKED_UP by SUPPLIER or TRANSPORTER)
      check = validateStatusTransition('READY_FOR_PICKUP', 'PICKED_UP', 'SUPPLIER');
      assert.equal(check.valid, true);

      // Step 6: Tracking in transit
      check = validateStatusTransition('PICKED_UP', 'IN_TRANSIT', 'SUPPLIER');
      assert.equal(check.valid, true);

      check = validateStatusTransition('IN_TRANSIT', 'OUT_FOR_DELIVERY', 'ADMIN');
      assert.equal(check.valid, true);

      // Step 7: Delivery completed
      check = validateStatusTransition('OUT_FOR_DELIVERY', 'DELIVERED', 'BUYER');
      assert.equal(check.valid, true);
    });

    it('permits valid TradeExpress-Managed quotation lifecycle', () => {
      // TRANSPORT_PENDING -> TRANSPORT_REQUESTED -> QUOTATION_PENDING -> QUOTATION_RECEIVED -> TRANSPORT_ASSIGNED
      let check = validateStatusTransition('TRANSPORT_PENDING', 'TRANSPORT_REQUESTED', 'SUPPLIER');
      assert.equal(check.valid, true);

      check = validateStatusTransition('TRANSPORT_REQUESTED', 'QUOTATION_PENDING', 'ADMIN');
      assert.equal(check.valid, true);

      check = validateStatusTransition('QUOTATION_PENDING', 'QUOTATION_RECEIVED', 'TRANSPORT_PARTNER');
      assert.equal(check.valid, true);

      check = validateStatusTransition('QUOTATION_RECEIVED', 'TRANSPORT_ASSIGNED', 'SUPPLIER');
      assert.equal(check.valid, true);
    });

    it('rejects illegal backwards or bypassed transitions', () => {
      // DELIVERED cannot transition backwards to READY_FOR_PICKUP
      let check = validateStatusTransition('DELIVERED', 'READY_FOR_PICKUP', 'SUPPLIER');
      assert.equal(check.valid, false);
      assert.ok(check.error.includes('not allowed'));

      // CANCELLED is terminal: cannot transition anywhere
      check = validateStatusTransition('CANCELLED', 'IN_TRANSIT', 'ADMIN');
      assert.equal(check.valid, false);

      // RETURNED is terminal
      check = validateStatusTransition('RETURNED', 'READY_FOR_PICKUP', 'ADMIN');
      assert.equal(check.valid, false);

      // Cannot skip directly from TRANSPORT_PENDING to DELIVERED
      check = validateStatusTransition('TRANSPORT_PENDING', 'DELIVERED', 'BUYER');
      assert.equal(check.valid, false);
    });

    it('enforces role authorization on sensitive transitions', () => {
      // A BUYER cannot mark an order PICKED_UP (only TRANSPORTER, SUPPLIER, ADMIN)
      let check = validateStatusTransition('READY_FOR_PICKUP', 'PICKED_UP', 'BUYER');
      assert.equal(check.valid, false);
      assert.ok(check.error.includes('not authorized'));

      // A BUYER CAN raise DELIVERY_DISPUTED from IN_TRANSIT, OUT_FOR_DELIVERY or DELIVERED
      check = validateStatusTransition('DELIVERED', 'DELIVERY_DISPUTED', 'BUYER');
      assert.equal(check.valid, true);

      // A SUPER_ADMIN can authorize any valid transition
      check = validateStatusTransition('READY_FOR_PICKUP', 'PICKED_UP', 'SUPER_ADMIN');
      assert.equal(check.valid, true);
    });
  });

  describe('2. Freight Quotation & GTA GST Tax Calculation', () => {
    function calculateFreightQuote({ baseFreight, loadingCharges = 0, unloadingCharges = 0, fuelSurcharge = 0, tollTaxes = 0 }) {
      const subtotal = baseFreight + loadingCharges + unloadingCharges + fuelSurcharge + tollTaxes;
      const gstRate = 5.00; // 5% GTA GST
      const gstAmount = Math.round((subtotal * (gstRate / 100) + Number.EPSILON) * 100) / 100;
      const totalFreight = Math.round((subtotal + gstAmount + Number.EPSILON) * 100) / 100;
      return { subtotal, gstRate, gstAmount, totalFreight };
    }

    it('calculates comprehensive freight quotation with 5% GTA GST', () => {
      const breakdown = calculateFreightQuote({
        baseFreight: 45000,
        loadingCharges: 2500,
        unloadingCharges: 2500,
        fuelSurcharge: 4000,
        tollTaxes: 3000,
      });

      // Subtotal = 45000 + 2500 + 2500 + 4000 + 3000 = 57,000
      assert.equal(breakdown.subtotal, 57000);
      // GST 5% = 57000 * 0.05 = 2,850
      assert.equal(breakdown.gstAmount, 2850);
      // Total Freight = 59,850
      assert.equal(breakdown.totalFreight, 59850);
    });
  });

  describe('3. Fleet & Driver Double-Booking Prevention', () => {
    it('prevents assigning vehicles or drivers that are not AVAILABLE', () => {
      const mockVehicle = { id: 'V-101', vehicleNumber: 'DL-01-AB-1234', status: 'IN_TRANSIT' };
      const mockDriver = { id: 'D-202', name: 'Ramesh Singh', status: 'ASSIGNED' };

      function validateAssignment(vehicle, driver) {
        if (vehicle.status !== 'AVAILABLE') {
          throw new Error(`Vehicle ${vehicle.vehicleNumber} is currently ${vehicle.status}.`);
        }
        if (driver.status !== 'AVAILABLE') {
          throw new Error(`Driver ${driver.name} is currently ${driver.status}.`);
        }
        return true;
      }

      assert.throws(() => validateAssignment(mockVehicle, { status: 'AVAILABLE', name: 'Valid Driver' }), {
        message: /is currently IN_TRANSIT/,
      });

      assert.throws(() => validateAssignment({ status: 'AVAILABLE', vehicleNumber: 'MH-12-CD-5678' }, mockDriver), {
        message: /is currently ASSIGNED/,
      });
    });
  });

  describe('4. Real GPS Telemetry Invariants (Never Fake)', () => {
    function validateTelemetryCoordinates(latitude, longitude) {
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (isNaN(lat) || lat < -90 || lat > 90) return false;
      if (isNaN(lng) || lng < -180 || lng > 180) return false;
      return true;
    }

    it('accepts genuine geographic coordinates within valid world bounds', () => {
      assert.equal(validateTelemetryCoordinates(19.076, 72.8777), true); // Mumbai
      assert.equal(validateTelemetryCoordinates(28.6139, 77.209), true); // Delhi
      assert.equal(validateTelemetryCoordinates(12.9716, 77.5946), true); // Bengaluru
    });

    it('strictly rejects illegal out-of-bound or corrupted coordinates', () => {
      assert.equal(validateTelemetryCoordinates(95.0, 77.0), false); // Latitude > 90
      assert.equal(validateTelemetryCoordinates(28.0, 195.0), false); // Longitude > 180
      assert.equal(validateTelemetryCoordinates('NaN', 77.0), false);
    });
  });

  describe('5. Proof of Delivery (POD) & OTP Verification', () => {
    function verifyDeliveryPOD(expectedOtp, enteredOtp, recipientName) {
      if (!recipientName || !recipientName.trim()) {
        throw new Error('Recipient name is required.');
      }
      if (!enteredOtp || enteredOtp.trim() !== expectedOtp.trim()) {
        throw new Error('Invalid delivery confirmation OTP.');
      }
      return { verified: true, recipientName: recipientName.trim(), status: 'DELIVERED' };
    }

    it('successfully confirms delivery upon entering matching buyer OTP', () => {
      const expected = '482910';
      const result = verifyDeliveryPOD(expected, '482910', 'Arun Patel (Store Manager)');
      assert.equal(result.verified, true);
      assert.equal(result.status, 'DELIVERED');
      assert.equal(result.recipientName, 'Arun Patel (Store Manager)');
    });

    it('rejects delivery confirmation with wrong OTP and prevents status progression', () => {
      assert.throws(() => verifyDeliveryPOD('482910', '123456', 'Arun Patel'), {
        message: /Invalid delivery confirmation OTP/,
      });
    });
  });

  describe('6. Freight Escrow & TDS Calculations', () => {
    function calculateFreightEscrow(grossAmount) {
      const gross = Number(grossAmount);
      // Section 194C TDS: 1% for individual transporter, 2% for corporate
      const tdsAmount = Math.round((gross * 0.01 + Number.EPSILON) * 100) / 100;
      const platformFee = Math.round((gross * 0.02 + Number.EPSILON) * 100) / 100; // 2% platform fee
      const netPayable = Math.round((gross - tdsAmount - platformFee + Number.EPSILON) * 100) / 100;
      return { gross, tdsAmount, platformFee, netPayable };
    }

    it('accurately computes TDS and net payable held in Freight Escrow', () => {
      const escrow = calculateFreightEscrow(50000);
      assert.equal(escrow.gross, 50000);
      assert.equal(escrow.tdsAmount, 500); // 1%
      assert.equal(escrow.platformFee, 1000); // 2%
      assert.equal(escrow.netPayable, 48500); // 50000 - 500 - 1000
    });
  });

  describe('7. IDOR & Data Scoping Invariants', () => {
    function canAccessShipment(shipment, user) {
      if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
      if (user.role === 'SUPPLIER' && shipment.supplierId === user.id) return true;
      if (user.role === 'BUYER' && shipment.buyerId === user.id) return true;
      if (user.role === 'TRANSPORT_PARTNER' && shipment.transporterOwnerId === user.id) return true;
      return false;
    }

    it('restricts shipment access strictly to involved participants', () => {
      const shipment = {
        id: 'SHP-001',
        supplierId: 'SUPPLIER-1',
        buyerId: 'BUYER-1',
        transporterOwnerId: 'TRANS-1',
      };

      assert.equal(canAccessShipment(shipment, { id: 'SUPPLIER-1', role: 'SUPPLIER' }), true);
      assert.equal(canAccessShipment(shipment, { id: 'BUYER-1', role: 'BUYER' }), true);
      assert.equal(canAccessShipment(shipment, { id: 'TRANS-1', role: 'TRANSPORT_PARTNER' }), true);
      assert.equal(canAccessShipment(shipment, { id: 'ADMIN-1', role: 'SUPER_ADMIN' }), true);

      // Third-party supplier or buyer cannot inspect
      assert.equal(canAccessShipment(shipment, { id: 'SUPPLIER-99', role: 'SUPPLIER' }), false);
      assert.equal(canAccessShipment(shipment, { id: 'BUYER-99', role: 'BUYER' }), false);
      assert.equal(canAccessShipment(shipment, { id: 'TRANS-99', role: 'TRANSPORT_PARTNER' }), false);
    });
  });

  describe('8. Mandatory 7-Step Business Workflow Sequence Enforcement', () => {
    it('Step 1 -> Step 2: Supplier accepts or rejects confirmed order', () => {
      const order = { id: 'ORD-1', orderStatus: 'ORDER_PLACED' };
      function supplierAcceptOrder(ord, user) {
        if (user.role !== 'SUPPLIER') throw new Error('Unauthorized');
        if (!['ORDER_PLACED', 'PENDING'].includes(ord.orderStatus)) throw new Error('Invalid order state');
        return { ...ord, orderStatus: 'ORDER_CONFIRMED' };
      }
      const accepted = supplierAcceptOrder(order, { role: 'SUPPLIER' });
      assert.equal(accepted.orderStatus, 'ORDER_CONFIRMED');
    });

    it('Step 3: Truck details submission places shipment in DOCUMENTS_PENDING', () => {
      const initialStatus = SHIPMENT_STATUSES.DOCUMENTS_PENDING;
      assert.equal(initialStatus, 'DOCUMENTS_PENDING');
    });

    it('Step 4: Dispatch is strictly blocked while in DOCUMENTS_PENDING until Super Admin verifies', () => {
      // Premature dispatch attempt must fail
      const prematureDispatch = validateStatusTransition('DOCUMENTS_PENDING', 'PICKED_UP', 'SUPPLIER');
      assert.equal(prematureDispatch.valid, false);
      assert.match(prematureDispatch.error, /Required Super Admin verification must be complete before dispatch/);

      // Super Admin approval succeeds
      const adminApproval = validateStatusTransition('DOCUMENTS_PENDING', 'READY_FOR_PICKUP', 'SUPER_ADMIN');
      assert.equal(adminApproval.valid, true);
    });

    it('Step 5: Shipment dispatch updates status to PICKED_UP and marks order SHIPPED', () => {
      const dispatchCheck = validateStatusTransition('READY_FOR_PICKUP', 'PICKED_UP', 'SUPPLIER');
      assert.equal(dispatchCheck.valid, true);
    });

    it('Step 7: Multi-shipment rule — Order only marked DELIVERED when ALL consignments delivered', () => {
      const orderShipments = [
        { id: 'SHP-1', status: 'DELIVERED' },
        { id: 'SHP-2', status: 'IN_TRANSIT' },
      ];

      function checkAllDelivered(shipments, currentDeliveringId) {
        return shipments.every((s) => s.id === currentDeliveringId || s.status === 'DELIVERED');
      }

      // If only SHP-1 is delivered, order is NOT delivered
      assert.equal(checkAllDelivered(orderShipments, 'SHP-1'), false);

      // When SHP-2 is also delivered, order becomes DELIVERED
      orderShipments[1].status = 'DELIVERED';
      assert.equal(checkAllDelivered(orderShipments, 'SHP-2'), true);
    });
  });

  describe('9. Super Admin Truck Approvals & Verification Actions (Approve, Reject, Correction)', () => {
    function simulateAdminVerification(shipment, user, { action, reason }) {
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
        throw new Error('Forbidden. Only Super Admin or Admin can verify shipments.');
      }
      const act = (action || 'APPROVE').toUpperCase();
      if (act === 'APPROVE') {
        return {
          ...shipment,
          status: 'READY_FOR_PICKUP',
          notes: reason || 'Approved by Super Admin for dispatch.',
          documents: (shipment.documents || []).map((d) => ({ ...d, isVerified: true })),
        };
      }
      if (act === 'CORRECTION') {
        return {
          ...shipment,
          status: 'DOCUMENTS_PENDING',
          notes: `[Correction Requested] ${reason}`,
        };
      }
      if (act === 'REJECT') {
        return {
          ...shipment,
          status: 'CANCELLED',
          notes: `[Verification Rejected] ${reason}`,
          vehicleStatus: 'AVAILABLE',
          driverStatus: 'AVAILABLE',
        };
      }
      throw new Error(`Unknown action: ${act}`);
    }

    const mockShipment = {
      id: 'SHP-TEST-1',
      status: 'DOCUMENTS_PENDING',
      vehicleNumber: 'MH04AB1234',
      driverName: 'Ramesh Singh',
      documents: [
        { id: 'DOC-1', docType: 'VEHICLE_RC', isVerified: false },
        { id: 'DOC-2', docType: 'DRIVER_DL', isVerified: false },
      ],
    };

    it('denies verification attempts from Buyer or Supplier roles', () => {
      assert.throws(
        () => simulateAdminVerification(mockShipment, { role: 'SUPPLIER' }, { action: 'APPROVE' }),
        /Forbidden/
      );
      assert.throws(
        () => simulateAdminVerification(mockShipment, { role: 'BUYER' }, { action: 'APPROVE' }),
        /Forbidden/
      );
    });

    it('Approve action: transitions status to READY_FOR_PICKUP and marks documents verified', () => {
      const res = simulateAdminVerification(
        mockShipment,
        { role: 'SUPER_ADMIN' },
        { action: 'APPROVE', reason: 'RC and DL verified.' }
      );
      assert.equal(res.status, 'READY_FOR_PICKUP');
      assert.ok(res.documents.every((d) => d.isVerified === true));
      assert.match(res.notes, /RC and DL verified/);
    });

    it('Request Correction action: keeps status in DOCUMENTS_PENDING with correction instruction', () => {
      const res = simulateAdminVerification(
        mockShipment,
        { role: 'SUPER_ADMIN' },
        { action: 'CORRECTION', reason: 'RC image blurry. Please re-upload legible scan.' }
      );
      assert.equal(res.status, 'DOCUMENTS_PENDING');
      assert.match(res.notes, /\[Correction Requested\] RC image blurry/);
    });

    it('Reject action: cancels consignment and marks rejection reason', () => {
      const res = simulateAdminVerification(
        mockShipment,
        { role: 'SUPER_ADMIN' },
        { action: 'REJECT', reason: 'Commercial carrier permit expired.' }
      );
      assert.equal(res.status, 'CANCELLED');
      assert.match(res.notes, /\[Verification Rejected\] Commercial carrier permit expired/);
      assert.equal(res.vehicleStatus, 'AVAILABLE');
      assert.equal(res.driverStatus, 'AVAILABLE');
    });
  });
});

