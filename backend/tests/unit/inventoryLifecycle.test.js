import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { availableOf, nextForTransition } from '../../src/services/inventoryLifecycleService.js';

const product = (stock, reservedStock, committedStock) => ({ stock, reservedStock, committedStock });

describe('Inventory lifecycle: On hand / Reserved / Committed / Available', () => {
  it('available is on hand minus reserved minus committed, never negative', () => {
    assert.equal(availableOf(product(100, 20, 30)), 50);
    assert.equal(availableOf(product(10, 6, 6)), 0);
    assert.equal(availableOf(product(0, 0, 0)), 0);
  });

  it('payment moves units from reserved to committed without touching on hand', () => {
    assert.deepEqual(nextForTransition('COMMIT', 'RESERVED', product(100, 10, 0), 4), product(100, 6, 4));
  });

  it('release returns units from whichever bucket held them', () => {
    assert.deepEqual(nextForTransition('RELEASE', 'RESERVED', product(100, 10, 5), 4), product(100, 6, 5));
    assert.deepEqual(nextForTransition('RELEASE', 'COMMITTED', product(100, 10, 5), 4), product(100, 10, 1));
  });

  it('shipping removes units from on hand and from the bucket that held them', () => {
    assert.deepEqual(nextForTransition('FULFIL', 'COMMITTED', product(100, 10, 5), 5), product(95, 10, 0));
    assert.deepEqual(nextForTransition('FULFIL', 'RESERVED', product(100, 10, 5), 4), product(96, 6, 5));
  });

  it('a received return adds units back to on hand only', () => {
    assert.deepEqual(nextForTransition('RETURN', 'FULFILLED', product(95, 10, 0), 5), product(100, 10, 0));
  });

  it('a transition never takes a bucket below zero', () => {
    assert.deepEqual(nextForTransition('RELEASE', 'RESERVED', product(5, 2, 0), 4), product(5, 0, 0));
  });

  it('rejects unknown actions', () => {
    assert.throws(() => nextForTransition('TELEPORT', 'RESERVED', product(1, 1, 0), 1));
  });
});
