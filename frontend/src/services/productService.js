import seedProducts from '../data/products';
import seedCategories from '../data/categories';
import { STORAGE_KEYS } from '../utils/constants';
import { createCollection } from './localCollection';
import { apiGet, isApiConfigured } from './apiClient';
import { getPriceRange } from '../utils/calculateTotals';

const products = createCollection(STORAGE_KEYS.products, seedProducts);
const categories = createCollection(STORAGE_KEYS.categories, seedCategories);

// Optional: path on your public API that returns an array of products in the same
// shape as src/data/products.js. Unset by default, so local data is always used.
const REMOTE_PRODUCTS_PATH = (import.meta.env.VITE_PUBLIC_API_PRODUCTS_PATH ?? '').trim();

async function fetchRemoteProducts() {
  const res = await apiGet(`${REMOTE_PRODUCTS_PATH}?limit=100`);
  const items = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
  if (!Array.isArray(items) || items.length === 0 || !items.every((item) => item && item.id && item.name && item.slug)) {
    throw new Error('The public API did not return products in the expected format.');
  }
  return items;
}

const productService = {
  getInitialProducts: () => products.readInstant(),
  getInitialCategories: () => categories.readInstant(),
  /** Local catalogue, optionally extended with products from a configured public API. */
  async listProducts(options) {
    const local = await products.list(options);
    if (!isApiConfigured || !REMOTE_PRODUCTS_PATH) return local;
    try {
      const remote = await fetchRemoteProducts();
      const known = new Set(local.map((item) => item.id));
      return [...local, ...remote.filter((item) => !known.has(item.id))];
    } catch (error) {
      console.warn(`[TradeExpress] ${error.message} Showing local data instead.`);
      return local;
    }
  },
  saveProducts: (records) => products.saveAll(records),
  listCategories: (options) => categories.list(options),
  saveCategories: (records) => categories.saveAll(records),
};

export default productService;

const SORTERS = {
  relevance: (a, b) => Number(b.featured) - Number(a.featured) || b.orderCount - a.orderCount,
  'price-asc': (a, b) => getPriceRange(a).min - getPriceRange(b).min,
  'price-desc': (a, b) => getPriceRange(b).min - getPriceRange(a).min,
  newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  popular: (a, b) => b.orderCount - a.orderCount,
};

export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Popularity' },
];

/**
 * Pure search used by the catalogue. `companies` is needed for supplier filters.
 * filters: { q, category, subcategory, minPrice, maxPrice, maxMoq, countries[], businessTypes[],
 *            condition, ready, sample, inStock, deal, isNew, companyId, sort }
 */
export function filterProducts(products, companies, filters = {}) {
  const companyById = new Map(companies.map((company) => [company.id, company]));
  const q = (filters.q ?? '').trim().toLowerCase();
  const num = (value) => (value === '' || value === undefined || value === null || Number.isNaN(Number(value)) ? null : Number(value));
  const minPrice = num(filters.minPrice);
  const maxPrice = num(filters.maxPrice);
  const maxMoq = num(filters.maxMoq);

  const result = products.filter((product) => {
    if (product.status !== 'Active') return false;
    const company = companyById.get(product.companyId);
    if (company && company.status === 'Suspended') return false;
    if (q) {
      const specsString = product.specifications ? JSON.stringify(product.specifications).toLowerCase() : '';
      const haystack = `${product.name} ${product.summary || ''} ${product.description || ''} ${product.subcategory || ''} ${product.category || ''} ${company?.name ?? ''} ${specsString}`.toLowerCase();
      if (!q.split(/\s+/).every((word) => haystack.includes(word))) return false;
    }
    if (filters.category && product.category !== filters.category) return false;
    if (filters.subcategory && product.subcategory !== filters.subcategory) return false;
    if (filters.companyId && product.companyId !== filters.companyId) return false;
    const { min } = getPriceRange(product);
    if (minPrice !== null && product.price < minPrice) return false;
    if (maxPrice !== null && min > maxPrice) return false;
    if (maxMoq !== null && product.moq > maxMoq) return false;
    if (filters.countries?.length && !filters.countries.includes(company?.country)) return false;
    if (filters.businessTypes?.length && !filters.businessTypes.includes(company?.businessType)) return false;
    if (filters.condition && product.condition !== filters.condition) return false;
    if (filters.ready && !product.readyToShip) return false;
    if (filters.sample && !product.sampleAvailable) return false;
    if (filters.inStock && product.stock <= 0) return false;
    if (filters.deal && !product.deal) return false;
    if (filters.isNew && !product.isNew) return false;
    if (filters.verifiedOnly) {
      const isVer = Boolean(company?.isVerified || company?.kycStatus === 'VERIFIED' || company?.verification?.status === 'reviewed');
      if (!isVer) return false;
    }
    return true;
  });

  return result.sort(SORTERS[filters.sort] ?? SORTERS.relevance);
}
