// Supplier verification states. "Reviewed" only means a TradeExpress admin looked at the
// documents in this prototype; it is not a third-party or legal verification.
export const VERIFICATION = {
  'not-submitted': { label: 'Not verified', tone: 'neutral', description: 'No documents submitted yet.' },
  'under-review': { label: 'Verification pending', tone: 'warning', description: 'Documents submitted and waiting for admin review.' },
  reviewed: { label: 'Documents reviewed', tone: 'verified', description: 'A TradeExpress admin reviewed the submitted business documents.' },
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
  if (company?.isVerified || company?.kycStatus === 'VERIFIED') {
    return {
      status: 'reviewed',
      label: 'Verified Supplier',
      tone: 'verified',
      description: 'Business identity and KYC documents verified by TradeExpress.',
      documents: company?.kycDocuments || [],
    };
  }
  const verification = company?.verification ?? { status: 'not-submitted', documents: [] };
  return { ...verification, ...(VERIFICATION[verification.status] ?? VERIFICATION['not-submitted']) };
}

export const isReviewed = (company) => Boolean(company?.isVerified || company?.kycStatus === 'VERIFIED' || company?.verification?.status === 'reviewed');

