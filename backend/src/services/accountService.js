import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import prisma from '../config/db.js';
import { uploadDir } from '../middleware/uploadMiddleware.js';

/*
 * Account Settings for the signed-in user (Buyer, Supplier or Super Admin).
 * Every function takes the authenticated user's id; nothing here accepts a user id from the request.
 */

const ACCOUNT_SELECT = {
  id: true, email: true, name: true, role: true, status: true, isActive: true, createdAt: true,
  phone: true, isPhoneVerified: true, isVerified: true, googleId: true, avatarUrl: true,
  company: true, city: true, state: true, country: true, postalCode: true, businessAddress: true,
  supplierCode: true, gstin: true, gstStatus: true, pan: true, panAadhaarStatus: true, panAadhaarCheckedAt: true,
  kycStatus: true, kycRejectionReason: true, businessType: true,
};

const ROLE_LABELS = { BUYER: 'Buyer', SUPPLIER: 'Supplier', SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin' };

export function maskEmail(email) {
  const [local = '', domain = ''] = String(email || '').split('@');
  if (!domain) return '';
  const visible = local.length <= 2 ? local.slice(0, 1) : `${local.slice(0, 2)}`;
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

export function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return '';
  return `${String(phone).trim().startsWith('+') ? `+${digits.slice(0, digits.length - 10)} ` : ''}******${digits.slice(-4)}`.trim();
}

/** Shows only the first 2 and last 3 characters (e.g. 24*********1Z5). */
export function maskIdentifier(value) {
  const clean = String(value || '').trim().toUpperCase();
  if (clean.length < 6) return clean ? '*'.repeat(clean.length) : '';
  return `${clean.slice(0, 2)}${'*'.repeat(clean.length - 5)}${clean.slice(-3)}`;
}

/** Read-only member id: the supplier code for suppliers, otherwise derived from the account id. */
export function memberIdFor(user) {
  if (user.supplierCode) return user.supplierCode;
  const prefix = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' ? 'TA' : 'TB';
  return `${prefix}-${String(user.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

function notFound() {
  const error = new Error('Account not found.');
  error.statusCode = 404;
  return error;
}

/** Everything the Account Settings pages show, for the signed-in user only. */
export async function getAccountSettings(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: ACCOUNT_SELECT });
  if (!user) throw notFound();

  const isSupplier = user.role === 'SUPPLIER';
  const isBuyer = user.role === 'BUYER';

  // Email verification is recorded for buyers (isVerified) and proven for Google-linked accounts.
  // For suppliers, isVerified means business approval, so it is not reported as email verification.
  const emailVerified = isBuyer ? Boolean(user.isVerified) : Boolean(user.googleId);

  return {
    profile: {
      name: user.name,
      email: user.email,
      maskedEmail: maskEmail(user.email),
      phone: user.phone || null,
      maskedPhone: maskPhone(user.phone),
      avatarUrl: user.avatarUrl || null,
      role: user.role,
      roleLabel: ROLE_LABELS[user.role] || user.role,
      company: user.company || null,
      city: user.city || null,
      country: user.country || null,
    },
    member: {
      memberId: memberIdFor(user),
      accountType: ROLE_LABELS[user.role] || user.role,
      registeredAt: user.createdAt,
      status: user.isActive === false ? 'SUSPENDED' : (user.status || 'ACTIVE'),
      emailVerification: emailVerified ? 'VERIFIED' : 'NOT_CONFIRMED',
      phoneVerification: user.phone ? (user.isPhoneVerified ? 'VERIFIED' : 'NOT_VERIFIED') : 'NOT_ADDED',
      businessVerification: isSupplier ? (user.kycStatus || 'NOT_SUBMITTED') : null,
      businessVerificationNote: isSupplier && user.kycStatus === 'REJECTED' ? (user.kycRejectionReason || null) : null,
    },
    connectedAccounts: [
      {
        provider: 'google',
        label: 'Google',
        connected: Boolean(user.googleId),
        // Google accounts are linked by matching email address, so the connected email is the account email
        email: user.googleId ? maskEmail(user.email) : null,
        // Email one-time codes always remain available as a sign-in method
        canDisconnect: false,
      },
    ],
    tax: isBuyer || isSupplier
      ? {
        legalBusinessName: user.company || null,
        gstin: user.gstin ? maskIdentifier(user.gstin) : null,
        gstStatus: user.gstStatus || null,
        pan: user.pan ? maskIdentifier(user.pan) : null,
        panAadhaarStatus: user.panAadhaarStatus || 'NOT_STARTED',
        billingAddress: [user.businessAddress, user.city, user.state, user.postalCode].filter(Boolean).join(', ') || null,
        // Suppliers change tax details through Business Verification; values are not edited here
        managedBy: isSupplier ? 'BUSINESS_VERIFICATION' : 'GST_VERIFICATION',
      }
      : null,
  };
}

/** Ordinary profile fields only. Email, phone, GSTIN, role and verification fields are not accepted. */
export async function updateAccountProfile(userId, role, { name, company, city }) {
  const data = {};
  if (name !== undefined) {
    const clean = String(name || '').replace(/\s+/g, ' ').trim();
    if (clean.length < 2 || clean.length > 80) {
      const error = new Error('Full name must be between 2 and 80 characters.');
      error.statusCode = 400;
      throw error;
    }
    data.name = clean;
  }
  // A buyer's company name is profile information; a supplier's legal company name is a verified business detail
  if (company !== undefined && role === 'BUYER') {
    const clean = String(company || '').trim();
    if (clean.length > 120) {
      const error = new Error('Company name must be at most 120 characters.');
      error.statusCode = 400;
      throw error;
    }
    data.company = clean || null;
  }
  if (city !== undefined && role !== 'SUPER_ADMIN') {
    const clean = String(city || '').trim();
    if (clean.length > 80) {
      const error = new Error('City must be at most 80 characters.');
      error.statusCode = 400;
      throw error;
    }
    data.city = clean || null;
  }
  if (!Object.keys(data).length) {
    const error = new Error('Nothing to update.');
    error.statusCode = 400;
    throw error;
  }

  await prisma.user.update({ where: { id: userId }, data });
  return getAccountSettings(userId);
}

// Profile photos: images only, checked by content (not just the file name), at most 2 MB
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const IMAGE_SIGNATURES = [
  { ext: '.png', test: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: '.jpg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: '.webp', test: (b) => b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' },
];

export async function saveAvatar(userId, file, publicBaseUrl) {
  if (!file?.buffer?.length) {
    const error = new Error('Choose an image to upload.');
    error.statusCode = 400;
    throw error;
  }
  if (file.buffer.length > MAX_AVATAR_BYTES) {
    const error = new Error('Profile photos must be 2 MB or smaller.');
    error.statusCode = 400;
    throw error;
  }
  const kind = IMAGE_SIGNATURES.find((signature) => signature.test(file.buffer));
  if (!kind) {
    const error = new Error('Profile photos must be PNG, JPG or WEBP images.');
    error.statusCode = 400;
    throw error;
  }

  const fileName = `avatar_${crypto.randomBytes(12).toString('hex')}${kind.ext}`;
  await fs.promises.writeFile(path.join(uploadDir, fileName), file.buffer);
  await prisma.user.update({ where: { id: userId }, data: { avatarUrl: `${publicBaseUrl}/uploads/${fileName}` } });
  return getAccountSettings(userId);
}

export async function removeAvatar(userId) {
  await prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
  return getAccountSettings(userId);
}
