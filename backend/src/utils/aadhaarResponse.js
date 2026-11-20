import { readEncryptedField } from './dataCrypto.js';

/** The UIDAI photo (base64) as an image data URL; only JPEG/PNG bytes are accepted. */
export function aadhaarPhotoDataUrl(base64) {
  const value = typeof base64 === 'string' ? base64.replace(/\s+/g, '') : '';
  if (!value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  if (value.startsWith('/9j/')) return `data:image/jpeg;base64,${value}`;
  if (value.startsWith('iVBORw0KGgo')) return `data:image/png;base64,${value}`;
  return null;
}

/**
 * The identity details UIDAI returned for an Aadhaar OTP verification (Aadhaar number, name, date of birth, gender,
 * address, care-of, photo). Accepts the provider response as an object or as the stored JSON text (older stored
 * rows may still be encrypted). Returns null when there is nothing readable.
 */
export function aadhaarHolderDetails(response) {
  let body = response;
  if (typeof response === 'string' || response === null || response === undefined) {
    const raw = readEncryptedField(response);
    if (!raw) return null;
    try {
      body = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const data = body?.data && typeof body.data === 'object' ? body.data : {};
  const a = data.address && typeof data.address === 'object' ? data.address : {};
  const address = [a.house, a.street, a.landmark, a.loc, a.vtc, a.po, a.subdist, a.dist, a.state, data.zip, a.country]
    .map((part) => (part ? String(part).trim() : ''))
    .filter((part, i, list) => part && list.indexOf(part) === i)
    .join(', ');
  // The full number only when UIDAI returned it unmasked (live verifications); UAT test replies are masked
  const aadhaarNumber = /^\d{12}$/.test(String(data.aadhaar_number || '')) ? String(data.aadhaar_number) : null;
  return {
    aadhaarNumber,
    fullName: data.full_name || null,
    dateOfBirth: data.dob || null,
    gender: data.gender || null,
    careOf: data.care_of || null,
    address: address || null,
    mobileVerified: typeof data.mobile_verified === 'boolean' ? data.mobile_verified : null,
    photo: aadhaarPhotoDataUrl(data.profile_image),
  };
}
