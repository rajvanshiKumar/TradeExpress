// Number formats for the business registration certificates offered at supplier signup.
// GST Certificate numbers are verified with the GST provider; the others have no connected
// verification service, so only their published format is checked ("Valid format", not "Verified").

const UDYAM = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;
const UDYOG_AADHAAR = /^[A-Z]{2}\d{2}[A-Z]\d{7}$/;
const GENERAL = /^[A-Z0-9][A-Z0-9/-]{3,29}$/;

export const CERTIFICATE_RULES = {
  'Udyam Certificate': { test: (n) => UDYAM.test(n), hint: 'Udyam Registration Number, e.g. UDYAM-GJ-01-1234567' },
  'MSME Certificate': { test: (n) => UDYAM.test(n) || UDYOG_AADHAAR.test(n), hint: 'Udyam number (UDYAM-GJ-01-1234567) or Udyog Aadhaar number (GJ01A1234567)' },
  'Udyog Aadhaar': { test: (n) => UDYOG_AADHAAR.test(n), hint: '12-character Udyog Aadhaar number, e.g. GJ01A1234567' },
  'BRN Certificate': { test: (n) => GENERAL.test(n), hint: '4–30 letters or digits (/ and - allowed)' },
  'Gumasta Licence': { test: (n) => GENERAL.test(n), hint: '4–30 letters or digits (/ and - allowed)' },
  Other: { test: (n) => GENERAL.test(n), hint: '4–30 letters or digits (/ and - allowed)' },
};

/** Upper-cases and keeps only the characters a certificate number can contain. */
export function normalizeCertificateNumber(businessType, value) {
  const upper = String(value || '').toUpperCase();
  return businessType === 'GST Certificate' ? upper.replace(/[^0-9A-Z]/g, '') : upper.replace(/[^0-9A-Z/-]/g, '');
}

/** True when `number` matches the published format for a non-GST certificate type. */
export function isValidCertificateFormat(businessType, number) {
  const rule = CERTIFICATE_RULES[businessType];
  return Boolean(rule && rule.test(String(number || '').trim().toUpperCase()));
}

export const certificateFormatHint = (businessType) => CERTIFICATE_RULES[businessType]?.hint || '';
