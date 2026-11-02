// Sample buyer and supplier records used to populate orders, quotes and the admin lists.
// They have no password hash, so nobody can sign in as them: real users register their
// own Buyer or Supplier account. The Admin account is configured separately (src/config/admin.js).

import companies from './companies.js';
import { daysAgo } from '../utils/formatDate.js';

export const SAMPLE_BUYER_ID = 'TS-U-001';
export const SAMPLE_SUPPLIER_ID = 'TS-U-002';

export const DEFAULT_NOTIFICATION_PREFS = { orders: true, quotes: true, messages: true, promotions: false };

const base = { status: 'Active', isSample: true, passwordHash: null, notificationPrefs: DEFAULT_NOTIFICATION_PREFS };

const buyers = [
  ['TS-U-001', 'Aarav Mehta', 'aarav@mehtaretail.example', 'Mehta Retail LLP', 'India', 'Mumbai', 210],
  ['TS-U-004', 'Sofia Martins', 'sofia@brightmart.example', 'BrightMart Stores', 'Brazil', 'São Paulo', 160],
  ['TS-U-005', 'Daniel Okafor', 'daniel@lagoshome.example', 'Lagos Home Supplies', 'Nigeria', 'Lagos', 122],
  ['TS-U-006', 'Emma Clarke', 'emma@northlane.example', 'Northlane Boutique', 'United Kingdom', 'Leeds', 95],
  ['TS-U-007', 'Yusuf Al-Hamdan', 'yusuf@gulfretail.example', 'Gulf Retail Group', 'United Arab Emirates', 'Dubai', 61],
  ['TS-U-008', 'Hannah Weber', 'hannah@studioweber.example', 'Studio Weber GmbH', 'Germany', 'Berlin', 18],
].map(([id, name, email, company, country, city, joined]) => ({
  ...base, id, name, email, role: 'buyer', company, companyId: null, country, city, phone: '', joinedAt: daysAgo(joined),
}));

// One supplier record per sample company.
const suppliers = companies.map((company, index) => ({
  ...base,
  id: index === 0 ? SAMPLE_SUPPLIER_ID : `TS-U-1${String(index + 1).padStart(2, '0')}`,
  name: company.contact.person.replace(/\s*\(.*\)$/, ''),
  email: company.contact.email,
  role: 'supplier',
  company: company.name,
  companyId: company.id,
  country: company.country,
  city: company.city,
  phone: company.contact.phone,
  joinedAt: daysAgo(400 - index * 25),
}));

const users = [...buyers, ...suppliers];
export default users;

export const seedAddresses = {
  [SAMPLE_BUYER_ID]: [
    { id: 'TS-A-001', label: 'Head office', name: 'Aarav Mehta', company: 'Mehta Retail LLP', phone: '+91 00000 00000', line1: '14 Sample Trade Centre', line2: 'Andheri East', city: 'Mumbai', state: 'Maharashtra', postalCode: '400069', country: 'India', isDefault: true },
    { id: 'TS-A-002', label: 'Warehouse', name: 'Receiving Desk', company: 'Mehta Retail LLP', phone: '+91 00000 00001', line1: 'Unit 7, Example Logistics Park', line2: 'Bhiwandi', city: 'Thane', state: 'Maharashtra', postalCode: '421302', country: 'India', isDefault: false },
  ],
};
