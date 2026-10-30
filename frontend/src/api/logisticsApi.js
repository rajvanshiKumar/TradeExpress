import { apiGet, apiPost, apiPatch, apiPut } from '../services/apiClient';

/**
 * Frontend API client for Transportation & Logistics Management System
 */

// --- Overview & Metrics ---
export async function getLogisticsMetrics() {
  const res = await apiGet('logistics/metrics');
  return res?.data || res;
}

// --- Transport Companies & Partners ---
export async function getTransportCompanies(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await apiGet(`logistics/companies${query ? `?${query}` : ''}`);
  return res?.data || res || [];
}

export async function getTransportCompanyById(id) {
  const res = await apiGet(`logistics/companies/${id}`);
  return res?.data || res;
}

export async function createTransportCompany(data) {
  const res = await apiPost('logistics/companies', data);
  return res?.data || res;
}

export async function verifyTransportCompany(id, { verificationStatus, rejectionReason }) {
  const res = await apiPatch(`logistics/companies/${id}/verify`, { verificationStatus, rejectionReason });
  return res?.data || res;
}

// --- Vehicles ---
export async function getVehicles(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await apiGet(`logistics/vehicles${query ? `?${query}` : ''}`);
  return res?.data || res || [];
}

export async function addVehicle(data) {
  const res = await apiPost('logistics/vehicles', data);
  return res?.data || res;
}

export async function verifyVehicle(id, { isVerified, verificationNotes }) {
  const res = await apiPatch(`logistics/vehicles/${id}/verify`, { isVerified, verificationNotes });
  return res?.data || res;
}

// --- Drivers ---
export async function getDrivers(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await apiGet(`logistics/drivers${query ? `?${query}` : ''}`);
  return res?.data || res || [];
}


export async function addDriver(data) {
  const res = await apiPost('logistics/drivers', data);
  return res?.data || res;
}

export async function verifyDriver(id, { isVerified, verificationNotes }) {
  const res = await apiPatch(`logistics/drivers/${id}/verify`, { isVerified, verificationNotes });
  return res?.data || res;
}

// --- Transport Requests (TradeExpress-Managed) ---
export async function getTransportRequests(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await apiGet(`logistics/requests${query ? `?${query}` : ''}`);
  return res?.data || res || [];
}

export async function getOpenTransportRequests() {
  const res = await apiGet('logistics/requests/open');
  return res?.data || res || [];
}

export async function createTransportRequest(data) {
  const res = await apiPost('logistics/requests', data);
  return res?.data || res;
}

// --- Freight Quotes ---
export async function submitFreightQuote(requestId, quoteData) {
  const res = await apiPost(`logistics/requests/${requestId}/quotes`, quoteData);
  return res?.data || res;
}

export async function acceptFreightQuote(quoteId) {
  const res = await apiPost(`logistics/quotes/${quoteId}/accept`, {});
  return res?.data || res;
}

// --- Shipments ---
export async function getShipments(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await apiGet(`logistics/shipments${query ? `?${query}` : ''}`);
  return res || { shipments: [], total: 0, totalPages: 1 };
}

export async function getShipmentById(id) {
  const res = await apiGet(`logistics/shipments/${id}`);
  return res?.data || res;
}

export async function trackShipmentPublic(trackingNumber) {
  const res = await apiGet(`logistics/shipments/track/${trackingNumber}`);
  return res?.data || res;
}

export async function createSupplierShipment(data) {
  const res = await apiPost('logistics/shipments/supplier-managed', data);
  return res?.data || res;
}

export async function updateShipmentStatus(id, { newStatus, notes, location, latitude, longitude }) {
  const res = await apiPatch(`logistics/shipments/${id}/status`, { newStatus, notes, location, latitude, longitude });
  return res?.data || res;
}

export async function verifyShipment(id, { isApproved, action, reason }) {
  const res = await apiPatch(`logistics/shipments/${id}/verify`, { isApproved, action, reason });
  return res?.data || res;
}

export async function assignVehicleAndDriver(id, { vehicleId, driverId }) {
  const res = await apiPost(`logistics/shipments/${id}/assign`, { vehicleId, driverId });
  return res?.data || res;
}

// --- Documents ---
export async function uploadShipmentDocument(id, docData) {
  const res = await apiPost(`logistics/shipments/${id}/documents`, docData);
  return res?.data || res;
}

export async function verifyShipmentDocument(docId, { isVerified }) {
  const res = await apiPatch(`logistics/documents/${docId}/verify`, { isVerified });
  return res?.data || res;
}

// --- Proof of Delivery & OTP ---
export async function recordDeliveryProof(id, data) {
  const res = await apiPost(`logistics/shipments/${id}/delivery-proof`, data);
  return res?.data || res;
}

// --- Disputes ---
export async function raiseDeliveryDispute(id, { reason, description, photoProofUrl }) {
  const res = await apiPost(`logistics/shipments/${id}/dispute`, { reason, description, photoProofUrl });
  return res?.data || res;
}

export async function resolveDeliveryDispute(id, { resolution, refundAmount, closeStatus }) {
  const res = await apiPatch(`logistics/shipments/${id}/resolve-dispute`, { resolution, refundAmount, closeStatus });
  return res?.data || res;
}

// --- GPS Telemetry ---
export async function sendGpsTelemetry(id, telemetryData) {
  const res = await apiPost(`logistics/shipments/${id}/telemetry`, telemetryData);
  return res?.data || res;
}

export async function getShipmentTelemetry(id) {
  const res = await apiGet(`logistics/shipments/${id}/telemetry`);
  return res?.data || res || [];
}

// --- Freight Payments & Escrow ---
export async function getFreightPayments(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await apiGet(`logistics/freight-payments${query ? `?${query}` : ''}`);
  return res?.data || res || [];
}

export async function releaseFreightPayment(id, reason) {
  const res = await apiPost(`logistics/freight-payments/${id}/release`, { reason });
  return res?.data || res;
}
