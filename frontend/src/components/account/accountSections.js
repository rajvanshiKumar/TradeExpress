import {
  Bell,
  Building2,
  CircleDollarSign,
  FileBadge2,
  FileCheck2,
  FileText,
  Inbox,
  Landmark,
  Package,
  Store,
  Truck,
  Fingerprint,
  Globe,
  IdCard,
  KeyRound,
  Link2,
  Lock,
  Mail,
  MailCheck,
  MonitorSmartphone,
  Phone,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';

/**
 * Account Settings cards. `available: false` rows are shown as "Coming soon" until their phase is built;
 * they never pretend to work. `roles` limits a row to some roles (default: all).
 */
export const ACCOUNT_CARDS = [
  {
    id: 'information',
    title: 'Account Information',
    icon: UserRound,
    rows: [
      { id: 'profile', label: 'My Profile', description: 'Name, photo and contact details', icon: UserRound, available: true },
      { id: 'member', label: 'Member Profile', description: 'Member ID, account type and verification status', icon: IdCard, available: true },
      { id: 'connected', label: 'Connected Accounts', description: 'Sign-in methods linked to your account', icon: Link2, available: true },
      { id: 'tax', label: 'Tax Information', description: 'GSTIN, PAN and billing details', icon: FileText, available: true, roles: ['buyer', 'supplier'] },
    ],
  },
  {
    id: 'security',
    title: 'Account Security',
    icon: ShieldCheck,
    rows: [
      { id: 'password', label: 'Change Password', description: 'Verified with a code sent to your email', icon: KeyRound, available: true },
      { id: 'email', label: 'Change Email', description: 'Both the old and new address are verified', icon: Mail, available: true },
      { id: 'phone', label: 'Change Phone Number', description: 'Verified by email and SMS codes', icon: Phone, available: true },
      { id: 'two-factor', label: 'Two-Factor Authentication', description: 'An extra code from an authenticator app', icon: Fingerprint, available: false, roles: ['supplier', 'super_admin'] },
      { id: 'sessions', label: 'Active Login Sessions', description: 'Devices signed in to your account', icon: MonitorSmartphone, available: true, roles: ['supplier', 'super_admin'] },
      { id: 'delete', label: 'Delete Account', description: 'Permanently close your account', icon: Trash2, available: true, danger: true, roles: ['supplier'] },
    ],
  },
  {
    id: 'preferences',
    title: 'Preferences',
    icon: Lock,
    rows: [
      { id: 'privacy', label: 'Privacy Settings', description: 'Who sees your information; download your data', icon: Lock, available: true, roles: ['supplier', 'super_admin'] },
      { id: 'email-preferences', label: 'Email Preferences', description: 'Which emails you receive', icon: MailCheck, available: true },
      { id: 'notifications', label: 'Notification Preferences', description: 'Which in-app alerts you receive', icon: Bell, available: true },
      { id: 'language', label: 'Language Preferences', description: 'Language and region on every device', icon: Globe, available: true },
    ],
  },
];

export const ACCOUNT_SECTION_TITLES = Object.fromEntries(ACCOUNT_CARDS.flatMap((card) => card.rows.map((row) => [row.id, row.label])));

/** Role key used by the frontend (buyer | supplier | super_admin) to the dashboard home. */
export const DASHBOARD_HOME = { buyer: '/buyer', supplier: '/supplier', super_admin: '/super-admin' };


/**
 * Supplier Account Settings groups. A row either opens a settings section here (`id` + `available`),
 * opens the existing module that already manages it (`to`), or is marked "Planned" (`available: false`)
 * until its phase is built. Nothing pretends to work.
 */
export const SUPPLIER_SETTINGS_GROUPS = [
  {
    id: 'business', title: 'Business Profile', icon: Building2, description: 'Company details, addresses and public profile',
    rows: [
      { id: 'company-profile', label: 'Company Profile', description: 'Name, logo, description, addresses and contacts', icon: Building2, to: '/supplier/profile' },
      { id: 'profile', label: 'My Profile', description: 'Your name, photo and contact details', icon: UserRound, available: true },
      { id: 'member', label: 'Member Profile', description: 'Member ID, account type and verification status', icon: IdCard, available: true },
      { id: 'storefront', label: 'Product Catalogue', description: 'The products buyers see from your business', icon: Store, to: '/supplier/products' },
    ],
  },
  {
    id: 'security', title: 'Account Security & Login', icon: ShieldCheck, description: 'Password, sign-in methods and devices',
    rows: [
      { id: 'password', label: 'Change Password', description: 'Verified with a code sent to your email', icon: KeyRound, available: true },
      { id: 'email', label: 'Change Email', description: 'Both the old and new address are verified', icon: Mail, available: true },
      { id: 'phone', label: 'Change Phone Number', description: 'Verified by email and SMS codes', icon: Phone, available: true },
      { id: 'connected', label: 'Connected Accounts', description: 'Sign-in methods linked to your account', icon: Link2, available: true },
    ],
  },
  {
    id: 'bank', title: 'Bank & Payment', icon: Landmark, description: 'Payout account, payouts and settlements',
    rows: [
      { id: 'bank-account', label: 'Bank Account Details', description: 'Payout bank account (part of business verification)', icon: Landmark, to: '/supplier/verification' },
      { id: 'payouts', label: 'Payments & Payouts', description: 'Escrow, payout status and settlement history', icon: CircleDollarSign, to: '/supplier/payments' },
    ],
  },
  {
    id: 'notifications-group', title: 'Notification Settings', icon: Bell, description: 'Which alerts and emails you receive',
    rows: [
      { id: 'notifications', label: 'Notification Preferences', description: 'In-app alert categories, applied by the server', icon: Bell, available: true },
      { id: 'email-preferences', label: 'Email Preferences', description: 'Optional product news emails', icon: MailCheck, available: true },
      { id: 'notification-inbox', label: 'Notification Inbox', description: 'All your notifications', icon: Inbox, to: '/supplier/notifications' },
    ],
  },
  {
    id: 'orders', title: 'Order Preferences', icon: Package, description: 'Processing time, acceptance and policies',
    rows: [
      { id: 'purchase-orders', label: 'Purchase Orders', description: 'Manage and fulfil your orders', icon: Package, to: '/supplier/orders' },
    ],
  },
  {
    id: 'shipping', title: 'Shipping & Logistics', icon: Truck, description: 'Transport, pickup and delivery',
    rows: [
      { id: 'transport', label: 'Transport & Delivery Management', description: 'Transporters, vehicles, drivers and shipments', icon: Truck, to: '/supplier/transport' },
    ],
  },
  {
    id: 'documents', title: 'Documents & Compliance', icon: FileCheck2, description: 'GST, PAN, KYC and certificates',
    rows: [
      { id: 'tax', label: 'Tax Information', description: 'GSTIN, PAN and billing details', icon: FileText, available: true },
      { id: 'verification', label: 'Business Verification', description: 'KYC documents, status and rejection reasons', icon: ShieldCheck, to: '/supplier/verification' },
      { id: 'certificates', label: 'TradeExpress ID & Certificates', description: 'Your supplier ID card and certificate', icon: FileBadge2, to: '/supplier/documents' },
    ],
  },
  {
    id: 'account-group', title: 'Account Management', icon: Trash2, description: 'Closing your account',
    rows: [
      { id: 'delete', label: 'Request Account Deletion', description: 'Reviewed by TradeExpress; closes after a grace period', icon: Trash2, available: true, danger: true },
    ],
  },
];

/** Titles of every in-page section (all roles), for the page heading and breadcrumbs. */
export const ALL_SECTION_TITLES = {
  ...ACCOUNT_SECTION_TITLES,
  ...Object.fromEntries(SUPPLIER_SETTINGS_GROUPS.flatMap((g) => g.rows.filter((r) => !r.to).map((r) => [r.id, r.label]))),
};
