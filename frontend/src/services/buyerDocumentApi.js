import { API_BASE, ApiRequestError, authorizedBlob, authorizedRequest } from './authorizedApi.js';

// Buyer: always the signed-in buyer's own documents
export const getMyDocuments = () => authorizedRequest('GET', 'buyer/documents');
export const updateMyPhoto = (photo) => authorizedRequest('PUT', 'buyer/documents/photo', { photo }, { timeoutMs: 60000 });
export const updateMyDetails = (changes) => authorizedRequest('PATCH', 'buyer/documents/details', changes);
export const myPreview = (kind) => authorizedBlob(`buyer/documents/preview/${kind}`);
export const myCertificatePdf = () => authorizedBlob('buyer/documents/certificate.pdf');
export const myIdCardPdf = () => authorizedBlob('buyer/documents/id-card.pdf');
export const myPhoto = () => authorizedBlob('buyer/documents/photo');

