// What a product card may show, decided from the data the product really has. Nothing here invents a value:
// a missing or invalid field comes back as null, and the card then shows a neutral message or hides that part.
// Pure functions without React, so they are unit-tested in tests/productDisplay.test.js.
import { COUNTRY_CODES, countryName } from './countryData.js';
import { slugify } from './validators.js';

/**
 * A price a buyer can rely on. Suppliers must enter a price above zero (backend rule), so zero, negative,
 * empty, null or non-numeric values are not a price and return null ("Price on request").
 * Prisma decimals can arrive as strings ("1450.00"), which are accepted.
 */
export function validPrice(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const number = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(number) && number > 0 ? number : null;
}

/** Extracts and sorts valid quantity tiers from a product. */
export function validTiersOf(product) {
  const rawTiers = Array.isArray(product?.priceTiers) ? product.priceTiers : [];
  return rawTiers
    .map((tier) => ({
      minQty: validMoq(tier?.minQty),
      maxQty: validMoq(tier?.maxQty),
      price: validPrice(tier?.price),
    }))
    .filter((tier) => tier.minQty !== null && tier.price !== null)
    .sort((a, b) => a.minQty - b.minQty);
}

/**
 * Determines whether a product qualifies for Volume Pricing.
 * Volume Pricing is applicable ONLY when:
 * 1. The product has at least two valid quantity price tiers.
 * 2. The tiers offer genuine quantity discounts (the lowest tier price is strictly lower than the highest tier price).
 * If all tiers have the same price, or only 1 tier exists, or no tiers exist: false.
 */
export function hasGenuineVolumePricing(product) {
  if (!product) return false;
  const validTiers = validTiersOf(product);
  if (validTiers.length < 2) return false;

  const prices = validTiers.map((t) => t.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  // Must offer an actual discount between tiers
  return minPrice < maxPrice;
}

/** Lowest and highest real price, from quantity tiers when volume pricing applies, otherwise the base price. */
export function priceRange(product) {
  if (hasGenuineVolumePricing(product)) {
    const validTiers = validTiersOf(product);
    const prices = validTiers.map((tier) => tier.price);
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }
  const base = validPrice(product?.price);
  if (base !== null) return { min: base, max: base };
  const firstTier = validTiersOf(product)[0];
  if (firstTier) return { min: firstTier.price, max: firstTier.price };
  return null;
}

/** A minimum order quantity: a whole number of at least 1 (backend rule), otherwise null ("MOQ not specified"). */
export function validMoq(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? number : null;
}

/** The unit the price and MOQ are counted in, or null when none was given. */
export function productUnit(product) {
  const unit = typeof product?.unit === 'string' ? product.unit.trim() : '';
  return unit || null;
}

/**
 * Availability label, only from real stock figures:
 * 'out' when the product is not live or no stock is left, 'ready' when the supplier marked it ready to ship,
 * 'in' when stock is available, and null when the listing has no stock figure at all.
 */
export function availabilityOf(product) {
  if (!product) return null;
  if (product.status && product.status !== 'Active') return 'out';
  if (product.stock === null || product.stock === undefined || product.stock === '') return null;
  const stock = Number(product.stock);
  if (!Number.isFinite(stock)) return null;
  if (stock <= 0) return 'out';
  return product.readyToShip === true ? 'ready' : 'in';
}

const CODE_BY_NAME = new Map(COUNTRY_CODES.map((code) => [countryName(code).toLowerCase(), code]));
const NAME_ALIASES = { usa: 'US', 'united states of america': 'US', uk: 'GB', 'great britain': 'GB', uae: 'AE' };

/** ISO code for a country name ("India" → "IN"), or null when the name is not a known country. */
export function countryCodeFor(name) {
  const key = typeof name === 'string' ? name.trim().toLowerCase() : '';
  if (!key) return null;
  if (key.length === 2 && COUNTRY_CODES.includes(key.toUpperCase())) return key.toUpperCase();
  return CODE_BY_NAME.get(key) || NAME_ALIASES[key] || null;
}

/**
 * Supplier details for the card, from the supplier record sent with the product, then the supplier profile.
 * Returns null when neither exists. `verified` is true only when the supplier's KYC was approved.
 */
export function supplierOf(product, company = null) {
  const supplier = product?.supplier || null;
  const name = (supplier?.company || supplier?.name || company?.name || '').trim();
  if (!name) return null;
  const country = (supplier?.country || company?.country || '').trim() || null;
  return {
    name,
    slug: company?.slug || slugify(name),
    country,
    countryCode: countryCodeFor(country),
    verified: supplier?.kycStatus === 'VERIFIED',
  };
}

/** The product's own photo (main photo, then its first uploaded image), or null when it has none. */
export function productPhoto(product) {
  const photo = typeof product?.photo === 'string' ? product.photo.trim() : '';
  if (photo) return photo;
  const images = Array.isArray(product?.images) ? product.images : [];
  const first = images.find((image) => image?.isPrimary && image?.url) || images.find((image) => image?.url);
  return first?.url || null;
}
