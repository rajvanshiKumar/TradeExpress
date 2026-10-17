import { createContext, useCallback, useMemo } from 'react';
import useCollection from '../hooks/useCollection';
import useLocalStorage from '../hooks/useLocalStorage';
import productService from '../services/productService';
import supplierService from '../services/supplierService';
import { buildPriceTiers } from '../data/products';
import { MAX_RECENTLY_VIEWED, STORAGE_KEYS } from '../utils/constants';
import { slugify } from '../utils/validators';
import makeId from '../utils/ids';

// The shared catalogue: products, companies and categories. Supplier and admin screens
// change this state, so every catalogue page updates immediately.
export const ProductContext = createContext(null);

const uniqueSlug = (name, taken) => {
  const base = slugify(name) || 'item';
  let slug = base;
  let counter = 2;
  while (taken.has(slug)) slug = `${base}-${counter++}`;
  return slug;
};

export function ProductProvider({ children }) {
  const productState = useCollection(productService.listProducts, productService.saveProducts, productService.getInitialProducts);
  const companyState = useCollection(supplierService.listCompanies, supplierService.saveCompanies, supplierService.getInitialCompanies);
  const categoryState = useCollection(productService.listCategories, productService.saveCategories, productService.getInitialCategories);
  const [recentlyViewed, setRecentlyViewed] = useLocalStorage(STORAGE_KEYS.recentlyViewed, []);

  const products = productState.items;
  const companies = companyState.items;
  const categories = categoryState.items;
  const setProducts = productState.setItems;
  const setCompanies = companyState.setItems;
  const setCategories = categoryState.setItems;

  const getProduct = useCallback((idOrSlug) => products.find((item) => item.id === idOrSlug || item.slug === idOrSlug) ?? null, [products]);
  const getCompany = useCallback((idOrSlug) => companies.find((item) => item.id === idOrSlug || item.slug === idOrSlug) ?? null, [companies]);
  const getCategory = useCallback((slug) => categories.find((item) => item.slug === slug || item.id === slug) ?? null, [categories]);

  /* ---------- products ---------- */
  const addProduct = useCallback((data) => {
    const record = {
      id: makeId('TS-P'), sku: makeId('TS-SKU'), currency: 'INR', condition: 'New', variants: {}, rating: 0, reviewCount: 0, orderCount: 0,
      featured: false, trending: false, deal: false, isNew: true, status: 'Active', photo: null, createdAt: new Date().toISOString(),
      ...data,
      slug: uniqueSlug(data.name, new Set(products.map((item) => item.slug))),
      priceTiers: data.priceTiers ?? buildPriceTiers(Number(data.price), Number(data.moq)),
    };
    setProducts((previous) => [record, ...previous]);
    return record;
  }, [products, setProducts]);

  const updateProduct = useCallback((id, patch) => {
    setProducts((previous) => previous.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, ...patch };
      // Rebuild quantity tiers when the base price or MOQ changes.
      if (!patch.priceTiers && (patch.price !== undefined || patch.moq !== undefined)) next.priceTiers = buildPriceTiers(Number(next.price), Number(next.moq));
      return next;
    }));
  }, [setProducts]);

  const deleteProduct = useCallback((id) => setProducts((previous) => previous.filter((item) => item.id !== id)), [setProducts]);

  /* ---------- companies ---------- */
  const addCompany = useCallback((data) => {
    const name = data.name.trim();
    const record = {
      id: makeId('TS-CO'), status: 'Active', flag: '', initials: name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase(),
      industry: 'General Trade', businessType: 'Trading Company', established: new Date().getFullYear(), employees: '1–10', color: '#123F25',
      responseTime: 'Within 24 hours', rating: 0, reviewCount: 0, description: `${name} is a supplier on TradeSphere.`, mainProducts: [],
      moqInfo: 'Contact the supplier for minimum order details.', contact: { person: '', email: '', phone: '', address: '' }, cover: null,
      coverIllustration: 'cover-default', gallery: [], certificates: [], reviews: [],
      verification: { status: 'not-submitted', submittedAt: null, reviewedAt: null, note: '', documents: [] },
      ...data, name, slug: uniqueSlug(name, new Set(companies.map((item) => item.slug))),
    };
    setCompanies((previous) => [...previous, record]);
    return record;
  }, [companies, setCompanies]);

  const updateCompany = useCallback((id, patch) => {
    setCompanies((previous) => previous.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, [setCompanies]);

  /* ---------- supplier verification (prototype workflow) ---------- */
  const submitVerification = useCallback((companyId, documents) => {
    const now = new Date().toISOString();
    setCompanies((previous) => previous.map((item) => (item.id === companyId
      ? { ...item, verification: { status: 'under-review', submittedAt: now, reviewedAt: null, note: '', documents: documents.map((doc) => ({ ...doc, submittedAt: doc.submittedAt ?? now })) } }
      : item)));
  }, [setCompanies]);

  const reviewVerification = useCallback((companyId, decision, note = '') => {
    setCompanies((previous) => previous.map((item) => (item.id === companyId
      ? { ...item, verification: { ...(item.verification ?? { documents: [] }), status: decision === 'approve' ? 'reviewed' : 'rejected', reviewedAt: new Date().toISOString(), note } }
      : item)));
  }, [setCompanies]);

  /* ---------- categories ---------- */
  const addCategory = useCallback((data) => {
    const record = {
      id: makeId('TS-CAT'), photo: null, illustration: 'product-generic', subcategories: [], description: '', ...data,
      slug: uniqueSlug(data.name, new Set(categories.map((item) => item.slug))),
    };
    setCategories((previous) => [...previous, record]);
    return record;
  }, [categories, setCategories]);

  const updateCategory = useCallback((id, patch) => {
    setCategories((previous) => previous.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, [setCategories]);

  const deleteCategory = useCallback((id) => setCategories((previous) => previous.filter((item) => item.id !== id)), [setCategories]);

  /* ---------- recently viewed ---------- */
  const trackView = useCallback((productId) => {
    setRecentlyViewed((previous) => (previous[0] === productId ? previous : [productId, ...previous.filter((id) => id !== productId)].slice(0, MAX_RECENTLY_VIEWED)));
  }, [setRecentlyViewed]);

  const reload = useCallback(() => {
    productState.reload();
    companyState.reload();
    categoryState.reload();
  }, [productState.reload, companyState.reload, categoryState.reload]);

  const loading = productState.loading || companyState.loading || categoryState.loading;
  const error = productState.error || companyState.error || categoryState.error;

  const value = useMemo(() => ({
    products, companies, categories, loading, error, reload, getProduct, getCompany, getCategory,
    addProduct, updateProduct, deleteProduct, addCompany, updateCompany, addCategory, updateCategory, deleteCategory,
    recentlyViewed, trackView, submitVerification, reviewVerification,
  }), [products, companies, categories, loading, error, reload, getProduct, getCompany, getCategory, addProduct, updateProduct, deleteProduct,
    addCompany, updateCompany, addCategory, updateCategory, deleteCategory, recentlyViewed, trackView, submitVerification, reviewVerification]);

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}
