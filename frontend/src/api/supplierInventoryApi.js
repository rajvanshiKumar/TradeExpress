import { apiGet, apiPost, apiPatch } from '../services/apiClient';

/**
 * Supplier Inventory API client communicating with TradeExpress backend.
 */
export async function fetchSupplierInventory(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set('search', params.search);
  if (params.category) searchParams.set('category', params.category);
  if (params.stockStatus && params.stockStatus !== 'all') searchParams.set('stockStatus', params.stockStatus);
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  if (params.page) searchParams.set('page', params.page);
  if (params.limit) searchParams.set('limit', params.limit);

  const qs = searchParams.toString();
  const endpoint = qs ? `supplier/inventory?${qs}` : 'supplier/inventory';
  const res = await apiGet(endpoint);
  return res.data;
}

export async function adjustSupplierStock(productId, adjustmentPayload) {
  const res = await apiPost(`supplier/inventory/${encodeURIComponent(productId)}/adjust`, adjustmentPayload);
  return res.data;
}

export async function fetchProductInventoryHistory(productId, params = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page);
  if (params.limit) searchParams.set('limit', params.limit);

  const qs = searchParams.toString();
  const endpoint = qs
    ? `supplier/inventory/${encodeURIComponent(productId)}/history?${qs}`
    : `supplier/inventory/${encodeURIComponent(productId)}/history`;
  const res = await apiGet(endpoint);
  return res.data;
}

export async function updateSupplierInventorySettings(productId, settingsPayload) {
  const res = await apiPatch(`supplier/inventory/${encodeURIComponent(productId)}/settings`, settingsPayload);
  return res.data;
}

