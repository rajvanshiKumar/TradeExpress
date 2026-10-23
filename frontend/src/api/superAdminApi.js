const API_BASE = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? 'http://localhost:5000/api').replace(/\/+$/, '');

function getHeaders() {
  const token = localStorage.getItem('tradeexpress_auth_token') || localStorage.getItem('tradesphere_auth_token') || '';
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}/super-admin${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const error = new Error(data.message || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data.data !== undefined ? data.data : data;
}

export const superAdminApi = {
  // Dashboard
  getDashboard: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/dashboard${q ? `?${q}` : ''}`);
  },

  // Users
  getUsers: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/users${q ? `?${q}` : ''}`);
  },
  getUserDetails: (id) => request(`/users/${id}`),
  updateUserStatus: (id, payload) =>
    request(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  resetUserPassword: (id, newPassword) =>
    request(`/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),
  getExportUsersCsvUrl: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return `${API_BASE}/super-admin/users/export/csv${q ? `?${q}` : ''}`;
  },

  // Suppliers & KYC
  getSuppliersKyc: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/suppliers/kyc${q ? `?${q}` : ''}`);
  },
  reviewSupplierKyc: (id, payload) =>
    request(`/suppliers/${id}/kyc/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Products
  getProducts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/products${q ? `?${q}` : ''}`);
  },
  moderateProduct: (id, payload) =>
    request(`/products/${id}/moderate`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Categories
  getCategories: () => request('/categories'),
  createCategory: (payload) =>
    request('/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCategory: (id, payload) =>
    request(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteCategory: (id) =>
    request(`/categories/${id}`, {
      method: 'DELETE',
    }),

  // RFQs & Quotes
  getRfqs: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/rfqs${q ? `?${q}` : ''}`);
  },
  getRfqDetails: (id) => request(`/rfqs/${id}`),
  updateRfqStatus: (id, status) =>
    request(`/rfqs/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Orders
  getOrders: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/orders${q ? `?${q}` : ''}`);
  },
  getOrderDetails: (id) => request(`/orders/${id}`),
  updateOrderAdmin: (id, payload) =>
    request(`/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Payments & Commissions
  getPayments: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/payments${q ? `?${q}` : ''}`);
  },
  getCommissionSettings: () => request('/commission'),
  updateCommissionSetting: (payload) =>
    request('/commission', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  processRefund: (orderId, payload) =>
    request(`/refunds/${orderId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Disputes & Support
  getDisputes: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/disputes${q ? `?${q}` : ''}`);
  },
  getDisputeDetails: (id) => request(`/disputes/${id}`),
  addDisputeMessage: (id, payload) =>
    request(`/disputes/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  resolveDispute: (id, payload) =>
    request(`/disputes/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Support Tickets
  getSupportTickets: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/tickets${q ? `?${q}` : ''}`);
  },
  getSupportTicketDetails: (id) => request(`/tickets/${id}`),
  replySupportTicket: (id, payload) =>
    request(`/tickets/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Sub-Admins
  getAdminUsers: () => request('/admins'),
  createSubAdmin: (payload) =>
    request('/admins', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateSubAdmin: (id, payload) =>
    request(`/admins/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteSubAdmin: (id) =>
    request(`/admins/${id}`, {
      method: 'DELETE',
    }),

  // Settings & Integrations
  getPlatformSettings: () => request('/settings'),
  updatePlatformSetting: (payload) =>
    request('/settings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getSystemIntegrations: () => request('/integrations'),

  // Audit Logs
  getAuditLogs: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/audit-logs${q ? `?${q}` : ''}`);
  },

  // Financial Reports
  getFinancialReport: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/reports/financial${q ? `?${q}` : ''}`);
  },
};

export default superAdminApi;
