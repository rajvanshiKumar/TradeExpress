import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SHIPMENT_STATUS as S, assertTransition, canTransition, nextStatuses } from '../../src/services/transport/shipmentStateMachine.js';
import { driverProblems, maskLicence, normaliseLicenceNumber, normaliseVehicleNumber, vehicleProblems } from '../../src/services/transport/fleetService.js';

describe('Shipment state machine', () => {
  it('follows the order-to-delivery path', () => {
    const path = [
      [S.AWAITING_TRANSPORT, S.TRANSPORT_ASSIGNED, 'SUPPLIER'],
      [S.TRANSPORT_ASSIGNED, S.PICKUP_SCHEDULED, 'SUPPLIER'],
      [S.PICKUP_SCHEDULED, S.LOADING_IN_PROGRESS, 'SUPPLIER'],
      [S.LOADING_IN_PROGRESS, S.LOADED, 'SUPPLIER'],
      [S.LOADED, S.PICKED_UP, 'SUPPLIER'],
      [S.PICKED_UP, S.IN_TRANSIT, 'SUPPLIER'],
      [S.IN_TRANSIT, S.OUT_FOR_DELIVERY, 'SUPER_ADMIN'],
      [S.OUT_FOR_DELIVERY, S.DELIVERED_PENDING_CONFIRMATION, 'SUPPLIER'],
      [S.DELIVERED_PENDING_CONFIRMATION, S.DELIVERED, 'BUYER'],
    ];
    for (const [from, to, role] of path) assert.equal(canTransition(from, to, role), true, `${from} -> ${to} by ${role}`);
  });

  it('only TradeExpress assigns a truck to a requested shipment', () => {
    assert.equal(canTransition(S.TRANSPORT_REQUESTED, S.TRANSPORT_ASSIGNED, 'SUPER_ADMIN'), true);
    assert.equal(canTransition(S.TRANSPORT_REQUESTED, S.TRANSPORT_ASSIGNED, 'SUPPLIER'), false);
  });

  it('buyers cannot arrange or move transport, only confirm delivery', () => {
    assert.deepEqual(nextStatuses(S.AWAITING_TRANSPORT, 'BUYER'), []);
    assert.deepEqual(nextStatuses(S.IN_TRANSIT, 'BUYER'), []);
    assert.deepEqual(nextStatuses(S.DELIVERED_PENDING_CONFIRMATION, 'BUYER'), [S.DELIVERED]);
  });

  it('refuses skipping steps: no dispatch without loading, no delivery before dispatch, no repeat completion', () => {
    assert.throws(() => assertTransition(S.TRANSPORT_ASSIGNED, S.IN_TRANSIT, 'SUPPLIER'), { statusCode: 409 });
    assert.throws(() => assertTransition(S.AWAITING_TRANSPORT, S.PICKED_UP, 'SUPPLIER'), { statusCode: 409 });
    assert.throws(() => assertTransition(S.LOADED, S.DELIVERED, 'SUPER_ADMIN'), { statusCode: 409 });
    assert.throws(() => assertTransition(S.DELIVERED, S.DELIVERED, 'BUYER'), { statusCode: 409 });
  });

  it('a supplier cannot confirm delivery on the buyer\'s behalf', () => {
    assert.throws(() => assertTransition(S.DELIVERED_PENDING_CONFIRMATION, S.DELIVERED, 'SUPPLIER'), { statusCode: 403 });
  });

  it('goods that left the warehouse cannot be cancelled', () => {
    for (const status of [S.PICKED_UP, S.IN_TRANSIT, S.OUT_FOR_DELIVERY]) assert.equal(canTransition(status, S.CANCELLED, 'SUPER_ADMIN'), false);
  });
});

describe('Truck and driver validation', () => {
  it('normalises Indian registration numbers and rejects bad ones', () => {
    assert.equal(normaliseVehicleNumber('mh 12-ab 1234'), 'MH12AB1234');
    assert.equal(normaliseVehicleNumber('22 BH 1234 AA'), '22BH1234AA');
    assert.throws(() => normaliseVehicleNumber('TRUCK-1'), { statusCode: 400 });
  });

  it('normalises driving licence numbers and masks them', () => {
    assert.equal(normaliseLicenceNumber('MH14 20110012345'), 'MH1420110012345');
    assert.throws(() => normaliseLicenceNumber('12345'), { statusCode: 400 });
    assert.equal(maskLicence('MH1420110012345'), 'MH14••••••••345');
  });

  it('flags expired documents and maintenance before a trip', () => {
    const tripEnd = new Date('2026-12-10');
    const truck = { status: 'AVAILABLE', rcNumber: 'RC1', insuranceExpiryDate: new Date('2026-12-01'), permitExpiryDate: new Date('2027-05-01') };
    assert.match(vehicleProblems(truck, tripEnd).join(' '), /Insurance expires/);
    assert.deepEqual(vehicleProblems({ ...truck, insuranceExpiryDate: new Date('2027-06-01') }, tripEnd), []);
    assert.match(vehicleProblems({ ...truck, status: 'MAINTENANCE', insuranceExpiryDate: new Date('2027-06-01') }, tripEnd).join(' '), /maintenance/);
  });

  it('flags a driver whose licence expires before the trip ends', () => {
    assert.match(driverProblems({ status: 'AVAILABLE', verificationStatus: 'VERIFIED', licenseExpiryDate: new Date('2026-12-05') }, new Date('2026-12-10')).join(' '), /licence expires/);
    assert.deepEqual(driverProblems({ status: 'AVAILABLE', verificationStatus: 'PENDING', licenseExpiryDate: new Date('2030-01-01') }, new Date('2026-12-10')), []);
  });
});
