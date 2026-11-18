import prisma from '../config/db.js';
import {
  buildDisplaySpecifications, resolveAttributeSchema, taxonomyCategory, validateSpecificationValues,
} from '../data/categoryAttributes.js';

/**
 * Category / subcategory / product-type checks and dynamic specification handling for supplier products.
 *
 * Storage (no schema change): `Product.specifications` stays the flat "Label -> display value" map every
 * existing screen reads, plus one reserved entry `__spec` = { version, subcategory, productType, values }
 * holding the validated values by stable attribute key. API responses expose `__spec` as `specData`.
 */

const SPEC_KEY = '__spec';

function badRequest(message, errors) {
  const error = new Error(message);
  error.statusCode = 400;
  if (errors) error.errors = errors;
  return error;
}

const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/** The category record for a slug, or a 400 error (never silently another category). */
export async function requireCategory(categorySlug) {
  const slug = String(categorySlug || '').trim();
  const category = slug ? await prisma.category.findUnique({ where: { slug } }) : null;
  if (!category) throw badRequest('Choose a valid category.', [{ field: 'categorySlug', message: 'This category does not exist.' }]);
  return category;
}

/** Checks the subcategory belongs to the category, and the product type to the subcategory. */
export function assertHierarchy(category, subcategory, productType) {
  const names = Array.isArray(category.subcategories) ? category.subcategories : [];
  if (subcategory && names.length && !names.some((n) => sameText(n, subcategory))) {
    throw badRequest('Choose a subcategory of the selected category.', [{ field: 'subcategory', message: `"${subcategory}" is not a subcategory of ${category.name}.` }]);
  }
  if (productType) {
    const taxonomySub = taxonomyCategory(category.slug)?.subcategories.find((s) => sameText(s.name, subcategory));
    const types = taxonomySub?.productTypes?.map((t) => t.name) || [];
    if (!types.some((t) => sameText(t, productType))) {
      throw badRequest('Choose a product type of the selected subcategory.', [{ field: 'productType', message: `"${productType}" is not a product type of ${subcategory || 'this subcategory'}.` }]);
    }
  }
}

/** Free-form "Label: value" specifications (the existing text field), cleaned: strings only, bounded sizes. */
function cleanCustomSpecifications(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out = {};
  for (const [label, value] of Object.entries(input).slice(0, 50)) {
    const key = String(label).trim();
    if (!key || key.startsWith('__') || key.length > 60) continue;
    if (Array.isArray(value)) { out[key] = value.map(String).join(', ').slice(0, 300); continue; }
    if (value === null || value === undefined || typeof value === 'object') continue;
    const text = String(value).trim();
    if (text) out[key] = text.slice(0, 300);
  }
  return out;
}

/**
 * The `specifications` value to store. When the request carries dynamic values (`specValues`) or a
 * `productType`, they are validated against the category schema (400 with field errors when invalid).
 * Otherwise the free-form map is stored as before (old clients keep working), with any `__spec` removed.
 */
export function buildProductSpecifications({ category, subcategory, productType, specValues, customSpecifications }) {
  const custom = cleanCustomSpecifications(customSpecifications);
  if (specValues === undefined && !productType) return custom;

  const override = category.attributes && typeof category.attributes === 'object' ? category.attributes.specSchema : null;
  const schema = resolveAttributeSchema(category.slug, subcategory || null, productType || null, override);
  const { values, errors } = validateSpecificationValues(schema, specValues || {});
  const keys = Object.keys(errors);
  if (keys.length) {
    throw badRequest(`Please correct the product specifications (${keys.length} field${keys.length === 1 ? '' : 's'}).`,
      keys.map((key) => ({ field: `specValues.${key}`, message: errors[key] })));
  }
  const display = buildDisplaySpecifications(schema, values);
  // Structured values win over a free-form line with the same label
  for (const label of Object.keys(display)) delete custom[label];
  return {
    ...custom,
    ...display,
    [SPEC_KEY]: { version: schema.version, subcategory: schema.subcategory, productType: schema.productType, values },
  };
}

/** API view of stored specifications: the display map without `__spec`, plus `specData` (or null). */
export function splitSpecifications(stored) {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return { specifications: stored || {}, specData: null };
  const { [SPEC_KEY]: specData, ...specifications } = stored;
  return { specifications, specData: specData || null };
}
