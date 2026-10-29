// App-wide constants. Sample values (shipping, tax) are easy to change here.

export const BRAND = {
  name: 'TradeExpress',
  tagline: 'India’s Premier B2B Marketplace',
  supportEmail: 'support@tradeexpress.com',
};

// Every browser-storage key lives under this prefix, so "Reset sample data" can clear them all.
// The version number changes when the stored data format changes (v3: real HD photography, no cartoon SVGs).
export const STORAGE_PREFIX = 'tradesphere:v3:';
export const LEGACY_STORAGE_PREFIX = 'tradesphere:v2:';
export const STORAGE_KEYS = {
  products: 'products',
  companies: 'companies',
  categories: 'categories',
  recentlyViewed: 'recently-viewed',
  cart: 'cart',
  wishlist: 'wishlist',
  inquiries: 'inquiries',
  conversations: 'conversations',
  orders: 'orders',
  notifications: 'notifications',
  session: 'session',
  accounts: 'accounts',
  preferences: 'preferences',
  addresses: 'addresses',
  newsletter: 'newsletter',
  contactMessages: 'contact-messages',
  buyNow: 'buy-now',
  savedSuppliers: 'saved-suppliers',
  seenOrders: 'seen-orders',
};

// All prices are stored and shown in Indian Rupees.
export const CURRENCY = { code: 'INR', symbol: '₹', locale: 'en-IN' };

// Countries with mobile-number rules. `dial` is the country calling code; `lengths` the
// allowed national number lengths (without the trunk 0); `pattern` checks the national number.
export const COUNTRY_PHONE_RULES = {
  India: { dial: '91', lengths: [10], pattern: /^[6-9]\d{9}$/, example: '98765 43210' },
  'United States': { dial: '1', lengths: [10], pattern: /^[2-9]\d{2}[2-9]\d{6}$/, example: '212 555 0147' },
  Canada: { dial: '1', lengths: [10], pattern: /^[2-9]\d{2}[2-9]\d{6}$/, example: '416 555 0147' },
  'United Kingdom': { dial: '44', lengths: [10], pattern: /^7\d{9}$/, example: '7400 123456' },
  'United Arab Emirates': { dial: '971', lengths: [9], pattern: /^5[0-9]\d{7}$/, example: '50 123 4567' },
  'Saudi Arabia': { dial: '966', lengths: [9], pattern: /^5\d{8}$/, example: '50 123 4567' },
  Singapore: { dial: '65', lengths: [8], pattern: /^[89]\d{7}$/, example: '8123 4567' },
  Australia: { dial: '61', lengths: [9], pattern: /^4\d{8}$/, example: '412 345 678' },
  Germany: { dial: '49', lengths: [10, 11], pattern: /^1[5-7]\d{8,9}$/, example: '1512 3456789' },
  France: { dial: '33', lengths: [9], pattern: /^[67]\d{8}$/, example: '6 12 34 56 78' },
  Italy: { dial: '39', lengths: [9, 10], pattern: /^3\d{8,9}$/, example: '312 345 6789' },
  Spain: { dial: '34', lengths: [9], pattern: /^[67]\d{8}$/, example: '612 34 56 78' },
  Netherlands: { dial: '31', lengths: [9], pattern: /^6\d{8}$/, example: '6 12345678' },
  'South Africa': { dial: '27', lengths: [9], pattern: /^[6-8]\d{8}$/, example: '71 123 4567' },
  Brazil: { dial: '55', lengths: [11], pattern: /^\d{2}9\d{8}$/, example: '11 91234 5678' },
  Mexico: { dial: '52', lengths: [10], pattern: /^\d{10}$/, example: '55 1234 5678' },
  Japan: { dial: '81', lengths: [10], pattern: /^[789]0\d{8}$/, example: '90 1234 5678' },
  'South Korea': { dial: '82', lengths: [9, 10], pattern: /^1[0-9]\d{7,8}$/, example: '10 1234 5678' },
  China: { dial: '86', lengths: [11], pattern: /^1[3-9]\d{9}$/, example: '138 0013 8000' },
  Vietnam: { dial: '84', lengths: [9], pattern: /^[35789]\d{8}$/, example: '912 345 678' },
  Bangladesh: { dial: '880', lengths: [10], pattern: /^1[3-9]\d{8}$/, example: '1712 345678' },
  'Türkiye': { dial: '90', lengths: [10], pattern: /^5\d{9}$/, example: '532 123 4567' },
  Kenya: { dial: '254', lengths: [9], pattern: /^[17]\d{8}$/, example: '712 345678' },
  Nigeria: { dial: '234', lengths: [10], pattern: /^[789][01]\d{8}$/, example: '802 123 4567' },
};

export const COUNTRIES = Object.keys(COUNTRY_PHONE_RULES);

export const COUNTRY_FLAGS = {
  India: '🇮🇳',
  'United States': '🇺🇸',
  Canada: '🇨🇦',
  'United Kingdom': '🇬🇧',
  'United Arab Emirates': '🇦🇪',
  'Saudi Arabia': '🇸🇦',
  Singapore: '🇸🇬',
  Australia: '🇦🇺',
  Germany: '🇩🇪',
  France: '🇫🇷',
  Italy: '🇮🇹',
  Spain: '🇪🇸',
  Netherlands: '🇳🇱',
  'South Africa': '🇿🇦',
  Brazil: '🇧🇷',
  Mexico: '🇲🇽',
  Japan: '🇯🇵',
  'South Korea': '🇰🇷',
  China: '🇨🇳',
  Vietnam: '🇻🇳',
  Bangladesh: '🇧🇩',
  'Türkiye': '🇹🇷',
  Kenya: '🇰🇪',
  Nigeria: '🇳🇬',
};

export const LANGUAGES = [
  { code: 'en', label: 'English', nativeName: 'English', short: 'EN' },
  { code: 'hi', label: 'Hindi', nativeName: 'हिन्दी', short: 'HI' },
  { code: 'ta', label: 'Tamil', nativeName: 'தமிழ்', short: 'TA' },
  { code: 'te', label: 'Telugu', nativeName: 'తెలుగు', short: 'TE' },
  { code: 'kn', label: 'Kannada', nativeName: 'ಕನ್ನಡ', short: 'KN' },
  { code: 'ml', label: 'Malayalam', nativeName: 'മലയാളം', short: 'ML' },
  { code: 'bn', label: 'Bengali', nativeName: 'বাংলা', short: 'BN' },
  { code: 'mr', label: 'Marathi', nativeName: 'मराठी', short: 'MR' },
];

export const DEFAULT_PREFERENCES = { country: 'India', language: 'en' };

export const BUSINESS_TYPES = [
  'Manufacturer',
  'Wholesaler',
  'Distributor',
  'Trader',
  'Exporter',
  'Importer',
  'Retailer',
  'Supplier',
  'Dealer',
  'Authorized Dealer',
  'Reseller',
  'OEM Manufacturer',
  'ODM Manufacturer',
  'Contract Manufacturer',
  'Private Label Manufacturer',
  'Factory / Industrial Producer',
  'Artisan / Handicraft Producer',
  'Farmer / Agricultural Producer',
  'Cooperative / Producer Group',
  'Service Provider',
  'Logistics / Freight Provider',
  'Raw Material Supplier',
  'Component / Parts Supplier',
  'Stockist',
  'Trading Company',
  'Buying House / Sourcing Agent',
  'Franchisee',
  'Brand Owner',
  'Repair & Maintenance Provider',
  'Other',
];

export const SUPPLIER_BUSINESS_TYPES = [
  'Gumasta Licence',
  'Udyog Aadhaar',
  'BRN Certificate',
  'MSME Certificate',
  'GST Certificate',
  'Udyam Certificate',
];

export const BUYER_GST_STATUS_OPTIONS = [
  'Gumasta Licence',
  'Udyog Aadhaar',
  'BRN Certificate',
  'MSME Certificate',
  'GST Certificate',
  'Udyam Certificate',
];

export const BUYER_TYPES = [
  'Corporate Procurement',
  'Wholesaler',
  'Distributor',
  'Retailer',
  'Importer',
  'Exporter',
  'Trader',
  'Reseller',
  'E-commerce Seller',
  'Manufacturer',
  'Institutional Buyer',
  'Other',
];

export const BUYER_GST_REGISTRATION_TYPES = [
  {
    value: 'Regular GST Registration',
    label: 'Registered (Regular GST)',
    description: 'Standard taxable business filing regular GST returns with input tax credit.',
    requiresGstin: true,
  },
  {
    value: 'Composition Scheme',
    label: 'Registered (Composition Scheme)',
    description: 'Small enterprise operating under Section 10 turnover-based simplified scheme.',
    requiresGstin: true,
  },
  {
    value: 'GST Registration Applied / Pending',
    label: 'Application Pending (ARN Generated)',
    description: 'GST application submitted on GSTN portal; ARN generated, awaiting GSTIN issuance.',
    requiresGstin: false,
  },
  {
    value: 'Not Registered / Not Applicable',
    label: 'Not Registered / Not Applicable (Exempt / Below Threshold)',
    description: 'Annual turnover below statutory threshold limit (₹40L/₹20L) or deals in exempt goods.',
    requiresGstin: false,
  },
];

export const GST_REGISTRATION_TYPES = [
  {
    value: 'Regular GST Registration',
    label: 'Regular GST Registration',
    taxpayerType: 'Standard Taxpayer',
    description: 'Standard taxable person filing monthly/quarterly returns (GSTR-1, GSTR-3B) with input tax credit.',
    requiresGstin: true,
  },
  {
    value: 'Composition Scheme',
    label: 'Composition Scheme (Sec 10)',
    taxpayerType: 'Composition Taxpayer',
    description: 'Simplified turnover-based tax scheme with lower rates, no ITC passing, quarterly payment (CMP-08).',
    requiresGstin: true,
  },
  {
    value: 'Casual Taxable Person',
    label: 'Casual Taxable Person (CTP)',
    taxpayerType: 'Temporary Trader',
    description: 'Engaged in seasonal or temporary commercial transactions with no fixed place of business in the state.',
    requiresGstin: true,
  },
  {
    value: 'Non-Resident Taxable Person',
    label: 'Non-Resident Taxable Person (NRTP)',
    taxpayerType: 'Non-Resident Business',
    description: 'Supplies goods or services into India with no fixed place of business or residence in India.',
    requiresGstin: true,
  },
  {
    value: 'Input Service Distributor (ISD)',
    label: 'Input Service Distributor (ISD)',
    taxpayerType: 'ISD Office',
    description: 'Office of the supplier receiving invoice for input services to distribute ITC to branches.',
    requiresGstin: true,
  },
  {
    value: 'SEZ Unit',
    label: 'Special Economic Zone (SEZ) Unit',
    taxpayerType: 'SEZ Exporter',
    description: 'Unit located inside a Special Economic Zone with zero-rated export & inter-state supply status.',
    requiresGstin: true,
  },
  {
    value: 'SEZ Developer',
    label: 'SEZ Developer / Co-Developer',
    taxpayerType: 'SEZ Developer',
    description: 'Entity authorized by government to develop or co-develop an approved SEZ zone.',
    requiresGstin: true,
  },
  {
    value: 'TDS Deductor',
    label: 'TDS Deductor (Govt/PSU/Authorities)',
    taxpayerType: 'TDS Entity',
    description: 'Government departments or local authorities mandated to deduct tax under Sec 51.',
    requiresGstin: true,
  },
  {
    value: 'TCS Collector',
    label: 'TCS Collector (E-Commerce Operator)',
    taxpayerType: 'E-Commerce Operator',
    description: 'Electronic commerce operator liable to collect tax at source under Sec 52.',
    requiresGstin: true,
  },
  {
    value: 'GST Registration Applied / Pending',
    label: 'GST Registration Applied / Pending (ARN)',
    taxpayerType: 'Pending Registration',
    description: 'Application for GST registration submitted to GSTN portal; ARN generated, awaiting final GSTIN.',
    requiresGstin: false,
  },
  {
    value: 'Not Registered / Not Applicable',
    label: 'Not Registered / Not Applicable (Exempt/Below Threshold)',
    taxpayerType: 'Unregistered Business',
    description: 'Aggregate turnover below statutory threshold limit (₹40L/₹20L) or deals exclusively in exempt supplies.',
    requiresGstin: false,
  },
];

export const INDIA_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

export const SUPPLIER_DOC_TYPES = [
  { value: 'GST_CERTIFICATE', label: 'GST Registration Certificate (Form REG-06)' },
  { value: 'PAN_CARD', label: 'Company / Business PAN Card' },
  { value: 'BUSINESS_REG', label: 'Certificate of Incorporation / Partnership Deed / Udyam MSME' },
  { value: 'IEC_CERTIFICATE', label: 'Import Export Code (IEC) Certificate' },
  { value: 'TRADE_LICENSE', label: 'Municipal Trade License / Factory License' },
  { value: 'ISO_CERTIFICATE', label: 'ISO / Quality / Compliance Certificate' },
  { value: 'WAREHOUSE_PROOF', label: 'Factory / Warehouse Ownership / Lease Agreement' },
  { value: 'OTHER', label: 'Other Government / Legal Registration Document' },
];


// Shipping estimates. `base` is a flat fee in INR and `rate` a share of the goods value.
export const SHIPPING_METHODS = [
  { id: 'sea', label: 'Sea freight', eta: '25–40 days', base: 5000, rate: 0.03, note: 'Lowest cost for bulk orders' },
  { id: 'air', label: 'Air freight', eta: '7–12 days', base: 10000, rate: 0.07, note: 'Balanced speed and cost' },
  { id: 'express', label: 'Express courier', eta: '3–6 days', base: 15000, rate: 0.11, note: 'Fastest door-to-door option' },
];
export const DEFAULT_SHIPPING_METHOD = 'sea';

// Estimate of duties and taxes, applied to the goods value.
export const TAX_RATE = 0.05;

// Payment options. Only the choice is recorded: no payment details are ever collected here.
export const PAYMENT_METHODS = [
  { id: 'upi', label: 'UPI', note: 'Online payment' },
  { id: 'card', label: 'Credit / Debit Card', note: 'Online payment' },
  { id: 'netbanking', label: 'Net Banking', note: 'Online payment' },
  { id: 'wallet', label: 'Digital Wallet', note: 'Online payment' },
  { id: 'cod', label: 'Cash on Delivery', note: 'Pay when the goods arrive' },
];

export const ORDER_STATUSES = ['Pending', 'Confirmed', 'Packed', 'In Production', 'Shipped', 'Delivered', 'Cancelled'];
export const INQUIRY_STATUSES = ['Submitted', 'Viewed', 'Quoted', 'Negotiating', 'Closed'];

export const STATUS_TONES = {
  Pending: 'warning',
  Confirmed: 'navy',
  Packed: 'navy',
  'In Production': 'navy',
  Shipped: 'brand',
  Delivered: 'success',
  Cancelled: 'danger',
  Submitted: 'warning',
  Viewed: 'neutral',
  Quoted: 'success',
  Negotiating: 'brand',
  Closed: 'neutral',
  Active: 'success',
  Suspended: 'danger',
  'Under review': 'warning',
};


export const PAGE_SIZE = 12;
export const MAX_RECENTLY_VIEWED = 8;
export const SIMULATED_DELAY_MS = 0;

export const ROLES = { buyer: 'buyer', supplier: 'supplier', admin: 'admin', super_admin: 'super_admin' };
export const ROLE_HOME = { buyer: '/buyer', supplier: '/supplier/dashboard', admin: '/admin', super_admin: '/super-admin' };
export const ordersPathFor = (user) => (!user ? '/buyer/orders' : user.role === 'supplier' ? '/supplier/orders' : user.role === 'admin' ? '/admin/reports' : user.role === 'super_admin' ? '/super-admin/orders' : '/buyer/orders');

// A product is flagged as "low stock" when fewer than this many minimum orders are left.
export const LOW_STOCK_FACTOR = 2;

// Payment states stored on an order. Nothing is ever marked as paid by the browser alone:
// online payment needs a payment provider, and Cash on Delivery is paid when goods arrive.
export const PAYMENT_STATUS = { pending: 'Payment pending', cod: 'Cash on Delivery: payment pending', paid: 'Paid', cancelled: 'Not charged' };

// A Buy Now selection is kept for this long, then it has to be started again.
export const BUY_NOW_TTL_MS = 30 * 60 * 1000;
