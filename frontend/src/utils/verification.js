// Supplier verification states. "Reviewed" only means a TradeSphere admin looked at the
// documents in this prototype; it is not a third-party or legal verification.
export const VERIFICATION = {
  'not-submitted': { label: 'Not verified', tone: 'neutral', description: 'No documents submitted yet.' },
  'under-review': { label: 'Verification pending', tone: 'warning', description: 'Documents submitted and waiting for admin review.' },
  reviewed: { label: 'Documents reviewed', tone: 'verified', description: 'A TradeSphere admin reviewed the submitted business documents.' },
  rejected: { label: 'Verification declined', tone: 'danger', description: 'The admin asked for different or clearer documents.' },
};

export const DOCUMENT_TYPES = [
  'Business registration certificate',
  'Tax registration (GST / VAT)',
  'Import Export Code (IEC)',
  'Factory audit report',
  'Product certification',
  'Bank letter',
];

export function getVerification(company) {
  const verification = company?.verification ?? { status: 'not-submitted', documents: [] };
  return { ...verification, ...(VERIFICATION[verification.status] ?? VERIFICATION['not-submitted']) };
}

export const isReviewed = (company) => company?.verification?.status === 'reviewed';
