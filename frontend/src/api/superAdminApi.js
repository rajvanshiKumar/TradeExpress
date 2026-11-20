import { getTokenForSlot, handleRejectedToken } from '../utils/authSession.js';
import { API_BASE_URL } from '../config/api.js';
const API_BASE = API_BASE_URL;

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

/** The token from the admin sign-in. There is no automatic sign-in: an expired session means signing in again. */
function ensureAdminToken() {
  return getTokenForSlot('admin');
}

function getHeaders(token) {
  const activeToken = token || ensureAdminToken();
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
  };
}

// User Directory export files: the type the server must send, and how a real file of that type begins
const startsWith = (bytes, ...codes) => codes.every((code, i) => bytes[i] === code);
const EXPORT_TYPES = {
  // Text (after the UTF-8 BOM), never an HTML page
  csv: { mime: 'text/csv', isFile: (b) => b.length > 3 && startsWith(b, 0xef, 0xbb, 0xbf) && b[3] !== 0x3c },
  // .xlsx is a ZIP file: "PK"
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', isFile: (b) => startsWith(b, 0x50, 0x4b, 0x03, 0x04) },
  // "%PDF"
  pdf: { mime: 'application/pdf', isFile: (b) => startsWith(b, 0x25, 0x50, 0x44, 0x46) },
};

async function request(endpoint, options = {}) {
  const url = `${API_BASE}/super-admin${endpoint}`;
  const token = ensureAdminToken();

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...getHeaders(token),
        ...(options.headers || {}),
      },
    });

    // Expired or invalid admin session: clear it so the next screen asks the admin to sign in again
    if (res.status === 401) {
      handleRejectedToken(token);
      const error = new Error('Your admin session has expired. Please sign in again.');
      error.status = 401;
      throw error;
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
  getUserDeletionCheck: (id) => request(`/users/${id}/deletion-check`),
  deleteUser: (id, payload) =>
    request(`/users/${id}/delete`, { method: 'POST', body: JSON.stringify(payload) }),
  verifyUser: (id) =>
    request(`/users/${id}/verify`, { method: 'POST', body: JSON.stringify({ status: 'VERIFIED' }) }),
  reviewUserKyc: (id, payload) =>
    request(`/users/${id}/kyc/review`, { method: 'POST', body: JSON.stringify(payload) }),
  /**
   * Downloads the User Directory export ('csv' | 'xlsx' | 'pdf') with the current filters.
   * Sent with the admin token (a plain link cannot carry it). Returns { rows }.
   */
  downloadUsersExport: async (format, params = {}) => {
    const expected = EXPORT_TYPES[format];
    if (!expected) throw new Error('Choose an export format: CSV, Excel or PDF.');
    const token = ensureAdminToken();
    const res = await fetch(`${API_BASE}/super-admin/users/export/${format}${buildQueryString(params)}`, {
      headers: {
        Accept: `${expected.mime}, application/json`,
        // A dev tunnel otherwise answers a browser request with its HTML warning page instead of the file
        'X-Tunnel-Skip-Anti-Phishing-Page': 'true',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (res.status === 401) {
      handleRejectedToken(token);
      const error = new Error('Your admin session has expired. Please sign in again.');
      error.status = 401;
      throw error;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const error = new Error(data.message || 'The export could not be created. Please try again.');
      error.status = res.status;
      throw error;
    }
    // Only the real file is saved: never an HTML page or JSON error under a .csv / .xlsx / .pdf name
    const bytes = new Uint8Array(await res.arrayBuffer());
    const contentType = (res.headers.get('Content-Type') || '').toLowerCase();
    if (!contentType.startsWith(expected.mime) || !expected.isFile(bytes)) {
      throw new Error('The export could not be downloaded (the server sent an unexpected reply). Please refresh the page and try again.');
    }
    const blob = new Blob([bytes], { type: expected.mime });
    const disposition = res.headers.get('Content-Disposition') || '';
    const filename = /filename="?([^";]+)"?/i.exec(disposition)?.[1] || `tradeexpress-users.${format}`;
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return { rows: Number(res.headers.get('X-Export-Rows')) || null };
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

  // Supplier account deletion requests
  getDeletionRequests: (params = {}) => request(`/deletion-requests${buildQueryString(params)}`),
  getDeletionRequest: (id) => request(`/deletion-requests/${encodeURIComponent(id)}`),
  decideDeletionRequest: (id, payload) => request(`/deletion-requests/${encodeURIComponent(id)}/decision`, { method: 'POST', body: JSON.stringify(payload) }),
  retryDeletionRequest: (id) => request(`/deletion-requests/${encodeURIComponent(id)}/retry`, { method: 'POST' }),

  // Financial Reports
  getFinancialReport: (params = {}) => {
    return request(`/reports/financial${buildQueryString(params)}`);
  },
};

export default superAdminApi;
