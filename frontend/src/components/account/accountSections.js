import {
  Bell,
  FileText,
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
      { id: 'two-factor', label: 'Two-Factor Authentication', description: 'An extra code from an authenticator app', icon: Fingerprint, available: false },
      { id: 'sessions', label: 'Active Login Sessions', description: 'Devices signed in to your account', icon: MonitorSmartphone, available: true },
      { id: 'delete', label: 'Delete Account', description: 'Permanently close your account', icon: Trash2, available: true, danger: true, roles: ['buyer', 'supplier'] },
    ],
  },
  {
    id: 'preferences',
    title: 'Preferences',
    icon: Lock,
    rows: [
      { id: 'privacy', label: 'Privacy Settings', description: 'Who sees your information; download your data', icon: Lock, available: true },
      { id: 'email-preferences', label: 'Email Preferences', description: 'Which emails you receive', icon: MailCheck, available: true },
      { id: 'notifications', label: 'Notification Preferences', description: 'Which in-app alerts you receive', icon: Bell, available: true },
      { id: 'language', label: 'Language Preferences', description: 'Language and region on every device', icon: Globe, available: true },
    ],
  },
];

export const ACCOUNT_SECTION_TITLES = Object.fromEntries(ACCOUNT_CARDS.flatMap((card) => card.rows.map((row) => [row.id, row.label])));

/** Role key used by the frontend (buyer | supplier | super_admin) to the dashboard home. */
export const DASHBOARD_HOME = { buyer: '/buyer', supplier: '/supplier', super_admin: '/super-admin' };

