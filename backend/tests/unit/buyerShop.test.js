import test from 'node:test';
import assert from 'node:assert/strict';
import { liveShop } from '../helpers/liveShop.js';
import {
  clearGeocodeCache, normalizeSocialLinks, prepareShopProfile, resolveShopPhotoPath, reverseGeocode, socialPlatform,
} from '../../src/services/buyerShopService.js';

const nominatimReply = {
  display_name: 'Shop 4, Shahjahan Road, Pandara Park, New Delhi, Delhi, 110003, India',
  address: { shop: 'Shop 4', road: 'Shahjahan Road', neighbourhood: 'Pandara Park', city: 'New Delhi', state: 'Delhi', postcode: '110003', country: 'India' },
};

test('Buyer shop verification (signup Step 4)', async (t) => {
  t.afterEach(() => { process.env.REVERSE_GEOCODE_URL = 'off'; clearGeocodeCache(); });

  await t.test('live photo, live location, optional name and links are saved; the address comes from the server', async (tt) => {
    const shop = liveShop(tt);
    process.env.REVERSE_GEOCODE_URL = 'https://geocoder.test/reverse';
    const calls = [];
    const profile = await prepareShopProfile(
      { ...shop, shopName: '  Sharma   General Store ', socialLinks: ['instagram.com/sharma', 'https://wa.me/919876543210', 'instagram.com/sharma'] },
      { request: async (url, opts) => { calls.push({ url, opts }); return { status: 200, data: nominatimReply }; } },
    );
    assert.equal(profile.shopName, 'Sharma General Store');
    assert.equal(profile.photoUrl, shop.shopPhotoUrl);
    assert.equal(profile.latitude, 28.6129);
    assert.equal(profile.address, 'Shop 4, Shahjahan Road, Pandara Park, New Delhi, Delhi, 110003');
    assert.equal(profile.addressDetails.fullAddress, nominatimReply.display_name);
    assert.deepEqual(profile.socialLinks, [
      { platform: 'Instagram', url: 'https://instagram.com/sharma' },
      { platform: 'WhatsApp', url: 'https://wa.me/919876543210' },
    ], 'duplicates removed, platforms named');
    assert.equal(calls.length, 1);
    assert.deepEqual([calls[0].opts.params.lat, calls[0].opts.params.lon], [28.6129, 77.2295], 'only coordinates are sent');
    assert.ok(!JSON.stringify(calls[0].opts).includes('Sharma'), 'no user details are sent to the address service');
  });

  await t.test('shop name and social links are optional', async (tt) => {
    const profile = await prepareShopProfile({ ...liveShop(tt), shopName: '', socialLinks: [] });
    assert.equal(profile.shopName, null);
    assert.deepEqual(profile.socialLinks, []);
    assert.equal(profile.address, null, 'address lookup off: coordinates are still saved');
  });

  await t.test('a live photo is required, and only a file this server stored', async (tt) => {
    const shop = liveShop(tt);
    for (const shopPhotoUrl of ['', 'https://evil.example/shop.jpg', '/uploads/../../.env', '/uploads/missing-file.jpg', '/uploads/report.pdf']) {
      await assert.rejects(prepareShopProfile({ ...shop, shopPhotoUrl }), (e) => e.errorCode === 'SHOP_PHOTO_REQUIRED' && e.statusCode === 400, shopPhotoUrl);
    }
    assert.equal(resolveShopPhotoPath(`https://backend.example${shop.shopPhotoUrl}`), shop.shopPhotoUrl, 'the full URL returned by the upload is accepted');
  });

  await t.test('location must be present and valid', async (tt) => {
    const shop = liveShop(tt);
    for (const [shopLatitude, shopLongitude] of [[null, null], [91, 77], [28, 181], [0, 0], ['abc', 77]]) {
      await assert.rejects(prepareShopProfile({ ...shop, shopLatitude, shopLongitude }), (e) => e.errorCode === 'SHOP_LOCATION_INVALID');
    }
  });

  await t.test('the photo must be recent (taken during this signup), never in the future', async (tt) => {
    const shop = liveShop(tt);
    await assert.rejects(prepareShopProfile({ ...shop, shopCapturedAt: new Date(Date.now() - 31 * 60_000).toISOString() }), (e) => e.errorCode === 'SHOP_PHOTO_EXPIRED');
    await assert.rejects(prepareShopProfile({ ...shop, shopCapturedAt: new Date(Date.now() + 10 * 60_000).toISOString() }), (e) => e.errorCode === 'SHOP_PHOTO_EXPIRED');
    await assert.rejects(prepareShopProfile({ ...shop, shopCapturedAt: 'yesterday' }), (e) => e.errorCode === 'SHOP_PHOTO_EXPIRED');
  });

  await t.test('invalid or too many social links are refused', () => {
    assert.throws(() => normalizeSocialLinks(['javascript:alert(1)']), (e) => e.errorCode === 'INVALID_SOCIAL_LINKS');
    assert.throws(() => normalizeSocialLinks(['not a link']), (e) => e.errorCode === 'INVALID_SOCIAL_LINKS');
    assert.throws(() => normalizeSocialLinks(Array.from({ length: 11 }, (_, i) => `https://site${i}.com`)), (e) => e.errorCode === 'INVALID_SOCIAL_LINKS');
    assert.equal(socialPlatform('www.facebook.com'), 'Facebook');
    assert.equal(socialPlatform('m.youtube.com'), 'YouTube');
    assert.equal(socialPlatform('myshop.in'), 'Website');
  });

  await t.test('an address service outage never blocks signup', async () => {
    process.env.REVERSE_GEOCODE_URL = 'https://geocoder.test/reverse';
    assert.equal(await reverseGeocode(28.6, 77.2, { request: async () => { throw Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }); } }), null);
    assert.equal(await reverseGeocode(28.6, 77.2, { request: async () => ({ status: 429, data: {} }) }), null);
  });
});
