import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { issueLoginToken } from './sessionService.js';
import { normalizeMobile, validateVerifiedMobile, validateVerifiedEmail, validateEmailLoginOtp, issueVerifiedEmailToken } from './otpService.js';
import { resolveSignupGstin, resolveSignupPanAadhaar } from './verificationService.js';
import { getVerifiedGoogleProfile } from './googleAuthService.js';
import { validatePassword } from '../utils/passwordValidator.js';
import {
  AUTH_ERROR_CODES,
  AUTH_MESSAGES,
  assertCanSignIn,
  authError,
  canResumeSignup,
  existingAccountError,
} from '../utils/accountStatus.js';

// Fields needed to decide whether an existing email belongs to a complete or resumable signup
const SIGNUP_STATUS_SELECT = { id: true, role: true, name: true, phone: true, company: true, passwordHash: true, supplierCode: true };
const AUTH_USER_SELECT = {
  id: true,
  email: true,
  passwordHash: true,
  name: true,
  role: true,
  adminRole: true,
  adminPermissions: true,
  isActive: true,
  status: true,
  statusReason: true,
  company: true,
  phone: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  supplierCode: true,
  businessType: true,
  businessTypeOther: true,
  gstStatus: true,
  gstin: true,
  businessPhone: true,
  yearEstablished: true,
  companyDescription: true,
  logoUrl: true,
  businessImages: true,
  businessAddress: true,
  factoryAddress: true,
  factoryAddressSame: true,
  panAadhaarStatus: true,
  panAadhaarLinked: true,
  panAadhaarCheckedAt: true,
  panAadhaarMaskedPan: true,
  warehouseAddress: true,
  warehouseState: true,
  warehousePincode: true,
  kycStatus: true,
  kycRejectionReason: true,
  isVerified: true,
  isPhoneVerified: true,
  createdAt: true,
  updatedAt: true,
  googleId: true,
  avatarUrl: true,
};
const BUYER_AUTH_RESPONSE_SELECT = {
  id: true,
  email: true,
  passwordHash: true,
  name: true,
  role: true,
  isActive: true,
  status: true,
  company: true,
  phone: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  kycStatus: true,
  kycRejectionReason: true,
  isVerified: true,
  isPhoneVerified: true,
  createdAt: true,
};

/** Maps a unique-constraint race on users.email to the same message as the pre-check. */
function rethrowDuplicateEmail(error) {
  if (error?.code === 'P2002') {
    throw authError(AUTH_MESSAGES.ACCOUNT_EXISTS, 409, AUTH_ERROR_CODES.ACCOUNT_EXISTS);
  }
  throw error;
}

export async function registerUser({ email, password, name, role = 'BUYER', company, companyName, phone, city, country, verificationToken, emailVerificationToken }) {
  const upperRole = (role || 'BUYER').toUpperCase();
  if (!['BUYER', 'SUPPLIER'].includes(upperRole)) {
    const error = new Error('Invalid account type. Only Buyer and Supplier accounts can be created.');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = (email || '').toLowerCase().trim();
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: SIGNUP_STATUS_SELECT,
  });

  if (existing) {
    throw existingAccountError(existing, upperRole);
  }

  if (!phone) {
    const error = new Error('Mobile number is required.');
    error.statusCode = 400;
    throw error;
  }

  const normalized = normalizeMobile(phone, country || 'India');
  const storedPhone = normalized.ok ? normalized.formattedPhone : phone;

  // Every public Buyer registration must prove both contact channels before account creation.
  const requireMobileOtp = upperRole === 'BUYER' || process.env.REQUIRE_MOBILE_OTP === 'true';
  if (requireMobileOtp) {
    if (!normalized.ok) {
      const error = new Error('Enter a valid mobile number.');
      error.statusCode = 400;
      throw error;
    }
    if (!verificationToken) {
      const error = new Error('Mobile verification is required. Please verify via OTP.');
      error.statusCode = 400;
      throw error;
    }
  }
  if (upperRole === 'BUYER') {
    if (!emailVerificationToken) {
      const error = new Error('Email verification is required. Please verify via OTP.');
      error.statusCode = 403;
      throw error;
    }
    validateVerifiedEmail({ email: normalizedEmail, verificationToken: emailVerificationToken });
  }
  if (requireMobileOtp) {
    await validateVerifiedMobile({ phone: storedPhone, country: country || 'India', verificationToken });
  }

  // Double check mobile uniqueness
  const existingPhone = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: storedPhone },
        ...(normalized.msg91Mobile ? [{ phone: normalized.msg91Mobile }, { phone: `+${normalized.msg91Mobile}` }] : []),
      ],
    },
  });

  if (existingPhone) {
    const error = new Error('An account with this mobile number already exists.');
    error.statusCode = 409;
    throw error;
  }

  const passCheck = validatePassword(password);
  if (!passCheck.isValid) {
    const error = new Error(passCheck.message);
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name,
      role: upperRole,
      company: company || companyName || '',
      phone: storedPhone,
      city: city || '',
      country: country || 'India',
      isPhoneVerified: true,
      isVerified: Boolean(emailVerificationToken),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      company: true,
      phone: true,
      city: true,
      country: true,
      isPhoneVerified: true,
      isVerified: true,
      createdAt: true,
    },
  }).catch(rethrowDuplicateEmail);

  const token = await issueLoginToken(user, { method: 'SIGNUP' });
  return { user, token };
}

const GOOGLE_USER_SELECT = {
  id: true, email: true, name: true, role: true, company: true, phone: true, city: true, country: true, status: true,
  isActive: true, statusReason: true, passwordHash: true, googleId: true, avatarUrl: true, isVerified: true, kycStatus: true, createdAt: true,
};

const publicGoogleUser = ({ passwordHash, statusReason, isActive, ...user }) => user; // eslint-disable-line no-unused-vars

/**
 * Google Sign-In. `code` is the one-time authorization code from Google's account chooser; the
 * identity used here comes only from Google's verified ID token (see googleAuthService).
 *
 * - Existing Buyer/Supplier: signed in (and linked to this Google account on first use).
 * - New user signing in as a Buyer: a Buyer account is created from the Google profile.
 * - New user signing in as a Supplier: supplier details (company, GST, ...) are still needed, so the
 *   result is SUPPLIER_SIGNUP_REQUIRED with the Google-verified email for the signup form.
 * - Admin and Super Admin accounts can never sign in through public Google sign-in.
 */
export async function authenticateGoogle({ code, role }) {
  const requestedRole = String(role || 'BUYER').toUpperCase() === 'SUPPLIER' ? 'SUPPLIER' : 'BUYER';
  const profile = await getVerifiedGoogleProfile(code);

  // A Google account is matched by its stable id first, then by its verified email
  let user = await prisma.user.findFirst({ where: { googleId: profile.googleId }, select: GOOGLE_USER_SELECT })
    || await prisma.user.findUnique({ where: { email: profile.email }, select: GOOGLE_USER_SELECT });

  if (user) {
    if (!['BUYER', 'SUPPLIER'].includes(user.role)) {
      throw authError('This account cannot use Google sign-in here. Please use the administrator sign-in page.', 403, AUTH_ERROR_CODES.ROLE_MISMATCH);
    }
    if (user.googleId && user.googleId !== profile.googleId) {
      throw authError('This email is linked to a different Google account.', 409, AUTH_ERROR_CODES.ACCOUNT_EXISTS);
    }
    assertCanSignIn(user, { role: requestedRole, via: 'email' });

    // Link the Google identity on first use; Google has verified the email address
    if (!user.googleId || (!user.avatarUrl && profile.picture) || !user.isVerified) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.googleId, isVerified: true, ...(!user.avatarUrl && profile.picture ? { avatarUrl: profile.picture } : {}) },
        select: GOOGLE_USER_SELECT,
      });
    }
    const token = await issueLoginToken(user, { method: 'GOOGLE' });
    return { status: 'SIGNED_IN', isNewUser: false, user: publicGoogleUser(user), token };
  }

  if (requestedRole === 'SUPPLIER') {
    return {
      status: 'SUPPLIER_SIGNUP_REQUIRED',
      email: profile.email,
      name: profile.name,
      emailVerificationToken: issueVerifiedEmailToken(profile.email),
    };
  }

  // New buyer: no password is chosen with Google, so an unusable random one is stored
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  const created = await prisma.user.create({
    data: {
      email: profile.email,
      passwordHash,
      name: profile.name,
      role: 'BUYER',
      googleId: profile.googleId,
      avatarUrl: profile.picture,
      isVerified: true,
      isPhoneVerified: false,
      country: 'India',
      status: 'ACTIVE',
    },
    select: GOOGLE_USER_SELECT,
  }).catch(rethrowDuplicateEmail);

  import('./auditService.js')
    .then(({ logAuditAction }) => logAuditAction({ action: 'BUYER_REGISTERED', resource: 'USERS', targetId: created.id, details: { method: 'GOOGLE' } }))
    .catch(() => {});

  const token = await issueLoginToken(created, { method: 'GOOGLE' });
  return { status: 'SIGNED_IN', isNewUser: true, user: publicGoogleUser(created), token };
}

/**
 * Production-ready Enterprise Buyer Registration
 * Strictly assigns Role.BUYER on the server.
 */
export async function registerBuyer({
  name,
  email,
  password,
  confirmPassword,
  company,
  companyName,
  phone,
  country = 'India',
  state,
  city,
  postalCode,
  businessAddress,
  buyerType,
  buyerTypes,
  buyerTypeOther,
  businessDescription,
  gstStatus,
  gstin,
  pan,
  panNumber,
  taxId,
  aadhaarNumber,
  aadhaarLast4,
  aadhaarConsent = false,
  panAadhaarStatus = 'NOT_STARTED',
  panAadhaarLinked = false,
  panAadhaarToken,
  verificationToken,
  emailVerificationToken,
  isGoogleVerified = false,
  agree = true,
  agreeTerms = true,
  req,
}) {
  // 1. Validate required fields
  if (!name || name.trim().length < 2) {
    const error = new Error('Full name is required (minimum 2 characters).');
    error.statusCode = 400;
    throw error;
  }

  const legalCompany = (company || companyName || (name ? `${name.trim()}'s Business` : 'Individual Buyer')).trim();

  const normalizedEmail = (email || '').toLowerCase().trim();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i.test(normalizedEmail)) {
    const error = new Error('A valid business email address is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!phone) {
    const error = new Error('Mobile number is required.');
    error.statusCode = 400;
    throw error;
  }

  const normalized = normalizeMobile(phone, country);
  if (!normalized.ok) {
    const error = new Error('Enter a valid mobile number.');
    error.statusCode = 400;
    throw error;
  }
  const storedPhone = normalized.formattedPhone;
  const phoneValues = [...new Set([storedPhone, normalized.msg91Mobile, `+${normalized.msg91Mobile}`, normalized.national])];

  // Run uniqueness checks concurrently
  const [existingEmail, existingPhone] = await Promise.all([
    prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: SIGNUP_STATUS_SELECT,
    }),
    prisma.user.findFirst({
      where: { phone: { in: phoneValues } },
      select: { id: true },
    }),
  ]);

  // An unfinished Buyer signup for this email is completed in place instead of creating a duplicate,
  // but only after the email address has been re-verified with OTP.
  let resumeUser = null;
  if (existingEmail) {
    if (!canResumeSignup(existingEmail, 'BUYER')) {
      throw existingAccountError(existingEmail, 'BUYER');
    }
    resumeUser = existingEmail;
  }

  if (existingPhone && existingPhone.id !== resumeUser?.id) {
    const error = new Error('An account with this mobile number already exists. Please sign in or use another number.');
    error.statusCode = 409;
    throw error;
  }

  // Buyer signup does not ask for a password: buyers sign in with an email / mobile code or Google, and can set a
  // password later in Account Settings. Without one, a long random password nobody knows is stored. A password that
  // is supplied is still fully validated.
  const passwordProvided = Boolean(password);
  const effectivePassword = passwordProvided ? password : `TradeExp_${crypto.randomBytes(24).toString('hex')}!Aa1`;
  if (passwordProvided) {
    const passCheck = validatePassword(effectivePassword);
    if (!passCheck.isValid) {
      const error = new Error(passCheck.message);
      error.statusCode = 400;
      throw error;
    }
    if (!confirmPassword || effectivePassword !== confirmPassword) {
      const error = new Error('Password and confirm password do not match.');
      error.statusCode = 400;
      throw error;
    }
  }

  if (!verificationToken || !emailVerificationToken) {
    const error = new Error('Please verify both your email address and mobile number before registering.');
    error.statusCode = 403;
    throw error;
  }

  validateVerifiedEmail({ email: normalizedEmail, verificationToken: emailVerificationToken });
  await validateVerifiedMobile({ phone: storedPhone, country, verificationToken });

  // Buyer Type
  const rawBuyerType = Array.isArray(buyerTypes) && buyerTypes.length > 0
    ? buyerTypes.join(', ')
    : (buyerType || 'Verified B2B Buyer');

  const isOther = rawBuyerType === 'Other' || rawBuyerType.includes('Other');

  // Country and Address resolution
  const isIndia = (country || 'India').trim().toLowerCase() === 'india';
  const resolvedCountry = country || 'India';
  const resolvedState = state ? state.trim() : (isIndia ? 'Maharashtra' : 'International');
  const resolvedCity = city ? city.trim() : (isIndia ? 'Mumbai' : 'Default City');
  const resolvedPostal = postalCode ? postalCode.trim() : (isIndia ? '400001' : '00000');
  const resolvedAddress = (businessAddress && businessAddress.trim()) || `${resolvedCity}, ${resolvedState} - ${resolvedPostal}`;

  // Tax & Identity Details (PAN & Aadhaar)
  let cleanGstin = null;
  let cleanPan = null;
  const rawGstin = gstin || '';
  const rawPan = pan || panNumber || '';

  if (rawPan && rawPan.trim()) {
    cleanPan = rawPan.trim().toUpperCase();
  }

  // Aadhaar Data Minimization
  let cleanAadhaarLast4 = null;
  if (aadhaarNumber) {
    cleanAadhaarLast4 = String(aadhaarNumber).replace(/\D/g, '').slice(-4);
  } else if (aadhaarLast4) {
    cleanAadhaarLast4 = String(aadhaarLast4).replace(/\D/g, '').slice(-4);
  }

  if (rawGstin && rawGstin.trim()) {
    cleanGstin = rawGstin.trim().toUpperCase();
  }

  // PAN–Aadhaar status comes only from a server-issued verification token for these exact numbers
  const panAadhaar = resolveSignupPanAadhaar({
    token: panAadhaarToken,
    aadhaarNumber,
    pan: cleanPan,
    claimedLinked: panAadhaarStatus === 'LINKED' || panAadhaarLinked === true || panAadhaarLinked === 'true',
  });

  // Terms and Privacy acceptance
  const acceptedTerms = agree === true || agree === 'true' || agreeTerms === true || agreeTerms === 'true';
  if (!acceptedTerms) {
    const error = new Error('You must accept the Buyer Terms of Service and Privacy Notice to proceed.');
    error.statusCode = 400;
    throw error;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(effectivePassword, 10);

  // Generate unique buyer code
  const randomSuffix = `${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
  const buyerCode = `BYR-${randomSuffix}`;

  // Persist User with strictly server-assigned Role.BUYER
  const buyerData = {
    email: normalizedEmail,
    passwordHash,
    name: name.trim(),
    role: 'BUYER',
    company: legalCompany,
    phone: storedPhone,
    city: resolvedCity,
    state: resolvedState,
    postalCode: resolvedPostal,
    country: resolvedCountry,
    businessType: rawBuyerType,
    businessTypeOther: isOther ? (buyerTypeOther || '').trim() : null,
    gstStatus: isIndia ? (gstStatus || 'Not Registered / Not Applicable') : null,
    gstin: cleanGstin,
    pan: cleanPan,
    taxId: (taxId || cleanGstin || cleanPan || '').trim() || null,
    companyDescription: (businessDescription || '').trim() || null,
    businessAddress: resolvedAddress,
    aadhaarConsent: Boolean(aadhaarConsent),
    aadhaarLast4: cleanAadhaarLast4,
    ...panAadhaar,
    status: 'ACTIVE',
    isVerified: true,
    isPhoneVerified: true,
    kycStatus: panAadhaar.panAadhaarLinked ? 'VERIFIED' : 'PENDING',
  };
  const user = resumeUser
    ? await prisma.user.update({ where: { id: resumeUser.id }, data: buyerData, select: BUYER_AUTH_RESPONSE_SELECT })
    : await prisma.user.create({ data: buyerData, select: BUYER_AUTH_RESPONSE_SELECT }).catch(rethrowDuplicateEmail);

  // Save a default address only when the buyer really entered one: the resolved city/state/PIN
  // defaults above are placeholders and must never appear in the address book.
  const providedFullAddress = Boolean(businessAddress?.trim() && city?.trim() && postalCode?.trim());
  try {
    const hasAddress = resumeUser ? (await prisma.address.count({ where: { userId: user.id } })) > 0 : false;
    if (providedFullAddress && !hasAddress) await prisma.address.create({
      data: {
        userId: user.id,
        label: 'Registered Office',
        name: name.trim(),
        company: legalCompany,
        gstin: cleanGstin,
        phone: storedPhone,
        street: resolvedAddress,
        city: resolvedCity,
        state: resolvedState,
        postalCode: resolvedPostal,
        country: resolvedCountry,
        isDefault: true,
      },
    });
  } catch (addrErr) {
    // Non-blocking fallback
  }

  // Record audit log asynchronously
  import('./auditService.js')
    .then(({ logAuditAction }) =>
      logAuditAction({
        req,
        action: 'BUYER_REGISTERED',
        resource: 'USERS',
        targetId: user.id,
        details: {
          email: user.email,
          company: legalCompany,
          country: resolvedCountry,
          buyerType: rawBuyerType,
          isPhoneVerified: true,
          isEmailVerified: true,
          pan: cleanPan ? `${cleanPan.slice(0, 2)}XXXXXX${cleanPan.slice(-2)}` : null,
          aadhaarLast4: cleanAadhaarLast4,
        },
      })
    )
    .catch(() => {});

  // Generate JWT token
  const token = await issueLoginToken({ ...user, role: 'BUYER' }, { method: 'SIGNUP' });

  // Safe user output (redact passwordHash, mask sensitive PAN)
  const { passwordHash: _, ...safeUser } = user;
  if (safeUser.pan) {
    safeUser.pan = `${safeUser.pan.slice(0, 5)}****${safeUser.pan.slice(-1)}`;
  }

  return {
    user: safeUser,
    buyerCode,
    token,
  };
}

/**
 * Production-ready Enterprise Supplier Registration
 */
export async function registerSupplier({
  name,
  email,
  password,
  confirmPassword,
  company,
  companyName,
  phone,
  country = 'India',
  businessType,
  businessTypeOther,
  gstStatus,
  gstin,
  pan,
  panNumber,
  taxId,
  businessPhone,
  yearEstablished,
  companyDescription,
  logoUrl,
  businessImages,
  state,
  city,
  postalCode,
  businessAddress,
  factoryAddress,
  factoryAddressSame = true,
  aadhaarConsent = false,
  aadhaarNumber,
  aadhaarLast4,
  panAadhaarStatus = 'NOT_STARTED',
  panAadhaarLinked = false,
  panAadhaarToken,
  gstVerificationToken,
  documents = [],
  verificationToken,
  emailVerificationToken,
  agree = true,
  req,
}) {
  // 1. Validate required fields
  if (!name || name.trim().length < 2) {
    const error = new Error('Full name is required (minimum 2 characters).');
    error.statusCode = 400;
    throw error;
  }

  const legalCompany = (company || companyName || '').trim();
  if (!legalCompany || legalCompany.length < 2) {
    const error = new Error('Legal Company Name is required (minimum 2 characters).');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = (email || '').toLowerCase().trim();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i.test(normalizedEmail)) {
    const error = new Error('A valid email address is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!phone) {
    const error = new Error('Mobile number is required.');
    error.statusCode = 400;
    throw error;
  }

  const normalized = normalizeMobile(phone, country);
  const storedPhone = normalized.ok ? normalized.formattedPhone : phone;

  // Run uniqueness checks concurrently with minimized payload
  const [existingEmail, existingPhone] = await Promise.all([
    prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: SIGNUP_STATUS_SELECT,
    }),
    prisma.user.findFirst({
      where: {
        OR: [
          { phone: storedPhone },
          ...(normalized.msg91Mobile ? [{ phone: normalized.msg91Mobile }, { phone: `+${normalized.msg91Mobile}` }] : []),
        ],
      },
      select: { id: true },
    }),
  ]);

  // An unfinished Supplier signup for this email is completed in place instead of creating a duplicate,
  // but only after the email address has been re-verified with OTP.
  let resumeUser = null;
  if (existingEmail) {
    if (!canResumeSignup(existingEmail, 'SUPPLIER')) {
      throw existingAccountError(existingEmail, 'SUPPLIER');
    }
    validateVerifiedEmail({ email: normalizedEmail, verificationToken: emailVerificationToken });
    resumeUser = existingEmail;
  } else {
    // A new supplier must also have verified the email address (OTP or Google) before the account is created
    validateVerifiedEmail({ email: normalizedEmail, verificationToken: emailVerificationToken });
  }

  if (existingPhone && existingPhone.id !== resumeUser?.id) {
    const error = new Error('An account with this mobile number already exists.');
    error.statusCode = 409;
    throw error;
  }

  // Password validation
  const passCheck = validatePassword(password);
  if (!passCheck.isValid) {
    const error = new Error(passCheck.message);
    error.statusCode = 400;
    throw error;
  }
  if (confirmPassword && password !== confirmPassword) {
    const error = new Error('Password and confirm password do not match.');
    error.statusCode = 400;
    throw error;
  }

  // Business Type
  if (!businessType) {
    const error = new Error('Business Type is required.');
    error.statusCode = 400;
    throw error;
  }
  if (businessType === 'Other' && (!businessTypeOther || !businessTypeOther.trim())) {
    const error = new Error('Please specify your business type description.');
    error.statusCode = 400;
    throw error;
  }

  // Country-based GST & Tax rules
  const isIndia = (country || 'India').trim().toLowerCase() === 'india';
  let cleanGstin = null;
  let cleanPan = null;
  const isGstDoc = businessType === 'GST Certificate' || gstStatus === 'GST Certificate';
  const rawGstin = gstin || (isIndia && isGstDoc ? taxId : '');
  const rawPan = pan || panNumber;

  if (isIndia) {
    // Indian GST handling
    const taxableGstStatuses = [
      'Regular GST Registration',
      'Composition Scheme',
      'Casual Taxable Person',
      'Non-Resident Taxable Person',
      'Input Service Distributor (ISD)',
      'SEZ Unit',
      'SEZ Developer',
      'TDS Deductor',
      'TCS Collector',
      'GST Certificate',
    ];

    if (taxableGstStatuses.includes(gstStatus)) {
      if (!rawGstin || !rawGstin.trim()) {
        const error = new Error(`GSTIN is required for ${gstStatus}.`);
        error.statusCode = 400;
        throw error;
      }
      cleanGstin = rawGstin.trim().toUpperCase();
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(cleanGstin)) {
        const error = new Error('Invalid Indian GSTIN format. Expected 15-character alphanumeric format.');
        error.statusCode = 400;
        throw error;
      }
    } else if (rawGstin && rawGstin.trim()) {
      cleanGstin = rawGstin.trim().toUpperCase();
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(cleanGstin)) {
        const error = new Error('Invalid Indian GSTIN format.');
        error.statusCode = 400;
        throw error;
      }
    }

    if (rawPan && rawPan.trim()) {
      cleanPan = rawPan.trim().toUpperCase();
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(cleanPan)) {
        const error = new Error('Invalid Indian PAN format. Expected 10-character format (e.g. ABCDE1234F).');
        error.statusCode = 400;
        throw error;
      }
    }
  } else if (rawPan && rawPan.trim()) {
    cleanPan = rawPan.trim().toUpperCase();
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(cleanPan)) {
      const error = new Error('Invalid PAN format. Expected 10-character alphanumeric format.');
      error.statusCode = 400;
      throw error;
    }
  }

  // Statutory Aadhaar Validation & Data Minimization (India & UIDAI compliance)
  let cleanAadhaarLast4 = null;
  if (aadhaarNumber) {
    const rawDigits = String(aadhaarNumber).replace(/\D/g, '');
    if (rawDigits.length !== 12) {
      const error = new Error('Invalid Aadhaar Card format. Expected a 12-digit number.');
      error.statusCode = 400;
      throw error;
    }
    // Under applicable data protection laws, never store full 12-digit Aadhaar; only retain masked last 4 digits
    cleanAadhaarLast4 = rawDigits.slice(-4);
  } else if (aadhaarLast4) {
    cleanAadhaarLast4 = String(aadhaarLast4).replace(/\D/g, '').slice(-4);
  }

  // PAN–Aadhaar status comes only from a server-issued verification token for these exact numbers
  const panAadhaar = resolveSignupPanAadhaar({
    token: panAadhaarToken,
    aadhaarNumber,
    pan: cleanPan,
    claimedLinked: panAadhaarStatus === 'LINKED' || panAadhaarLinked === true || panAadhaarLinked === 'true',
  });

  // A GST Certificate GSTIN must have been verified as active with the GST provider for this exact GSTIN
  if (isIndia && isGstDoc) {
    resolveSignupGstin({ token: gstVerificationToken, gstin: cleanGstin });
  } else if (isIndia && businessType) {
    // Other certificates have no verification service: the number must match its published format
    const certificate = String(taxId || '').trim().toUpperCase();
    const udyam = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;
    const udyogAadhaar = /^[A-Z]{2}\d{2}[A-Z]\d{7}$/;
    const formats = {
      'Udyam Certificate': [udyam],
      'MSME Certificate': [udyam, udyogAadhaar],
      'Udyog Aadhaar': [udyogAadhaar],
    };
    const patterns = formats[businessType] || [/^[A-Z0-9][A-Z0-9/-]{3,29}$/];
    if (!certificate || !patterns.some((pattern) => pattern.test(certificate))) {
      const error = new Error(`Enter a valid ${businessType === 'Other' ? (businessTypeOther || 'certificate') : businessType} number.`);
      error.statusCode = 400;
      throw error;
    }
  }

  // Office phone (optional): digits only, 10 digits
  const cleanBusinessPhone = businessPhone ? String(businessPhone).replace(/\D/g, '') : '';
  if (cleanBusinessPhone && cleanBusinessPhone.length !== 10) {
    const error = new Error('Office phone number must be exactly 10 digits.');
    error.statusCode = 400;
    throw error;
  }

  // Year established validation
  let parsedYear = null;
  if (yearEstablished) {
    parsedYear = parseInt(yearEstablished, 10);
    const currentYear = new Date().getFullYear();
    if (!/^\d{4}$/.test(String(yearEstablished).trim()) || parsedYear < 1900 || parsedYear > currentYear) {
      const error = new Error(`Year established must be between 1900 and ${currentYear}.`);
      error.statusCode = 400;
      throw error;
    }
  }

  // Company description
  const cleanDesc = (companyDescription || '').trim();
  if (!cleanDesc || cleanDesc.length < 10) {
    const error = new Error('Company description is required (at least 10 characters).');
    error.statusCode = 400;
    throw error;
  }

  // Address validation
  if (!country) {
    const error = new Error('Country is required.');
    error.statusCode = 400;
    throw error;
  }

  if (isIndia) {
    if (!state || !state.trim()) {
      const error = new Error('State / Union Territory is required.');
      error.statusCode = 400;
      throw error;
    }
    if (!city || !city.trim()) {
      const error = new Error('City is required.');
      error.statusCode = 400;
      throw error;
    }
    if (!postalCode || !postalCode.trim()) {
      const error = new Error('PIN Code is required.');
      error.statusCode = 400;
      throw error;
    }
    if (!/^[1-9][0-9]{5}$/.test(postalCode.trim())) {
      const error = new Error('Please enter a valid 6-digit Indian PIN Code.');
      error.statusCode = 400;
      throw error;
    }
  } else {
    // Non-India supplier only provides Registered Business Address (no state, pin, city)
    if (!businessAddress || !businessAddress.trim()) {
      const error = new Error('Registered Business Address is required.');
      error.statusCode = 400;
      throw error;
    }
  }

  const effectiveBusinessAddress = (businessAddress && businessAddress.trim())
    || (isIndia ? `${city.trim()}, ${state.trim()} - ${postalCode.trim()}` : '');

  if (!effectiveBusinessAddress) {
    const error = new Error(isIndia ? 'Address details are required.' : 'Full Business Address is required.');
    error.statusCode = 400;
    throw error;
  }

  const sameFactory = factoryAddressSame !== false && factoryAddressSame !== 'false';
  const cleanFactory = sameFactory ? effectiveBusinessAddress : (factoryAddress || '').trim() || effectiveBusinessAddress;
  if (!sameFactory && !cleanFactory) {
    const error = new Error('Factory Address is required when factory address is different from business address.');
    error.statusCode = 400;
    throw error;
  }

  // Terms and Privacy acceptance
  if (!agree) {
    const error = new Error('You must accept the Supplier Terms and Privacy Notice to proceed.');
    error.statusCode = 400;
    throw error;
  }

  // 2. Generate unique supplier ID with timestamp & random entropy (a resumed signup keeps its code)
  let supplierCode = resumeUser?.supplierCode || null;
  let codeUnique = Boolean(supplierCode);
  let attempts = 0;
  while (!codeUnique && attempts < 5) {
    attempts++;
    const randomSuffix = `${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
    supplierCode = `SUP-${randomSuffix}`;
    const collision = await prisma.user.findUnique({ where: { supplierCode }, select: { id: true } });
    if (!collision) codeUnique = true;
  }
  if (!codeUnique) {
    supplierCode = `SUP-${Date.now().toString().slice(-6)}`;
  }

  // 3. Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // 4. Create User (or complete the unfinished signup in place)
  const supplierWrite = {
    data: {
      email: normalizedEmail,
      passwordHash,
      name: name.trim(),
      role: 'SUPPLIER',
      company: legalCompany,
      phone: storedPhone,
      city: city ? city.trim() : null,
      state: state ? state.trim() : null,
      postalCode: postalCode ? postalCode.trim() : null,
      country: country.trim(),
      supplierCode,
      businessType,
      businessTypeOther: businessType === 'Other' ? (businessTypeOther || '').trim() : null,
      gstStatus: isIndia ? gstStatus : null,
      gstin: cleanGstin,
      pan: cleanPan,
      taxId: (taxId || cleanGstin || '').trim() || null,
      businessPhone: cleanBusinessPhone || null,
      yearEstablished: parsedYear,
      companyDescription: cleanDesc,
      logoUrl: logoUrl || null,
      businessImages: Array.isArray(businessImages) ? businessImages : [],
      businessAddress: effectiveBusinessAddress,
      factoryAddress: cleanFactory,
      factoryAddressSame: sameFactory,
      warehouseAddress: cleanFactory,
      warehouseState: state ? state.trim() : null,
      warehousePincode: postalCode ? postalCode.trim() : null,
      // Only documents uploaded at signup put the seller in the admin review queue
      kycStatus: (Array.isArray(documents) && documents.some((d) => d && d.fileUrl && d.fileName)) ? 'PENDING' : 'NOT_SUBMITTED',
      isVerified: false,
      isPhoneVerified: Boolean(verificationToken),
      aadhaarConsent: Boolean(aadhaarConsent),
      aadhaarLast4: cleanAadhaarLast4,
      ...panAadhaar,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      company: true,
      phone: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
      supplierCode: true,
      businessType: true,
      gstStatus: true,
      gstin: true,
      pan: true,
      aadhaarConsent: true,
      aadhaarLast4: true,
      panAadhaarStatus: true,
      panAadhaarLinked: true,
      panAadhaarMaskedPan: true,
      panAadhaarCheckedAt: true,
      taxId: true,
      companyDescription: true,
      logoUrl: true,
      businessImages: true,
      kycStatus: true,
      isVerified: true,
      isPhoneVerified: true,
      createdAt: true,
    },
  };
  const user = resumeUser
    ? await prisma.user.update({ where: { id: resumeUser.id }, ...supplierWrite })
    : await prisma.user.create(supplierWrite).catch(rethrowDuplicateEmail);

  // 5. Save uploaded KYC / Business Documents if provided
  let validDocsCount = 0;
  if (Array.isArray(documents) && documents.length > 0) {
    const validDocs = documents
      .filter((d) => d && d.fileUrl && d.fileName)
      .map((d) => ({
        userId: user.id,
        docType: d.docType || d.type || 'BUSINESS_REG',
        docNumber: d.docNumber ? String(d.docNumber).trim() : null,
        fileName: String(d.fileName).slice(0, 255),
        fileUrl: String(d.fileUrl),
        fileSize: typeof d.fileSize === 'number' ? d.fileSize : null,
        status: 'PENDING',
      }));

    if (validDocs.length > 0) {
      await prisma.kycDocument.createMany({
        data: validDocs,
      });
      validDocsCount = validDocs.length;
    }
  }

  // 6. Audit log (dispatched asynchronously, non-blocking)
  import('./auditService.js')
    .then(({ logAuditAction }) =>
      logAuditAction({
        req,
        action: 'SUPPLIER_REGISTRATION',
        resource: 'USERS',
        targetId: user.id,
        details: {
          supplierCode,
          company: legalCompany,
          email: normalizedEmail,
          country: country.trim(),
        },
      })
    )
    .catch(() => {});

  const token = await issueLoginToken(user, { method: 'SIGNUP' });
  return {
    user: {
      ...user,
      panNumber: user.pan,
      taxId: user.taxId || user.gstin,
    },
    token,
    supplierCode,
    documentsCount: validDocsCount,
  };
}

export async function loginUser({ email, password, role, otp, country = 'India', isAdminLogin = false }) {
  const identifier = String(email || '').trim();
  const normalizedEmail = identifier.toLowerCase();

  // Support common admin aliases if standard email not found and it is an admin login attempt
  const ADMIN_ALIASES = [
    'admin',
    'admin@tradeexpress.com',
    'admin@tradesphere.com',
    'admin@tradeexpress.example',
    'admin@tradesphere.example',
    'hello.techvunex@gmail.com',
    'superadmin',
    'superadmin@tradeexpress.com',
    'krajvanshi244@gmail.com',
  ];
  const isEmailIdentifier = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || ADMIN_ALIASES.includes(normalizedEmail);
  let loginViaMobile = false;
  let user;
  if (isEmailIdentifier) {
    user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: AUTH_USER_SELECT,
    });
  } else {
    const normalizedMobile = normalizeMobile(identifier, country);
    if (!normalizedMobile.ok) {
      const error = new Error('Enter a valid email address or Indian mobile number.');
      error.statusCode = 400;
      throw error;
    }
    const phoneValues = [...new Set([
      normalizedMobile.formattedPhone,
      normalizedMobile.msg91Mobile,
      `+${normalizedMobile.msg91Mobile}`,
      normalizedMobile.national,
    ])];
    loginViaMobile = true;
    user = await prisma.user.findFirst({
      where: { phone: { in: phoneValues } },
      select: AUTH_USER_SELECT,
    });
  }

  if (!user && (isAdminLogin || ADMIN_ALIASES.includes(normalizedEmail))) {
    user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'krajvanshi244@gmail.com' },
          { role: 'SUPER_ADMIN' },
          { role: 'ADMIN' },
        ],
      },
      select: AUTH_USER_SELECT,
    });
  }

  // Buyer/Supplier sign-in: existence, selected role and signup completion come before credentials
  if (!isAdminLogin && (!user || ['BUYER', 'SUPPLIER'].includes(user.role))) {
    assertCanSignIn(user, { role, via: loginViaMobile ? 'mobile' : 'email' });
  }

  if (!user) {
    const error = new Error(`No account found with this ${loginViaMobile ? 'mobile number' : 'email'}. Please sign up to create your TradeExpress account.`);
    error.statusCode = 401;
    throw error;
  }

  // 1. Role enforcement & public vs admin portal separation
  if (isAdminLogin) {
    // Admin login requested (/super-admin/login): must have admin privileges
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      const error = new Error('Access denied. Administrator privileges are required.');
      error.statusCode = 403;
      throw error;
    }
  }

  if (user.isActive === false || user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
    const error = new Error('Your account is suspended. Reason: ' + (user.statusReason || 'Please contact platform administration.'));
    error.statusCode = 403;
    throw error;
  }

  // 2. Authentication:
  // Primary B2B login uses registered email and password. Optional OTP authentication supported if provided.
  if (!isAdminLogin && ['BUYER', 'SUPPLIER'].includes(user.role)) {
    if (password) {
      const matches = typeof user.passwordHash === 'string' && await bcrypt.compare(password, user.passwordHash);
      if (!matches) {
        const error = new Error('Invalid email or password. Please try again.');
        error.statusCode = 401;
        throw error;
      }
    } else if (otp) {
      // Validate and consume OTP upon successful OTP login
      if (loginViaMobile) {
        const error = new Error('Request a mobile verification code to sign in with an OTP.');
        error.statusCode = 400;
        throw error;
      }
      validateEmailLoginOtp({ email: normalizedEmail, otp, consume: true });
    } else {
      const error = new Error('Password is required to sign in.');
      error.statusCode = 400;
      throw error;
    }
  } else {
    // Admin or password-based login
    const matches = Boolean(password && typeof user.passwordHash === 'string' && await bcrypt.compare(password, user.passwordHash));

    // Admin accounts authenticate only with their stored password (no built-in or shared passwords)

    if (!matches) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      throw error;
    }
  }

  const token = await issueLoginToken(user, { method: isAdminLogin ? 'ADMIN' : (otp ? 'OTP' : 'PASSWORD') });
  const { passwordHash, googleId, ...safeUser } = user; // eslint-disable-line no-unused-vars
  return { user: safeUser, token };
}

export async function getUserProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      company: true,
      phone: true,
      city: true,
      state: true,
      country: true,
      postalCode: true,
      supplierCode: true,
      businessType: true,
      businessTypeOther: true,
      gstStatus: true,
      gstin: true,
      pan: true,
      aadhaarConsent: true,
      aadhaarLast4: true,
      panAadhaarStatus: true,
      panAadhaarLinked: true,
      panAadhaarMaskedPan: true,
      panAadhaarCheckedAt: true,
      businessAddress: true,
      factoryAddress: true,
      factoryAddressSame: true,
      companyDescription: true,
      yearEstablished: true,
      kycStatus: true,
      isVerified: true,
      isPhoneVerified: true,
      addresses: true,
      createdAt: true,
    },
  });

  if (!user) {
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  return user;
}

const PASSWORD_RESET_SENT_MESSAGE = 'If an account with this email exists, password reset instructions have been sent.';

export async function forgotPassword(email) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    // Same answer as for a real account, to avoid email enumeration attacks
    return { success: true, message: PASSWORD_RESET_SENT_MESSAGE };
  }

  // Generate 6-digit OTP and secure random token
  // Unpredictable code and link token (crypto, not Math.random)
  const otp = String(crypto.randomInt(100000, 1000000));
  const token = `ts_rst_${crypto.randomBytes(24).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  // Invalidate any existing unused tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      otp,
      expiresAt,
    },
  });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/forgot-password?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;

  import('./emailService.js').then((m) => {
    m.sendPasswordResetEmail({
      email: normalizedEmail,
      name: user.name,
      resetUrl,
      otp,
    }).catch((e) => console.error('[AuthService] Failed to send reset email:', e.message));
  });

  // The code and link go only to the registered email: returning them here would let anyone reset any account
  return { success: true, message: PASSWORD_RESET_SENT_MESSAGE };
}

export async function resetPassword({ email, token, otp, newPassword }) {
  const passCheck = validatePassword(newPassword);
  if (!passCheck.isValid) {
    const error = new Error(passCheck.message);
    error.statusCode = 400;
    throw error;
  }

  // Plain strings only: an object here would be read by Prisma as a filter and could match another account's token
  const cleanToken = typeof token === 'string' ? token.trim() : '';
  const cleanOtp = typeof otp === 'string' ? otp.trim() : '';
  const cleanEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';

  let resetToken = null;

  if (cleanToken) {
    resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        token: cleanToken,
        used: false,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
  }

  // A 6-digit code is short, so it only counts for the account it was sent to
  if (!resetToken && cleanOtp && cleanEmail) {
    resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        otp: cleanOtp,
        user: { email: cleanEmail },
        used: false,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
  }

  if (!resetToken) {
    const error = new Error('Invalid or expired reset token or OTP code.');
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      // Whoever had the old password is signed out everywhere
      data: { passwordHash, sessionsValidAfter: new Date(Math.ceil(Date.now() / 1000) * 1000) },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    }),
  ]);

  return { success: true, message: 'Password has been successfully reset. You can now log in.' };
}

export async function changePassword({ userId, currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    const error = new Error('Current password does not match.');
    error.statusCode = 400;
    throw error;
  }

  const passCheck = validatePassword(newPassword);
  if (!passCheck.isValid) {
    const error = new Error(passCheck.message);
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return { success: true, message: 'Password changed successfully.' };
}

/**
 * Ordinary profile fields only. Phone number and GSTIN change only through their verified flows
 * (OTP for phone, GST verification for GSTIN), so they are not accepted here.
 */
export async function updateUserProfile(userId, { name, city, country, company }) {
  const data = {};
  if (name) data.name = name.trim();
  if (city) data.city = city.trim();
  if (country) data.country = country.trim();
  if (company !== undefined) data.company = (company || '').trim();

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      company: true,
      phone: true,
      city: true,
      country: true,
      gstin: true,
      pan: true,
      kycStatus: true,
      isVerified: true,
      createdAt: true,
    },
  });

  return user;
}

/* ------------------------------------------------------------------ business verification (KYC) */

// Everything the Business Verification page shows, read from the seller's own user record (filled at signup)
const BUSINESS_PROFILE_SELECT = {
  id: true, email: true, name: true, phone: true, company: true, supplierCode: true, country: true, city: true, state: true, postalCode: true,
  businessType: true, businessTypeOther: true, businessAddress: true, factoryAddress: true, businessPhone: true, yearEstablished: true,
  gstStatus: true, gstin: true, pan: true, aadhaarLast4: true,
  panAadhaarStatus: true, panAadhaarLinked: true, panAadhaarMaskedPan: true, panAadhaarCheckedAt: true,
  bankName: true, bankAccountNumber: true, bankIfsc: true, warehouseAddress: true, warehouseState: true, warehousePincode: true,
  kycStatus: true, kycRejectionReason: true,
  kycDocuments: { orderBy: { createdAt: 'asc' } },
};

const KYC_LOCKED_STATUSES = ['PENDING']; // under review: nothing can change until the admin decides
const VERIFIED_LOCKED_FIELDS = ['gstin', 'pan', 'bankName', 'bankAccountNumber', 'bankIfsc'];

function kycError(message, statusCode = 400, field) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (field) error.errors = [{ field, message }];
  return error;
}

const textOrNull = (value) => (value === undefined || value === null ? null : String(value).trim() || null);

function shapeBusinessVerification(user) {
  const status = user.kycStatus || 'NOT_SUBMITTED';
  return {
    status,
    rejectionReason: user.kycRejectionReason || null,
    editable: {
      profile: !KYC_LOCKED_STATUSES.includes(status),
      statutory: !KYC_LOCKED_STATUSES.includes(status) && status !== 'VERIFIED',
      canSubmit: !KYC_LOCKED_STATUSES.includes(status) && status !== 'VERIFIED',
    },
    supplierCode: user.supplierCode || null,
    business: {
      companyName: user.company || '',
      contactName: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      businessType: user.businessType || '',
      businessTypeOther: user.businessTypeOther || '',
      businessAddress: user.businessAddress || '',
      factoryAddress: user.factoryAddress || '',
      city: user.city || '',
      state: user.state || '',
      postalCode: user.postalCode || '',
      country: user.country || '',
      businessPhone: user.businessPhone || '',
      yearEstablished: user.yearEstablished ? String(user.yearEstablished) : '',
      gstStatus: user.gstStatus || '',
    },
    statutory: {
      gstin: user.gstin || '',
      pan: user.pan || '',
      bankName: user.bankName || '',
      bankAccountNumber: user.bankAccountNumber || '',
      bankIfsc: user.bankIfsc || '',
    },
    warehouse: {
      address: user.warehouseAddress || '',
      state: user.warehouseState || '',
      pincode: user.warehousePincode || '',
    },
    identity: {
      aadhaarLast4: user.aadhaarLast4 || null,
      panAadhaarStatus: user.panAadhaarStatus || 'NOT_STARTED',
      panAadhaarLinked: Boolean(user.panAadhaarLinked),
      panAadhaarMaskedPan: user.panAadhaarMaskedPan || null,
      panAadhaarCheckedAt: user.panAadhaarCheckedAt || null,
    },
    documents: (user.kycDocuments || []).map((doc) => ({
      id: doc.id,
      type: doc.docType,
      reference: doc.docNumber || '',
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      status: doc.status,
      createdAt: doc.createdAt,
    })),
  };
}

/**
 * Validates and normalises the editable fields. Only non-empty values are returned, so a blank form
 * field never overwrites information already on file. Login identity (email, mobile) is not editable here.
 */
function buildBusinessUpdate({ business = {}, statutory = {}, warehouse = {} }) {
  const data = {};
  const put = (key, value) => {
    const text = textOrNull(value);
    if (text !== null) data[key] = text;
  };

  put('company', business.companyName);
  put('name', business.contactName);
  put('businessType', business.businessType);
  put('businessTypeOther', business.businessTypeOther);
  put('businessAddress', business.businessAddress);
  put('factoryAddress', business.factoryAddress);
  put('city', business.city);
  put('state', business.state);
  put('postalCode', business.postalCode);
  put('businessPhone', business.businessPhone);
  put('gstin', statutory.gstin && String(statutory.gstin).toUpperCase());
  put('pan', statutory.pan && String(statutory.pan).toUpperCase());
  put('bankName', statutory.bankName);
  put('bankAccountNumber', statutory.bankAccountNumber && String(statutory.bankAccountNumber).replace(/\s/g, ''));
  put('bankIfsc', statutory.bankIfsc && String(statutory.bankIfsc).toUpperCase());
  put('warehouseAddress', warehouse.address);
  put('warehouseState', warehouse.state);
  put('warehousePincode', warehouse.pincode);

  if (data.company && data.company.length < 2) throw kycError('Business name must be at least 2 characters.', 400, 'companyName');
  if (data.name && data.name.length < 2) throw kycError('Contact person name must be at least 2 characters.', 400, 'contactName');
  if (data.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(data.gstin)) throw kycError('Enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5).', 400, 'gstin');
  if (data.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(data.pan)) throw kycError('Enter a valid 10-character PAN (e.g. ABCDE1234F).', 400, 'pan');
  if (data.bankIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(data.bankIfsc)) throw kycError('Enter a valid 11-character IFSC (e.g. HDFC0001234).', 400, 'bankIfsc');
  if (data.bankAccountNumber && !/^\d{9,18}$/.test(data.bankAccountNumber)) throw kycError('Bank account number must be 9 to 18 digits.', 400, 'bankAccountNumber');
  if (data.postalCode && !/^[1-9][0-9]{5}$/.test(data.postalCode) && !/^[A-Za-z0-9 -]{3,10}$/.test(data.postalCode)) throw kycError('Enter a valid PIN / postal code.', 400, 'postalCode');
  if (data.warehousePincode && !/^[1-9][0-9]{5}$/.test(data.warehousePincode)) throw kycError('Enter a valid 6-digit warehouse PIN code.', 400, 'warehousePincode');

  if (business.yearEstablished !== undefined && business.yearEstablished !== null && String(business.yearEstablished).trim() !== '') {
    const year = parseInt(business.yearEstablished, 10);
    if (!/^\d{4}$/.test(String(business.yearEstablished).trim()) || year < 1900 || year > new Date().getFullYear()) {
      throw kycError(`Year established must be between 1900 and ${new Date().getFullYear()}.`, 400, 'yearEstablished');
    }
    data.yearEstablished = year;
  }
  for (const [key, max] of Object.entries({ company: 120, name: 80, businessAddress: 300, factoryAddress: 300, warehouseAddress: 300, bankName: 80, city: 80, state: 80 })) {
    if (data[key] && data[key].length > max) throw kycError(`${key} must be ${max} characters or fewer.`, 400, key);
  }
  return data;
}

/** The seller's business details and verification state, for the Business Verification page. */
export async function getKycStatus(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: BUSINESS_PROFILE_SELECT });
  if (!user) throw kycError('Account not found.', 404);
  return shapeBusinessVerification(user);
}

/**
 * Saves business details (submit = false) or saves and submits them for admin verification (submit = true).
 * Submitting sets the status to PENDING (In review); only an admin review can make the seller VERIFIED.
 */
export async function submitKyc(userId, { business, statutory, warehouse, documents = [], submit = false } = {}) {
  const updates = buildBusinessUpdate({ business, statutory, warehouse });

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id: userId }, select: BUSINESS_PROFILE_SELECT });
    if (!current) throw kycError('Account not found.', 404);
    const status = current.kycStatus || 'NOT_SUBMITTED';

    if (KYC_LOCKED_STATUSES.includes(status)) {
      throw kycError('Your business verification is under review. Details can be changed once the review is complete.', 409);
    }
    if (status === 'VERIFIED') {
      const changed = VERIFIED_LOCKED_FIELDS.find((key) => updates[key] !== undefined && updates[key] !== (current[key] || null));
      if (changed) throw kycError('Verified tax and bank details cannot be changed here. Please contact TradeExpress support to update them.', 409, changed);
      if (submit) throw kycError('Your business is already verified.', 400);
    }

    // A new PAN invalidates the earlier PAN–Aadhaar result, which was for the previous PAN
    if (updates.pan && updates.pan !== current.pan) {
      Object.assign(updates, { panAadhaarStatus: 'NOT_STARTED', panAadhaarLinked: false, panAadhaarMaskedPan: null, panAadhaarCheckedAt: null });
    }

    // Documents: keep those still listed, add new ones, drop pending ones the seller removed
    const keepIds = new Set((Array.isArray(documents) ? documents : []).filter((d) => d?.id).map((d) => String(d.id)));
    const removable = current.kycDocuments.filter((doc) => !keepIds.has(doc.id) && doc.status === 'PENDING').map((doc) => doc.id);
    if (removable.length) await tx.kycDocument.deleteMany({ where: { id: { in: removable }, userId } });

    const newDocs = (Array.isArray(documents) ? documents : [])
      .filter((d) => d && !d.id && d.fileUrl && d.fileName)
      .map((d) => ({
        userId,
        docType: String(d.type || 'OTHER').trim().slice(0, 80),
        docNumber: textOrNull(d.reference)?.slice(0, 80) ?? null,
        fileName: String(d.fileName).slice(0, 255),
        fileUrl: String(d.fileUrl),
        status: 'PENDING',
      }));
    if (newDocs.length) await tx.kycDocument.createMany({ data: newDocs });

    if (submit) {
      const gstin = updates.gstin ?? current.gstin;
      const docCount = await tx.kycDocument.count({ where: { userId } });
      if (!gstin && docCount === 0) throw kycError('Add your GSTIN or at least one business document before submitting for verification.', 400, 'documents');
      Object.assign(updates, { kycStatus: 'PENDING', kycRejectionReason: null });
    }

    return tx.user.update({ where: { id: userId }, data: updates, select: BUSINESS_PROFILE_SELECT });
  }, { maxWait: 10000, timeout: 20000 }); // several round trips to the remote database

  return shapeBusinessVerification(result);
}

