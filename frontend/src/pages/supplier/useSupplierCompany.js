import useAuth from '../../hooks/useAuth';
import useProducts from '../../hooks/useProducts';
import { slugify } from '../../utils/validators';

/** The company that the signed-in supplier manages, plus its products. */
export default function useSupplierCompany() {
  const { user } = useAuth();
  const { getCompany, products, loading, companies } = useProducts();

  let company = user?.companyId ? getCompany(user.companyId) : null;

  // Fallback: If not found by companyId, match by company name or user id or create synthesized company from user profile
  if (!company && user && user.role === 'SUPPLIER') {
    company = (companies || []).find(
      (c) => c.id === user.id || c.name?.toLowerCase() === (user.company || '').toLowerCase()
    );

    if (!company) {
      const companyName = user.company || user.name || 'TradeExpress Merchant';
      company = {
        id: user.companyId || user.id,
        name: companyName,
        slug: slugify(companyName) || 'tradeexpress-merchant',
        country: user.country || 'India',
        city: user.city || '',
        state: user.state || '',
        postalCode: user.postalCode || '',
        businessType: user.businessType || 'Manufacturer',
        established: user.yearEstablished || new Date().getFullYear(),
        industry: 'Industrial & B2B Trade',
        employees: '11–50',
        color: '#123F25',
        responseTime: 'Within 12 hours',
        description:
          user.companyDescription ||
          `${companyName} is a verified B2B wholesale supplier on TradeExpress.`,
        contact: {
          person: user.name || '',
          email: user.email || '',
          phone: user.phone || '',
          address: user.businessAddress || '',
        },
        gstin: user.gstin || '',
        pan: user.pan || '',
        aadhaarLast4: user.aadhaarLast4 || '',
        aadhaarConsent: user.aadhaarConsent || false,
        panAadhaarStatus: user.panAadhaarStatus || 'NOT_STARTED',
        panAadhaarLinked: user.panAadhaarLinked || false,
        panAadhaarMaskedPan: user.panAadhaarMaskedPan || null,
        panAadhaarCheckedAt: user.panAadhaarCheckedAt || null,
        kycStatus: user.kycStatus || 'PENDING',
        isVerified: user.isVerified || false,
        supplierCode: user.supplierCode || 'SUP-ACTIVE',
        flag: user.country === 'United States' ? '🇺🇸' : '🇮🇳',
        rating: 5.0,
        reviewCount: 0,
        orderCount: 0,
        mainProducts: [],
        moqInfo: 'Contact supplier for wholesale pricing and MOQ inquiries.',
      };
    }
  }

  const companyProducts = company ? products.filter((product) => product.companyId === company.id) : [];
  return { company, companyProducts, loading };
}
