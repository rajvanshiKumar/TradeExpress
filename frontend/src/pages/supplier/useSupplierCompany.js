import useAuth from '../../hooks/useAuth';
import useProducts from '../../hooks/useProducts';
import { slugify } from '../../utils/validators';

/** The company that the signed-in supplier manages, plus its products. */
export default function useSupplierCompany() {
  const { user } = useAuth();
  const { getCompany, products, loading, companies } = useProducts();

  let company = user?.companyId ? getCompany(user.companyId) : null;

  // Fallback: If not found by companyId, match by company name or user id or create synthesized company from user profile
  const isSupplier = user?.role?.toLowerCase() === 'supplier';
  if (!company && user && isSupplier) {
    company = (companies || []).find(
      (c) => c.id === user.id || (user.company && c.name?.toLowerCase() === user.company.toLowerCase())
    );

    if (!company) {
      const companyName = user.company || user.companyName || user.name || '';
      if (companyName) {
        company = {
          id: user.companyId || user.id,
          name: companyName,
          slug: slugify(companyName) || 'supplier-enterprise',
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
          kycRejectionReason: user.kycRejectionReason || null,
          isVerified: Boolean(user.isVerified),
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
  }

  const companyProducts = company
    ? products.filter(
        (product) =>
          product.companyId === company.id ||
          (user?.id && product.supplierId === user.id) ||
          (company.slug && product.companySlug === company.slug)
      )
    : [];
  return { company: company || null, companyProducts, loading, user };
}
