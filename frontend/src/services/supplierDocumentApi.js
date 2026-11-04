import { API_BASE, ApiRequestError, authorizedBlob, authorizedRequest } from './authorizedApi.js';

// Supplier: always the signed-in supplier's own documents
export const getMyDocuments = () => authorizedRequest('GET', 'supplier/documents');
export const updateMyPhoto = (photo) => authorizedRequest('PUT', 'supplier/documents/photo', { photo }, { timeoutMs: 60000 });
export const updateMyDetails = (changes) => authorizedRequest('PATCH', 'supplier/documents/details', changes);
export const myPreview = (kind) => authorizedBlob(`supplier/documents/preview/${kind}`);
export const myCertificatePdf = () => authorizedBlob('supplier/documents/certificate.pdf');
export const myIdCardPdf = () => authorizedBlob('supplier/documents/id-card.pdf');
export const myPhoto = () => authorizedBlob('supplier/documents/photo');

// Super Admin
const adminBase = 'super-admin/supplier-documents';
export const adminPreview = (userId, kind) => authorizedBlob(`${adminBase}/${encodeURIComponent(userId)}/preview/${kind}`);
export const adminCertificatePdf = (userId) => authorizedBlob(`${adminBase}/${encodeURIComponent(userId)}/certificate.pdf`);
export const adminIdCardPdf = (userId) => authorizedBlob(`${adminBase}/${encodeURIComponent(userId)}/id-card.pdf`);
export const adminPhoto = (userId) => authorizedBlob(`${adminBase}/${encodeURIComponent(userId)}/photo`);
export const adminList = ({ page = 1, limit = 12, status = 'ALL', search = '' } = {}) => {
  const params = new URLSearchParams({ page, limit, status, search });
  return authorizedRequest('GET', `${adminBase}?${params}`, undefined, { timeoutMs: 30000 });
};
export const adminGet = (userId) => authorizedRequest('GET', `${adminBase}/${encodeURIComponent(userId)}`);
export const adminRegenerate = (userId) => authorizedRequest('POST', `${adminBase}/${encodeURIComponent(userId)}/regenerate`);
export const adminUpdateValidity = (userId, changes) => authorizedRequest('PATCH', `${adminBase}/${encodeURIComponent(userId)}/validity`, changes);
export const adminReplacePhoto = (userId, photo) => authorizedRequest('PUT', `${adminBase}/${encodeURIComponent(userId)}/photo`, { photo }, { timeoutMs: 60000 });
export const adminGetSignatory = () => authorizedRequest('GET', `${adminBase}/signatory`);
export const adminUpdateSignatory = (changes) => authorizedRequest('PUT', `${adminBase}/signatory`, changes, { timeoutMs: 30000 });

// Public profile, opened by scanning a supplier's QR code
export async function getPublicSupplier(code) {
  let response;
  try {
    response = await fetch(`${API_BASE}/public/suppliers/${encodeURIComponent(code)}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  } catch {
    throw new ApiRequestError('Unable to reach TradeExpress. Please check your connection and try again.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) throw new ApiRequestError(data?.message || 'This supplier profile could not be loaded.', response.status);
  return data.data;
}

export const publicAssetUrl = (path) => (path ? `${API_BASE}${path}` : '');
