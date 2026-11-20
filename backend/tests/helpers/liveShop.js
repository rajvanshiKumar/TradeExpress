import fs from 'fs';
import path from 'path';
import { uploadDir } from '../../src/middleware/uploadMiddleware.js';

/**
 * Signup Step 4 fields for tests: a tiny "live photo" written to uploads/ (removed after the test), a position
 * taken just now and a social link. Address lookup is switched off so no test calls the network.
 */
export function liveShop(t, overrides = {}) {
  process.env.REVERSE_GEOCODE_URL = 'off';
  const name = `test-shop-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const file = path.join(uploadDir, name);
  fs.writeFileSync(file, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  t?.after(() => fs.rmSync(file, { force: true }));
  return {
    shopName: 'Test Shop',
    shopPhotoUrl: `/uploads/${name}`,
    shopLatitude: 28.6129,
    shopLongitude: 77.2295,
    shopLocationAccuracy: 12,
    shopCapturedAt: new Date().toISOString(),
    socialLinks: ['instagram.com/testshop'],
    ...overrides,
  };
}
