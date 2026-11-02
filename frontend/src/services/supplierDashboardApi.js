import apiClient from './apiClient';

export async function fetchSupplierOverview() {
  const res = await apiClient.get('/supplier/dashboard');
  return res?.data || res;
}

export async function fetchSupplierQuotations(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  const qStr = query.toString() ? `?${query.toString()}` : '';

  const res = await apiClient.get(`/supplier/quotations${qStr}`);
  return res?.data || res;
}

export async function submitSupplierQuotation(quotationPayload) {
  const res = await apiClient.post('/supplier/quotations', quotationPayload);
  return res?.data || res;
}

export async function fetchSupplierPayments(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', params.page);
  const qStr = query.toString() ? `?${query.toString()}` : '';

  const res = await apiClient.get(`/supplier/payments${qStr}`);
  return res?.data || res;
}

export async function fetchSupplierShipping() {
  const res = await apiClient.get('/supplier/shipping');
  return res?.data || res;
}

export async function submitOrderDispatch(orderId, dispatchPayload) {
  const res = await apiClient.post(`/supplier/shipping/${orderId}/dispatch`, dispatchPayload);
  return res?.data || res;
}

export async function fetchSupplierAnalytics() {
  const res = await apiClient.get('/supplier/analytics');
  return res?.data || res;
}

export async function fetchSupplierProfile() {
  const res = await apiClient.get('/supplier/profile');
  return res?.data || res;
}

export async function updateSupplierProfile(profilePayload) {
  const res = await apiClient.put('/supplier/profile', profilePayload);
  return res?.data || res;
}

export async function fetchSupplierInquiries(params = {}) {
  const query = new URLSearchParams({ scope: 'supplier' });
  if (params.status) query.set('status', params.status);
  if (params.category) query.set('category', params.category);
  if (params.search) query.set('search', params.search);
  const qStr = `?${query.toString()}`;

  const res = await apiClient.get(`/rfq${qStr}`);
  return res?.data || res;
}
