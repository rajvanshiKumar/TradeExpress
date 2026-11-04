import { apiGet, apiPatch, apiPost } from '../services/apiClient';

/**
 * Transport & Delivery Management API (/api/transport). The backend scopes every call to the signed-in role:
 * suppliers see their own fleet and shipments, buyers their own orders' shipments, Super Admin everything.
 */
const qs = (params = {}) => {
  const search = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const text = search.toString();
  return text ? `?${text}` : '';
};
const data = (res) => res?.data;
const enc = encodeURIComponent;

export const transportApi = {
  meta: () => apiGet('transport/meta').then(data),
  overview: () => apiGet('transport/overview').then(data),

  providers: () => apiGet('transport/providers').then(data),
  createProvider: (body) => apiPost('transport/providers', body).then(data),
  updateProvider: (id, body) => apiPatch(`transport/providers/${enc(id)}`, body).then(data),

  vehicles: (params) => apiGet(`transport/vehicles${qs(params)}`).then(data),
  createVehicle: (body) => apiPost('transport/vehicles', body).then(data),
  updateVehicle: (id, body) => apiPatch(`transport/vehicles/${enc(id)}`, body).then(data),
  setVehicleStatus: (id, body) => apiPost(`transport/vehicles/${enc(id)}/status`, body).then(data),
  verifyVehicle: (id, body) => apiPost(`transport/vehicles/${enc(id)}/verify`, body).then(data),
  vehicleHistory: (id) => apiGet(`transport/vehicles/${enc(id)}/history`).then(data),

  drivers: (params) => apiGet(`transport/drivers${qs(params)}`).then(data),
  createDriver: (body) => apiPost('transport/drivers', body).then(data),
  updateDriver: (id, body) => apiPatch(`transport/drivers/${enc(id)}`, body).then(data),
  verifyDriver: (id, body) => apiPost(`transport/drivers/${enc(id)}/verify`, body).then(data),

  shippableOrders: (params) => apiGet(`transport/orders/shippable${qs(params)}`).then(data),
  orderShipments: (orderId) => apiGet(`transport/orders/${enc(orderId)}/shipments`).then(data),

  shipments: (params) => apiGet(`transport/shipments${qs(params)}`).then(data),
  shipment: (id) => apiGet(`transport/shipments/${enc(id)}`).then(data),
  createShipment: (body) => apiPost('transport/shipments', body).then(data),
  /** action: assign-truck, request-transport, release-truck, change-truck, schedule-pickup, start-loading,
   *  confirm-loading, dispatch, tracking, out-for-delivery, arrived, delivery-failed, return, returned, cancel,
   *  documents, confirm-delivery, resend-delivery-code, issues */
  shipmentAction: (id, action, body = {}) => apiPost(`transport/shipments/${enc(id)}/${action}`, body).then(data),
  updateFreight: (id, body) => apiPatch(`transport/shipments/${enc(id)}/freight`, body).then(data),

  requests: (params) => apiGet(`transport/requests${qs(params)}`).then(data),
  approveRequest: (id, body) => apiPost(`transport/requests/${enc(id)}/approve`, body).then(data),
  rejectRequest: (id, body) => apiPost(`transport/requests/${enc(id)}/reject`, body).then(data),
  cancelRequest: (id) => apiPost(`transport/requests/${enc(id)}/cancel`, {}).then(data),

  issues: (params) => apiGet(`transport/issues${qs(params)}`).then(data),
  resolveIssue: (id, body) => apiPatch(`transport/issues/${enc(id)}`, body).then(data),
  reports: (params) => apiGet(`transport/reports${qs(params)}`).then(data),
  audit: (params) => apiGet(`transport/audit${qs(params)}`).then(data),
};

/** Uploads a file through the existing upload endpoint and returns its URL. */
export async function uploadTransportFile(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await apiPost('upload', form);
  return res?.data?.url || res?.url;
}
