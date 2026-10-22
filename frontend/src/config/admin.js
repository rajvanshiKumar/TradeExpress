// Admin account configuration, kept apart from buyer and supplier registration.
//
// Admin credentials:
// Email: krajvanshi244@gmail.com
// Password: modiji@12345
//
// Salted PBKDF2 hash of the password is configured below and in .env

export const ADMIN_EMAIL = 'krajvanshi244@gmail.com';
export const ADMIN_PASSWORD_HASH = 'pbkdf2$210000$+EiQV+hBx2zh1Kp6kAL+gA==$wiIkdSOoT8QJI52YYf+wfYFc0IyJhNjJgVKXMTlOm0M=';

export const SUPER_ADMIN_EMAIL = 'krajvanshi244@gmail.com';
export const SUPER_ADMIN_PROFILE = {
  id: 'TS-SUPER-ADMIN',
  name: 'Rajvanshi Kumar (Super Admin)',
  email: SUPER_ADMIN_EMAIL,
  role: 'super_admin',
  company: 'TradeExpress Global HQ',
  companyId: null,
  status: 'Active',
  notificationPrefs: { orders: true, quotes: true, messages: true, disputes: true, audit: true },
};

export const isAdminConfigured = true;

export const ADMIN_EMAILS = [
  'krajvanshi244@gmail.com',
  'hello.techvunex@gmail.com',
  'admin@tradesphere.com',
  'admin@tradesphere.example',
  'admin',
];

export const ADMIN_PROFILE = {
  id: 'TS-ADMIN',
  name: 'TradeExpress Administrator',
  email: ADMIN_EMAIL,
  role: 'admin',
  company: 'TradeExpress Global HQ',
  companyId: null,
  status: 'Active',
  notificationPrefs: { orders: true, quotes: true, messages: true },
};

