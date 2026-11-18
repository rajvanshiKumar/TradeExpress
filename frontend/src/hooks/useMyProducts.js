import { useCallback, useEffect, useState } from 'react';
import useAuth from './useAuth';
import { authorizedRequest } from '../services/authorizedApi';
import { isApiConfigured } from '../services/apiClient';

/*
 * The signed-in supplier's own products, from the database (GET /api/supplier/products).
 * One shared copy for the whole app: the catalogue page and the sidebar badge use the same request (no duplicates).
 * An answer that arrives after a sign-out or account switch is ignored, so another supplier's list is never shown.
 */

let store = { owner: null, items: null, error: '', promise: null };
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn({ ...store }));

/** Database product -> the shape the supplier screens use (category slug, first photo). */
export function toCatalogueProduct(p) {
  const firstImage = Array.isArray(p.images) ? (p.images.find((i) => i.isPrimary) || p.images[0]) : null;
  return {
    ...p,
    category: p.categorySlug,
    categoryName: p.category?.name || p.categorySlug,
    photo: p.photo || firstImage?.url || null,
    priceTiers: Array.isArray(p.priceTiers) ? p.priceTiers : [],
  };
}

function fetchFor(owner) {
  if (store.owner === owner && store.promise) return store.promise;
  const promise = authorizedRequest('GET', 'supplier/products')
    .then((list) => {
      if (store.owner !== owner) return; // signed out / switched meanwhile
      store = { ...store, items: (Array.isArray(list) ? list : []).map(toCatalogueProduct), error: '', promise: null };
      emit();
    })
    .catch((err) => {
      if (store.owner !== owner) return;
      store = { ...store, error: err?.message || 'Your products could not be loaded.', promise: null };
      emit();
    });
  store = { ...store, owner, promise, error: '' };
  emit();
  return promise;
}

/** Reload after a change (add, edit, hide, stock, delete) so every screen shows the saved state. */
export function refreshMyProducts() {
  if (store.owner) { store = { ...store, promise: null }; fetchFor(store.owner); }
}

export default function useMyProducts() {
  const { user } = useAuth();
  const owner = user?.role === 'supplier' && isApiConfigured ? user.id : null;
  const [state, setState] = useState(() => ({ ...store }));

  useEffect(() => {
    listeners.add(setState);
    return () => listeners.delete(setState);
  }, []);

  useEffect(() => {
    if (!owner) {
      if (store.owner) { store = { owner: null, items: null, error: '', promise: null }; emit(); }
      return;
    }
    if (store.owner !== owner) { store = { owner, items: null, error: '', promise: null }; emit(); }
    if (store.items === null && !store.promise) fetchFor(owner);
  }, [owner]);

  const reload = useCallback(() => { if (owner) { store = { ...store, promise: null }; fetchFor(owner); } }, [owner]);
  const mine = state.owner === owner;
  return {
    products: mine && state.items ? state.items : [],
    loading: Boolean(owner) && (!mine || (state.items === null && !state.error)),
    refreshing: Boolean(mine && state.promise && state.items !== null),
    error: mine ? state.error : '',
    reload,
  };
}

export const updateMyProduct = (id, data) => authorizedRequest('PUT', `supplier/products/${encodeURIComponent(id)}`, data);
export const deleteMyProduct = (id) => authorizedRequest('DELETE', `supplier/products/${encodeURIComponent(id)}`);
export const getMyProduct = (id) => authorizedRequest('GET', `supplier/products/${encodeURIComponent(id)}`).then(toCatalogueProduct);
