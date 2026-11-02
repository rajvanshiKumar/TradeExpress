/**
 * Account status checks shared by the login, OTP and registration flows.
 *
 * Every auth error raised here carries an `errorCode` so the frontend can react to the
 * situation (sign up, resume signup, switch role, wait for cooldown) without parsing text.
 */

export const AUTH_ERROR_CODES = {
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  SIGNUP_INCOMPLETE: 'SIGNUP_INCOMPLETE',
  ACCOUNT_EXISTS: 'ACCOUNT_EXISTS',
  ROLE_MISMATCH: 'ROLE_MISMATCH',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  OTP_COOLDOWN: 'OTP_COOLDOWN',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_NOT_REQUESTED: 'OTP_NOT_REQUESTED',
};

const PUBLIC_ROLES = ['BUYER', 'SUPPLIER'];

const ROLE_LABELS = {
  BUYER: 'Buyer',
  SUPPLIER: 'Supplier',
  TRANSPORT_PARTNER: 'Transport Partner',
};

export const AUTH_MESSAGES = {
  EMAIL_NOT_FOUND: 'No account found with this email. Please sign up first.',
  MOBILE_NOT_FOUND: 'No account found with this mobile number. Please sign up first.',
  SIGNUP_INCOMPLETE: 'Your registration is incomplete. Please complete your signup to continue.',
  ACCOUNT_EXISTS: 'An account with this email already exists. Please log in.',
  MOBILE_EXISTS: 'An account with this mobile number already exists. Please log in.',
  OTP_INVALID: 'Invalid OTP. Please enter the correct verification code.',
  OTP_EXPIRED: 'Your OTP has expired. Please request a new one.',
  OTP_NOT_REQUESTED: 'No OTP request found. Please request a new OTP first.',
  otpCooldown: (seconds) => `Please wait ${seconds} seconds before requesting another OTP.`,
  roleMismatch: (role, via = 'email') =>
    `This ${via === 'mobile' ? 'mobile number' : 'email'} is not registered as a ${ROLE_LABELS[role] || 'member'}. Please use the correct login option.`,
  registeredAsOtherRole: (accountRole) =>
    `An account with this email already exists as a ${ROLE_LABELS[accountRole] || 'TradeExpress member'}. Please log in with the correct account type or use a different email.`,
};

export function authError(message, statusCode, errorCode, extra = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  Object.assign(error, extra);
  return error;
}

export function otpCooldownError(waitSeconds) {
  return authError(AUTH_MESSAGES.otpCooldown(waitSeconds), 429, AUTH_ERROR_CODES.OTP_COOLDOWN, {
    cooldownRemaining: waitSeconds,
  });
}

const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

/**
 * A Buyer or Supplier signup is complete once the account can actually be used: it has a
 * name, a mobile number and a password, and suppliers also have a company name.
 * A buyer created through verified Google sign-in may add a mobile number later (e.g. at checkout).
 * Admin and partner accounts are provisioned internally and are always complete.
 */
export function isSignupComplete(user) {
  if (!user) return false;
  if (!PUBLIC_ROLES.includes(user.role)) return true;
  const hasContact = hasText(user.phone) || (user.role === 'BUYER' && hasText(user.googleId));
  if (!hasText(user.name) || !hasContact || !hasText(user.passwordHash)) return false;
  if (user.role === 'SUPPLIER' && !hasText(user.company)) return false;
  return true;
}

/** Normalizes 'supplier' / 'SUPPLIER' to a public role, or null when absent or not public. */
export function normalizePublicRole(role) {
  const upper = String(role || '').trim().toUpperCase();
  return PUBLIC_ROLES.includes(upper) ? upper : null;
}

/**
 * Throws the first applicable sign-in problem for a Buyer/Supplier login attempt, in the order
 * a user needs to see them. Must run before any OTP cooldown check or OTP dispatch.
 */
export function assertCanSignIn(user, { role, via = 'email' } = {}) {
  if (!user) {
    throw authError(
      via === 'mobile' ? AUTH_MESSAGES.MOBILE_NOT_FOUND : AUTH_MESSAGES.EMAIL_NOT_FOUND,
      404,
      AUTH_ERROR_CODES.ACCOUNT_NOT_FOUND
    );
  }

  if (user.isActive === false || user.status === 'SUSPENDED') {
    throw authError(
      'Your account is suspended. Reason: ' + (user.statusReason || 'Please contact platform administration.'),
      403,
      AUTH_ERROR_CODES.ACCOUNT_SUSPENDED
    );
  }

  // Only Buyer and Supplier accounts are bound to a login tab; admin accounts keep their existing behaviour.
  const expectedRole = normalizePublicRole(role);
  if (expectedRole && PUBLIC_ROLES.includes(user.role) && user.role !== expectedRole) {
    throw authError(AUTH_MESSAGES.roleMismatch(expectedRole, via), 403, AUTH_ERROR_CODES.ROLE_MISMATCH, {
      accountRole: user.role,
    });
  }

  if (!isSignupComplete(user)) {
    throw authError(AUTH_MESSAGES.SIGNUP_INCOMPLETE, 409, AUTH_ERROR_CODES.SIGNUP_INCOMPLETE, {
      accountRole: user.role,
    });
  }
}

/**
 * Error for a signup attempt whose email already belongs to an account that cannot be resumed
 * by this signup (a different role, or a completed registration).
 */
export function existingAccountError(user, requestedRole) {
  const expectedRole = normalizePublicRole(requestedRole);
  if (expectedRole && user.role !== expectedRole) {
    const message = PUBLIC_ROLES.includes(user.role)
      ? AUTH_MESSAGES.registeredAsOtherRole(user.role)
      : AUTH_MESSAGES.ACCOUNT_EXISTS;
    return authError(message, 409, AUTH_ERROR_CODES.ROLE_MISMATCH, { accountRole: user.role });
  }
  if (!isSignupComplete(user)) {
    return authError(AUTH_MESSAGES.SIGNUP_INCOMPLETE, 409, AUTH_ERROR_CODES.SIGNUP_INCOMPLETE, {
      accountRole: user.role,
    });
  }
  return authError(AUTH_MESSAGES.ACCOUNT_EXISTS, 409, AUTH_ERROR_CODES.ACCOUNT_EXISTS, { accountRole: user.role });
}

/** True when a signup for `requestedRole` may continue on this existing (incomplete) account. */
export function canResumeSignup(user, requestedRole) {
  return Boolean(user) && user.role === normalizePublicRole(requestedRole) && !isSignupComplete(user);
}
