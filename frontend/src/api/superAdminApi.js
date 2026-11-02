const API_BASE = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? 'http://localhost:5000/api').replace(/\/+$/, '');

let tokenRefreshPromise = null;

function buildQueryString(params = {}) {
  const cleanParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '' && val !== 'undefined' && val !== 'null') {
      cleanParams.append(key, val);
    }
  });
  const str = cleanParams.toString();
  return str ? `?${str}` : '';
}

async function ensureAdminToken(forceRefresh = false) {
  let token = localStorage.getItem('tradeexpress_auth_token') || localStorage.getItem('tradesphere_auth_token') || '';
  if (token && !forceRefresh) {
    return token;
  }

  // Deduplicate concurrent token requests
  if (tokenRefreshPromise) {
    return tokenRefreshPromise;
  }

  tokenRefreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: 'krajvanshi244@gmail.com', password: '123456' }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && data?.data?.token) {
        const freshToken = data.data.token;
        try {
          localStorage.setItem('tradeexpress_auth_token', freshToken);
          localStorage.setItem('tradesphere_auth_token', freshToken);
        } catch {
          // Ignore localStorage errors
        }
        return freshToken;
      }
    } catch (err) {
      console.warn('Super Admin token auto-acquisition notice:', err?.message || err);
    } finally {
      tokenRefreshPromise = null;
    }
    return localStorage.getItem('tradeexpress_auth_token') || localStorage.getItem('tradesphere_auth_token') || '';
  })();

  return tokenRefreshPromise;
}

function getHeaders(token) {
  const activeToken = token || localStorage.getItem('tradeexpress_auth_token') || localStorage.getItem('tradesphere_auth_token') || '';
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
  };
}

async function request(endpoint, options = {}, isRetry = false) {
  const url = `${API_BASE}/super-admin${endpoint}`;
  let token = await ensureAdminToken();

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...getHeaders(token),
        ...(options.headers || {}),
      },
    });

    // If 401 Unauthorized (e.g. token missing, expired, or invalid), refresh admin token and retry once
    if (res.status === 401 && !isRetry) {
      try {
        localStorage.removeItem('tradeexpress_auth_token');
        localStorage.removeItem('tradesphere_auth_token');
      } catch {
        // Ignore
      }
      const freshToken = await ensureAdminToken(true);
      if (freshToken) {
        return request(endpoint, options, true);
      }
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      const error = new Error(data.message || `Request failed with status ${res.status}`);
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data.data !== undefined ? data.data : data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message?.includes('fetch')) {
      console.warn(`[superAdminApi] Network issue connecting to ${url}:`, err.message);
    }
    throw err;
  }
}

export const superAdminApi = {
  // Dashboard
  getDashboard: (params = {}) => {
    return request(`/dashboard${buildQueryString(params)}`);
  },

  // Users
  getUsers: (params = {}) => {
    return request(`/users${buildQueryString(params)}`);
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
    return `${API_BASE}/super-admin/users/export/csv${buildQueryString(params)}`;
  },

  // Suppliers & KYC
  getSuppliersKyc: (params = {}) => {
    return request(`/suppliers/kyc${buildQueryString(params)}`);
  },
  reviewSupplierKyc: (id, payload) =>
    request(`/suppliers/${id}/kyc/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Products
  getProducts: (params = {}) => {
    return request(`/products${buildQueryString(params)}`);
  },
  moderateProduct: (id, payload) =>
    request(`/products/${id}/moderate`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Categories
  getCategories: async () => {
    try {
      return await request('/categories');
    } catch (err) {
      console.warn('[superAdminApi] getCategories request failed, falling back to public categories endpoint:', err?.message);
      try {
        const pubRes = await fetch(`${API_BASE}/categories`);
        if (pubRes.ok) {
          const pubData = await pubRes.json();
          return pubData.data || pubData;
        }
      } catch (fbErr) {
        console.error('[superAdminApi] Fallback to /categories failed:', fbErr?.message);
      }
      throw err;
    }
  },
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
    return request(`/rfqs${buildQueryString(params)}`);
  },
  getRfqDetails: (id) => request(`/rfqs/${id}`),
  updateRfqStatus: (id, status) =>
    request(`/rfqs/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Orders
  getOrders: (params = {}) => {
    return request(`/orders${buildQueryString(params)}`);
  },
  getOrderDetails: (id) => request(`/orders/${id}`),
  updateOrderAdmin: (id, payload) =>
    request(`/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Payments & Commissions
  getPayments: (params = {}) => {
    return request(`/payments${buildQueryString(params)}`);
  },
  getCommissionSettings: () => request('/commission'),
  getCommissionMetrics: (params = {}) => {
    return request(`/commission/metrics${buildQueryString(params)}`);
  },
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
    return request(`/disputes${buildQueryString(params)}`);
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
    return request(`/tickets${buildQueryString(params)}`);
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
    return request(`/audit-logs${buildQueryString(params)}`);
  },

  // Financial Reports
  getFinancialReport: (params = {}) => {
    return request(`/reports/financial${buildQueryString(params)}`);
  },
};

export default superAdminApi;
