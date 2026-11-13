import seedCompanies from '../data/companies';
import { STORAGE_KEYS } from '../utils/constants';
import { createCollection } from './localCollection';
import { readStorage } from '../utils/storage';
import { slugify } from '../utils/validators';
import makeId from '../utils/ids';

const companies = createCollection(STORAGE_KEYS.companies, seedCompanies);
const BASE_URL = (import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '').trim().replace(/\/+$/, '') || '/api';

/**
 * Combines base seeded/cached companies, locally registered accounts, and remote database suppliers.
 * Ensures all suppliers (both verified and unverified) are included without duplicate names.
 */
export function mergeSuppliers(baseCompanies = [], localAccounts = [], remoteSuppliers = []) {
  const map = new Map();
  const nameToKey = new Map();

  const register = (comp) => {
    if (!comp) return;
    const cName = (comp.name || comp.company || comp.companyName || '').trim();
    if (!cName) return;
    const nameLower = cName.toLowerCase();
    const idKey = comp.id ? String(comp.id) : null;
    const existingKey = (idKey && map.has(idKey)) ? idKey : (nameToKey.has(nameLower) ? nameToKey.get(nameLower) : null);

    const isVer = Boolean(comp.verified || comp.isVerified || comp.kycStatus === 'VERIFIED');
    const kyc = comp.kycStatus || (isVer ? 'VERIFIED' : 'NOT_SUBMITTED');
    const verStatus = isVer ? 'reviewed' : (kyc === 'PENDING' ? 'under-review' : 'not-submitted');

    if (existingKey && map.has(existingKey)) {
      const existing = map.get(existingKey);
      map.set(existingKey, {
        ...existing,
        ...comp,
        name: cName,
        verified: isVer,
        isVerified: isVer,
        kycStatus: kyc,
        verification: comp.verification || existing.verification || {
          status: verStatus,
          label: isVer ? 'Verified Supplier' : (kyc === 'PENDING' ? 'Verification Pending' : 'Not verified'),
          submittedAt: comp.createdAt || existing.createdAt || null,
          reviewedAt: isVer ? new Date().toISOString() : null,
          documents: comp.documents || existing.documents || [],
        },
        contact: { ...(existing.contact || {}), ...(comp.contact || {}) },
      });
    } else {
      const key = idKey || makeId('TS-CO');
      const item = {
        id: key,
        status: comp.status === 'Suspended' ? 'Suspended' : 'Active',
        name: cName,
        slug: comp.slug || slugify(cName) || key,
        flag: comp.flag ?? '',
        initials: comp.initials || cName.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'TE',
        industry: comp.industry || comp.businessType || 'General Trade',
        businessType: comp.businessType || 'Supplier',
        country: comp.country || 'India',
        city: comp.city || '',
        state: comp.state || '',
        established: comp.established || comp.yearEstablished || new Date().getFullYear(),
        rating: typeof comp.rating === 'number' ? comp.rating : 0,
        reviewCount: typeof comp.reviewCount === 'number' ? comp.reviewCount : 0,
        responseTime: comp.responseTime || 'Within 24 hours',
        mainProducts: Array.isArray(comp.mainProducts) ? comp.mainProducts : [],
        description: comp.description || `${cName} is a supplier on TradeExpress.`,
        verified: isVer,
        isVerified: isVer,
        kycStatus: kyc,
        verification: comp.verification || {
          status: verStatus,
          label: isVer ? 'Verified Supplier' : (kyc === 'PENDING' ? 'Verification Pending' : 'Not verified'),
          submittedAt: comp.createdAt || null,
          reviewedAt: isVer ? new Date().toISOString() : null,
          documents: comp.documents || [],
        },
        contact: {
          person: comp.contact?.person || comp.contactPerson || '',
          email: comp.contact?.email || comp.email || '',
          phone: comp.contact?.phone || comp.phone || '',
          address: comp.contact?.address || comp.businessAddress || '',
        },
        ...comp,
      };
      map.set(key, item);
      nameToKey.set(nameLower, key);
    }
  };

  // 1. Local/seeded base
  baseCompanies.forEach(register);

  // 2. Local accounts in storage (covers newly signed-up supplier in local session)
  localAccounts.forEach((acc) => {
    if (!acc || String(acc.role || '').toLowerCase() !== 'supplier') return;
    const cName = (acc.company || acc.companyName || acc.name || '').trim();
    if (!cName) return;
    register({
      id: acc.companyId || acc.id,
      name: cName,
      status: acc.status === 'Suspended' ? 'Suspended' : 'Active',
      industry: acc.businessType || 'General Trade',
      businessType: acc.businessType || 'Supplier',
      country: acc.country || 'India',
      city: acc.city || '',
      state: acc.state || '',
      verified: Boolean(acc.isVerified || acc.kycStatus === 'VERIFIED'),
      isVerified: Boolean(acc.isVerified || acc.kycStatus === 'VERIFIED'),
      kycStatus: acc.kycStatus || 'NOT_SUBMITTED',
      contact: {
        person: acc.name || '',
        email: acc.email || '',
        phone: acc.businessPhone || acc.phone || '',
        address: acc.businessAddress || '',
      },
      createdAt: acc.joinedAt || acc.createdAt,
    });
  });

  // 3. Remote backend suppliers
  remoteSuppliers.forEach(register);

  return Array.from(map.values());
}

async function fetchRemoteSuppliers() {
  try {
    const res = await fetch(`${BASE_URL}/public/suppliers`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    return Array.isArray(data.data) ? data.data : [];
  } catch {
    return [];
  }
}

const supplierService = {
  getInitialCompanies: () => {
    const local = companies.readInstant();
    const accounts = readStorage(STORAGE_KEYS.accounts, []) || [];
    return mergeSuppliers(local, accounts, []);
  },
  listCompanies: async (options) => {
    const local = await companies.list(options);
    const accounts = readStorage(STORAGE_KEYS.accounts, []) || [];
    const remote = await fetchRemoteSuppliers();
    const merged = mergeSuppliers(local, accounts, remote);
    if (merged.length !== local.length) {
      try {
        companies.saveAll(merged);
      } catch {
        /* storage full or unavailable */
      }
    }
    return merged;
  },
  saveCompanies: (records) => companies.saveAll(records),
};

export default supplierService;

export const SUPPLIER_SORT_OPTIONS = [
  { value: 'rating', label: 'Rating: high to low' },
  { value: 'name-asc', label: 'Name: A to Z' },
  { value: 'name-desc', label: 'Name: Z to A' },
];

/** filters: { q, scope, country, industry, businessType, sort } */
export function filterCompanies(companies, filters = {}) {
  const q = (filters.q ?? '').trim().toLowerCase();
  const result = companies.filter((company) => {
    if (company.status === 'Suspended') return false;
    if (q) {
      // scope "company" matches names and locations only; otherwise products and industry count too.
      const haystack = (filters.scope === 'company'
        ? `${company.name} ${company.city} ${company.country}`
        : `${company.name} ${company.city} ${company.country} ${company.industry} ${company.businessType} ${(company.mainProducts ?? []).join(' ')}`).toLowerCase();
      if (!q.split(/\s+/).every((word) => haystack.includes(word))) return false;
    }
    if (filters.country && company.country !== filters.country) return false;
    if (filters.industry && company.industry !== filters.industry) return false;
    if (filters.businessType && company.businessType !== filters.businessType) return false;
    return true;
  });
  const sorters = {
    rating: (a, b) => b.rating - a.rating || a.name.localeCompare(b.name),
    'name-asc': (a, b) => a.name.localeCompare(b.name),
    'name-desc': (a, b) => b.name.localeCompare(a.name),
  };
  return result.sort(sorters[filters.sort] ?? sorters.rating);
}
