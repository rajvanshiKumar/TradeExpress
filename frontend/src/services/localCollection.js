// A tiny Promise-based "table" stored in localStorage. Services build on this so that
// contexts and pages talk to data the same way they would talk to a real API.

import { hasStorage, readStorage, writeStorage } from '../utils/storage';
import { SIMULATED_DELAY_MS } from '../utils/constants';

const clone = (value) => JSON.parse(JSON.stringify(value));

export const wait = (ms = SIMULATED_DELAY_MS) => new Promise((resolve) => window.setTimeout(resolve, ms));

export function createCollection(key, seed) {
  const readInstant = () => {
    if (!hasStorage(key)) {
      writeStorage(key, seed);
      return clone(seed);
    }
    // Malformed or wrong-shaped data falls back to the seed inside readStorage.
    return readStorage(key, clone(seed));
  };

  return {
    readInstant,
    /** Resolves with the saved records. Seeds the collection only when nothing is saved yet. */
    async list({ delay = SIMULATED_DELAY_MS } = {}) {
      if (delay) await wait(delay);
      return readInstant();
    },
    /** Saves the whole collection. Local writes are instant, so no delay is simulated. */
    async saveAll(records) {
      writeStorage(key, records);
      return records;
    },
  };
}
