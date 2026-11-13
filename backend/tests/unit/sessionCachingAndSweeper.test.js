import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  invalidateSessionCache,
  getCachedUser,
  isSessionActive,
} from '../../src/services/sessionService.js';
import {
  expireStaleReservations,
  startReservationSweeper,
  stopReservationSweeper,
} from '../../src/services/inventoryLifecycleService.js';

describe('Session caching & background sweeper safety', () => {
  it('invalidateSessionCache safely evicts session and user entries', () => {
    // Should not throw even when keys do not exist
    assert.doesNotThrow(() => invalidateSessionCache('test-sid', 'test-uid'));
    assert.doesNotThrow(() => invalidateSessionCache(null, 'test-uid'));
    assert.doesNotThrow(() => invalidateSessionCache('test-sid', null));
    assert.doesNotThrow(() => invalidateSessionCache(null, null));
  });

  it('getCachedUser returns null for empty or null user ID without database query', async () => {
    const res1 = await getCachedUser(null);
    assert.equal(res1, null);
    const res2 = await getCachedUser('');
    assert.equal(res2, null);
  });

  it('isSessionActive returns true for tokens without sid (legacy tokens)', async () => {
    const res = await isSessionActive({ userId: 'u1' });
    assert.equal(res, true);
    const res2 = await isSessionActive(null);
    assert.equal(res2, true);
  });

  it('startReservationSweeper and stopReservationSweeper start and clear cleanly without leaks', () => {
    const sweeper = startReservationSweeper(60000);
    assert.ok(sweeper);
    // Calling again returns the existing singleton sweeper
    const sweeper2 = startReservationSweeper(60000);
    assert.equal(sweeper, sweeper2);

    stopReservationSweeper();
    // After stopping, starting again creates a new sweeper
    const sweeper3 = startReservationSweeper(60000);
    assert.ok(sweeper3);
    stopReservationSweeper();
  });
});

