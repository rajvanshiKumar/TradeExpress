import { useEffect, useState } from 'react';
import { apiGet, isApiConfigured } from '../services/apiClient';

// One request per category / subcategory / product type for the whole session
const cache = new Map();

/**
 * The specification schema (dynamic Add Product fields) for the selected category, subcategory and product type,
 * from GET /api/categories/:slug/attributes. Returns { schema, loading, error }.
 */
export default function useCategorySpecSchema(categorySlug, subcategory, productType) {
  const key = categorySlug ? `${categorySlug}|${subcategory || ''}|${productType || ''}` : '';
  const [state, setState] = useState(() => ({ schema: cache.get(key) || null, loading: false, error: '' }));

  useEffect(() => {
    if (!key || !isApiConfigured) { setState({ schema: null, loading: false, error: '' }); return undefined; }
    if (cache.has(key)) { setState({ schema: cache.get(key), loading: false, error: '' }); return undefined; }
    const controller = new AbortController();
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    const params = new URLSearchParams();
    if (subcategory) params.set('subcategory', subcategory);
    if (productType) params.set('productType', productType);
    apiGet(`categories/${encodeURIComponent(categorySlug)}/attributes${params.toString() ? `?${params}` : ''}`, { signal: controller.signal })
      .then((res) => {
        const schema = res?.data || null;
        if (schema) cache.set(key, schema);
        setState({ schema, loading: false, error: '' });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setState({ schema: null, loading: false, error: err?.message || 'Could not load the specification fields.' });
      });
    return () => controller.abort();
  }, [key, categorySlug, subcategory, productType]);

  return state;
}
