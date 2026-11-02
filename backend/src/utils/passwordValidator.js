/**
 * Standard Password Validation for TradeExpress Enterprise
 *
 * Rules enforced:
 * - Minimum 8 characters.
 * - Maximum 64 characters.
 * - At least one uppercase letter (A–Z).
 * - At least one lowercase letter (a–z).
 * - At least one numeric digit (0–9).
 * - At least one special character (@#$!%&*).
 * - No spaces allowed.
 * - Reject passwords containing unsupported characters (permitted: A-Z, a-z, 0-9, @#$!%&*).
 * - Never trim or silently modify passwords.
 */

export const ALLOWED_SPECIAL_CHARS = '@#$!%&*';
export const SUPPORTED_CHARACTERS_REGEX = /^[A-Za-z0-9@#$!%&*]+$/;

export function validatePassword(password) {
  if (typeof password !== 'string') {
    return {
      isValid: false,
      message: 'Password must be a valid string.',
      errors: ['Password must be a valid string.'],
    };
  }

  // Never trim or silently modify passwords; inspect the exact raw string
  const errors = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long.');
  }

  if (password.length > 64) {
    errors.push('Password must not exceed 64 characters.');
  }

  if (/\s/.test(password)) {
    errors.push('Password must not contain any spaces.');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A–Z).');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a–z).');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one numeric digit (0–9).');
  }

  if (!/[@#$!%&*]/.test(password)) {
    errors.push('Password must contain at least one special character (@#$!%&*).');
  }

  if (!SUPPORTED_CHARACTERS_REGEX.test(password)) {
    errors.push('Password contains unsupported characters. Permitted special characters are: @#$!%&*');
  }

  return {
    isValid: errors.length === 0,
    message: errors[0] || '',
    errors,
  };
}

export function isPasswordValid(password) {
  return validatePassword(password).isValid;
}

export default {
  ALLOWED_SPECIAL_CHARS,
  SUPPORTED_CHARACTERS_REGEX,
  validatePassword,
  isPasswordValid,
};

