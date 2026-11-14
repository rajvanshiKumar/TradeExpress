/**
 * Pure filter helpers for the buyer Product & Seller Comparison page.
 * Kept free of React so the filtering rules can be unit tested.
 */

const toList = (val) => (Array.isArray(val) ? val : [val]);

const collectFrom = (target, source, keyPattern) => {
  for (const [key, val] of Object.entries(source || {})) {
    if (keyPattern.test(key)) {
      toList(val).forEach((item) => item && target.add(String(item).trim()));
    }
  }
};

export const extractProductColors = (product) => {
  if (!product) return [];
  const colors = new Set();
  collectFrom(colors, product.variants, /colou?r|shade|wash|fabric|leather/i);
  collectFrom(colors, product.specifications, /colou?r/i);
  if (Array.isArray(product.colors)) {
    product.colors.forEach((c) => c && colors.add(String(c).trim()));
  } else if (typeof product.color === 'string') {
    product.color.split(',').forEach((c) => c && colors.add(c.trim()));
  }
  return Array.from(colors);
};

export const extractProductSizes = (product) => {
  if (!product) return [];
  const sizes = new Set();
  collectFrom(sizes, product.variants, /size|capacity|volume|fit|length|height|dimension/i);
  collectFrom(sizes, product.specifications, /size|capacity|volume|dimension/i);
  if (Array.isArray(product.sizes)) {
    product.sizes.forEach((s) => s && sizes.add(String(s).trim()));
  } else if (typeof product.size === 'string') {
    product.size.split(',').forEach((s) => s && sizes.add(s.trim()));
  }
  return Array.from(sizes);
};

/**
 * Existing comparison matching rule: a product value matches a selected value when either
 * contains the other (case-insensitive), so "Blue" also matches "Navy Blue".
 */
export const valueMatches = (productValue, selectedValue) => {
  const a = String(productValue).toLowerCase();
  const b = String(selectedValue).toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
};

/** Selected colors matched by the product's colors (OR within the group, partial match). */
export const matchingValues = (productValues, selectedValues) =>
  selectedValues.filter((sel) => productValues.some((val) => valueMatches(val, sel)));

const normalizeSize = (value) => String(value).trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Selected sizes matched by the product's sizes. Sizes match exactly (case-insensitive):
 * partial matching would make "S" also match "XS", "XXS" and "On request".
 */
export const matchingSizes = (productValues, selectedValues) =>
  selectedValues.filter((sel) => productValues.some((val) => normalizeSize(val) === normalizeSize(sel)));

const APPAREL_SIZE_ORDER = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', '2xl', '3xl', '4xl', '5xl'];

const sizeRank = (name) => {
  const key = String(name).trim().toLowerCase();
  if (/on\s*request/.test(key)) return { group: 2, index: 0 };
  const idx = APPAREL_SIZE_ORDER.indexOf(key);
  return idx >= 0 ? { group: 0, index: idx } : { group: 1, index: 0 };
};

/** Apparel sizes in ladder order, then other sizes/capacities naturally, "On request" last. */
export const compareSizes = (a, b) => {
  const ra = sizeRank(a);
  const rb = sizeRank(b);
  if (ra.group !== rb.group) return ra.group - rb.group;
  if (ra.index !== rb.index) return ra.index - rb.index;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
};

const countValues = (products, extract) => {
  const counts = new Map();
  products.forEach((p) => {
    extract(p).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  });
  return Array.from(counts, ([name, count]) => ({ name, count }));
};

/** Color & size options discovered from the compared sellers, with seller counts. */
export const buildFilterOptions = (products = []) => ({
  colors: countValues(products, extractProductColors)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  sizes: countValues(products, extractProductSizes)
    .sort((a, b) => compareSizes(a.name, b.name)),
});

/** True when a raw MOQ value was actually supplied (missing MOQ must not be treated as 0 or 1). */
export const hasListedMoq = (raw) => {
  if (raw === null || raw === undefined || raw === '') return false;
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^0-9.-]+/g, ''));
  return Number.isFinite(num) && num > 0;
};

export const MOQ_LIMITS = [100, 200, 500];

const UNIT_LABELS = {
  piece: 'pcs',
  pieces: 'pcs',
  pc: 'pcs',
  pcs: 'pcs',
  unit: 'units',
  units: 'units',
  pair: 'pairs',
  set: 'sets',
  box: 'boxes',
  carton: 'cartons',
  pack: 'packs',
  roll: 'rolls',
  dozen: 'dozen',
};

/** Unit shown on MOQ options: the sellers' shared unit, or "units" when they differ. */
export const moqUnitLabel = (products = []) => {
  const units = new Set(
    products.map((p) => String(p?.unit || 'piece').trim().toLowerCase()).filter(Boolean)
  );
  if (units.size !== 1) return 'units';
  const [unit] = units;
  return UNIT_LABELS[unit] || unit;
};

export const withinMoqLimit = (product, maxMoq) =>
  product?.moqListed !== false && Number.isFinite(Number(product?.moq)) && Number(product.moq) <= maxMoq;

export const EMPTY_COMPARISON_FILTERS = Object.freeze({
  colors: [],
  sizes: [],
  maxMoq: null,
  verifiedOnly: false,
  sampleOnly: false,
  readyToShip: false,
});

/** Number of individual active selections across all filter groups. */
export const countActiveFilters = (filters) =>
  filters.colors.length +
  filters.sizes.length +
  (filters.maxMoq !== null ? 1 : 0) +
  (filters.verifiedOnly ? 1 : 0) +
  (filters.sampleOnly ? 1 : 0) +
  (filters.readyToShip ? 1 : 0);

/**
 * Applies every filter group together (AND between groups, OR within a multi-select group).
 * Sample availability keeps the page's existing rule (only an explicit `false` is excluded),
 * matching how each seller card labels its sample policy.
 */
export const applyComparisonFilters = (products = [], filters = EMPTY_COMPARISON_FILTERS) =>
  products.filter((p) => {
    if (filters.colors.length && !matchingValues(extractProductColors(p), filters.colors).length) return false;
    if (filters.sizes.length && !matchingSizes(extractProductSizes(p), filters.sizes).length) return false;
    if (filters.maxMoq !== null && !withinMoqLimit(p, filters.maxMoq)) return false;
    if (filters.verifiedOnly && !p.supplier?.isVerified) return false;
    if (filters.sampleOnly && p.sampleAvailable === false) return false;
    if (filters.readyToShip && !p.readyToShip) return false;
    return true;
  });
