import seedCompanies from '../data/companies';
import { STORAGE_KEYS } from '../utils/constants';
import { createCollection } from './localCollection';

const companies = createCollection(STORAGE_KEYS.companies, seedCompanies);

const supplierService = {
  getInitialCompanies: () => companies.readInstant(),
  listCompanies: (options) => companies.list(options),
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
