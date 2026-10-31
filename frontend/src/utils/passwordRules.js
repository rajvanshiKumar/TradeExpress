/**
 * Frontend Standard Password Rules for TradeExpress
 *
 * Rules:
 * - Minimum 8 characters, maximum 64 characters
 * - At least one uppercase letter (A–Z)
 * - At least one lowercase letter (a–z)
 * - At least one numeric digit (0–9)
 * - At least one special character (@#$!%&*)
 * - No spaces allowed
 * - Reject passwords containing unsupported characters
 * - Never trim or silently modify passwords
 */

export const ALLOWED_SPECIAL_CHARS = '@#$!%&*';
export const SUPPORTED_CHARACTERS_REGEX = /^[A-Za-z0-9@#$!%&*]+$/;

export const PASSWORD_CRITERIA = [
  { id: 'length', label: '8 to 64 characters', test: (p) => p.length >= 8 && p.length <= 64 },
  { id: 'upper', label: 'At least one uppercase letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'At least one lowercase letter (a–z)', test: (p) => /[a-z]/.test(p) },
  { id: 'number', label: 'At least one numeric digit (0–9)', test: (p) => /[0-9]/.test(p) },
  { id: 'special', label: 'At least one special character (@#$!%&*)', test: (p) => /[@#$!%&*]/.test(p) },
  { id: 'chars', label: 'No spaces or unsupported characters', test: (p) => p.length > 0 && !/\s/.test(p) && SUPPORTED_CHARACTERS_REGEX.test(p) },
];

export function validatePassword(password) {
  if (typeof password !== 'string') {
    return {
      isValid: false,
      message: 'Password is required.',
      errors: ['Password is required.'],
    };
  }

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

  const isValid = errors.length === 0;
  return {
    isValid,
    message: isValid ? '' : errors[0],
    errors,
  };
}

export function evaluatePassword(password = '', confirmPassword = null) {
  const p = typeof password === 'string' ? password : '';
  const results = PASSWORD_CRITERIA.map((criterion) => ({
    ...criterion,
    passed: criterion.test(p),
  }));

  const val = validatePassword(p);
  const allPassed = val.isValid;
  const hasStarted = p.length > 0;

  let confirmMatch = null;
  let confirmMessage = '';
  if (confirmPassword !== null && confirmPassword !== undefined) {
    const cp = typeof confirmPassword === 'string' ? confirmPassword : '';
    if (cp.length === 0) {
      confirmMatch = null;
      confirmMessage = '';
    } else if (cp === p) {
      confirmMatch = true;
      confirmMessage = 'Passwords match';
    } else {
      confirmMatch = false;
      confirmMessage = 'Passwords do not match';
    }
  }

  return {
    results,
    allPassed,
    hasStarted,
    confirmMatch,
    confirmMessage,
    error: val.message,
    errors: val.errors,
  };
}
