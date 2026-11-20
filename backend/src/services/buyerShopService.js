import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { uploadDir } from '../middleware/uploadMiddleware.js';

/*
 * Buyer shop verification (signup Step 4): a live camera photo of the shop, the live GPS position taken at that
 * moment, an optional shop name and social media links. The address is resolved here from the coordinates; an
 * address sent by the browser is never stored.
 *
 * Reverse geocoding uses OpenStreetMap Nominatim by default (REVERSE_GEOCODE_URL to change it, "off" to disable).
 * Only the coordinates are sent, never who the user is.
 */

const PHOTO_PATH = /^\/uploads\/([A-Za-z0-9._-]+\.(?:jpe?g|png|webp))$/i;
const MAX_CAPTURE_AGE_MS = 30 * 60 * 1000; // the photo and location must be from this signup session
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_SOCIAL_LINKS = 10;
const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const geocodeCache = new Map();

const SOCIAL_PLATFORMS = [
  ['instagram.com', 'Instagram'], ['facebook.com', 'Facebook'], ['fb.com', 'Facebook'], ['youtube.com', 'YouTube'],
  ['youtu.be', 'YouTube'], ['linkedin.com', 'LinkedIn'], ['x.com', 'X'], ['twitter.com', 'X'], ['wa.me', 'WhatsApp'],
  ['whatsapp.com', 'WhatsApp'], ['t.me', 'Telegram'], ['pinterest.com', 'Pinterest'], ['indiamart.com', 'IndiaMART'],
  ['justdial.com', 'Justdial'], ['google.com', 'Google'], ['g.page', 'Google'],
];

function shopError(message, code, field) {
  const error = new Error(message);
  error.statusCode = 400;
  error.errorCode = code;
  error.code = code;
  if (field) error.field = field;
  return error;
}

/** Name of the platform a social link belongs to ("Website" for anything else). */
export function socialPlatform(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^www\./, '');
  const match = SOCIAL_PLATFORMS.find(([domain]) => host === domain || host.endsWith(`.${domain}`));
  return match ? match[1] : 'Website';
}

/** Cleans the social links: http(s) only, at most 10, no duplicates. Throws 400 on an invalid link. */
export function normalizeSocialLinks(links) {
  if (links == null || links === '') return [];
  if (!Array.isArray(links)) throw shopError('Social media links must be a list.', 'INVALID_SOCIAL_LINKS', 'socialLinks');
  const seen = new Set();
  const result = [];
  for (const raw of links) {
    const text = String((raw && typeof raw === 'object' ? raw.url : raw) || '').trim();
    if (!text) continue;
    let url;
    try {
      url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    } catch {
      throw shopError(`"${text.slice(0, 60)}" is not a valid link.`, 'INVALID_SOCIAL_LINKS', 'socialLinks');
    }
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.') || url.href.length > 500) {
      throw shopError(`"${text.slice(0, 60)}" is not a valid link.`, 'INVALID_SOCIAL_LINKS', 'socialLinks');
    }
    const key = url.href.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ platform: socialPlatform(url.hostname), url: url.href });
  }
  if (result.length > MAX_SOCIAL_LINKS) throw shopError(`Add at most ${MAX_SOCIAL_LINKS} social media links.`, 'INVALID_SOCIAL_LINKS', 'socialLinks');
  return result;
}

/** Valid WGS84 coordinates as numbers, or a 400 error. */
export function parseCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180 || (lat === 0 && lng === 0)) {
    throw shopError('The live shop location is missing or invalid. Please take the shop photo again with location turned on.', 'SHOP_LOCATION_INVALID', 'shopLocation');
  }
  return { lat, lng };
}

/** Short one-line address from the provider's structured address. */
function formatAddress(details, fallback) {
  if (!details || typeof details !== 'object') return fallback || null;
  const parts = [
    details.shop || details.amenity || details.building || details.house_name,
    [details.house_number, details.road].filter(Boolean).join(' '),
    details.neighbourhood || details.quarter,
    details.suburb || details.village || details.hamlet,
    details.city || details.town || details.municipality || details.county,
    details.state_district && details.state_district !== (details.city || details.town) ? details.state_district : null,
    details.state,
    details.postcode,
  ].map((p) => (p ? String(p).trim() : '')).filter(Boolean);
  const unique = parts.filter((p, i) => parts.indexOf(p) === i);
  return unique.length ? unique.join(', ') : fallback || null;
}

/**
 * Address for a position, or null when the service is off or cannot answer (the coordinates are still saved).
 * `request` can be replaced in tests.
 */
export async function reverseGeocode(latitude, longitude, { request = axios.get } = {}) {
  const { lat, lng } = parseCoordinates(latitude, longitude);
  const endpoint = String(process.env.REVERSE_GEOCODE_URL ?? 'https://nominatim.openstreetmap.org/reverse').trim();
  if (!endpoint || endpoint.toLowerCase() === 'off') return null;

  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = geocodeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const response = await request(endpoint, {
      params: { format: 'jsonv2', lat, lon: lng, addressdetails: 1, zoom: 18 },
      // Generic application identifier only (no user or account details are sent)
      headers: { 'User-Agent': 'TradeExpress-Marketplace/1.0 (shop location verification)', 'Accept-Language': 'en' },
      timeout: 8000,
      validateStatus: () => true,
    });
    const body = response?.data;
    if (response?.status !== 200 || !body || typeof body !== 'object' || body.error) return null;
    const value = {
      address: formatAddress(body.address, body.display_name ? String(body.display_name) : null),
      fullAddress: body.display_name ? String(body.display_name) : null,
      details: body.address && typeof body.address === 'object' ? body.address : null,
    };
    geocodeCache.set(key, { value, expiresAt: Date.now() + GEOCODE_CACHE_TTL_MS });
    return value;
  } catch (err) {
    console.warn(`[Shop location] Address lookup failed: ${err.code || err.message}`);
    return null;
  }
}

/** The uploaded live photo's /uploads/ path, or a 400 error. Accepts the full URL the upload returned. */
export function resolveShopPhotoPath(photoUrl) {
  let value = String(photoUrl || '').trim();
  if (/^https?:\/\//i.test(value)) {
    try { value = new URL(value).pathname; } catch { value = ''; }
  }
  const match = value.match(PHOTO_PATH);
  if (!match || !fs.existsSync(path.join(uploadDir, path.basename(match[1])))) {
    throw shopError('Please take a live photo of your shop to complete signup.', 'SHOP_PHOTO_REQUIRED', 'shopPhoto');
  }
  return `/uploads/${path.basename(match[1])}`;
}

/**
 * Checks the Step 4 details and returns the BuyerShopProfile fields to save (without userId).
 * The photo and position must have been captured within the last 30 minutes.
 */
export async function prepareShopProfile({
  shopName, shopPhotoUrl, shopLatitude, shopLongitude, shopLocationAccuracy, shopCapturedAt, socialLinks,
}, { request } = {}) {
  const photoUrl = resolveShopPhotoPath(shopPhotoUrl);
  const { lat, lng } = parseCoordinates(shopLatitude, shopLongitude);

  const capturedAt = new Date(shopCapturedAt);
  const age = Date.now() - capturedAt.getTime();
  if (Number.isNaN(capturedAt.getTime()) || age > MAX_CAPTURE_AGE_MS || age < -MAX_CLOCK_SKEW_MS) {
    throw shopError('Your shop photo is too old. Please take a new live photo of your shop.', 'SHOP_PHOTO_EXPIRED', 'shopPhoto');
  }

  const accuracy = Number(shopLocationAccuracy);
  const name = String(shopName || '').trim().replace(/\s+/g, ' ');
  if (name.length > 120) throw shopError('Shop name must be 120 characters or fewer.', 'SHOP_NAME_TOO_LONG', 'shopName');

  const geo = await reverseGeocode(lat, lng, request ? { request } : undefined);
  return {
    shopName: name || null,
    photoUrl,
    latitude: lat,
    longitude: lng,
    accuracyMeters: Number.isFinite(accuracy) && accuracy >= 0 ? Math.round(accuracy * 10) / 10 : null,
    address: geo?.address || null,
    addressDetails: geo ? { ...(geo.details || {}), fullAddress: geo.fullAddress } : null,
    capturedAt,
    socialLinks: normalizeSocialLinks(socialLinks),
  };
}

/** Clears the address cache (tests). */
export function clearGeocodeCache() {
  geocodeCache.clear();
}
