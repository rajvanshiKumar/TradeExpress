import { useEffect, useRef, useState } from 'react';

const BASE_URL = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').trim().replace(/\/+$/, '') || '/api';
export const SUGGESTION_DEBOUNCE_MS = 300;
const CACHE_TTL_MS = 60 * 1000;

// Answers are shared between search boxes and reused for a minute, so a query is never fetched twice
const cache = new Map();

/**
 * Live product/category suggestions for `query` (1+ characters), fetched from /api/products/suggest
 * 300 ms after typing stops. Earlier in-flight requests are cancelled; repeated queries come from cache.
 * Returns { status: 'idle' | 'loading' | 'ready' | 'error', products, categories, query }.
 */
export default function useSearchSuggestions(query, { enabled = true } = {}) {
  const text = String(query || '').trim();
  const key = text.toLowerCase();
  const [state, setState] = useState({ status: 'idle', products: [], categories: [], query: '' });
  const controllerRef = useRef(null);

  useEffect(() => {
    controllerRef.current?.abort();
    if (!enabled || !key) {
      setState({ status: 'idle', products: [], categories: [], query: '' });
      return undefined;
    }

    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      setState({ status: 'ready', ...cached.data, query: text });
      return undefined;
    }

    setState((previous) => ({ ...previous, status: 'loading' }));
    const timer = setTimeout(async () => {
      const controller = new AbortController();
      controllerRef.current = controller;
      try {
        const response = await fetch(`${BASE_URL}/products/suggest?q=${encodeURIComponent(text)}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.success) throw new Error('Suggestions are unavailable.');
        const data = { products: body.data.products || [], categories: body.data.categories || [] };
        cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
        setState({ status: 'ready', ...data, query: text });
      } catch (error) {
        if (error.name !== 'AbortError') setState({ status: 'error', products: [], categories: [], query: text });
      }
    }, SUGGESTION_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [key, text, enabled]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return state;
}
