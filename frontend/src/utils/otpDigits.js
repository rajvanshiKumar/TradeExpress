/**
 * Six-box OTP entry, position-safe.
 *
 * The code is kept as a string where each character is one box, and an empty box is a space. Clearing a box no
 * longer pulls the following digits one place to the left (which turned a corrected genuine code into a wrong one
 * and produced "Invalid OTP"). Trailing empty boxes are trimmed, so a partly typed code is shorter than 6.
 */
export const OTP_LENGTH = 6;
const EMPTY = ' ';

/** The six box values ('' for an empty box). */
export function otpSlots(value = '') {
  const text = String(value || '');
  return Array.from({ length: OTP_LENGTH }, (_, i) => (/\d/.test(text[i] || '') ? text[i] : ''));
}

/** Joins box values back into the stored code string (positions kept, trailing empties trimmed). */
export function joinOtpSlots(slots) {
  return slots.slice(0, OTP_LENGTH).map((d) => (/\d/.test(d || '') ? d : EMPTY)).join('').replace(/\s+$/, '');
}

/** True only when every box holds a digit: the only state that may be sent for verification. */
export function isCompleteOtp(value) {
  return /^\d{6}$/.test(String(value || ''));
}

/**
 * New code string after typing `input` into box `index`. A single digit replaces that box; several digits
 * (autofill / typing into the first box on mobile) fill boxes from `index` onwards; no digit clears the box.
 * Returns { value, focusIndex } where focusIndex is the box to focus next (or null to stay).
 */
export function enterOtpDigits(current, index, input) {
  const slots = otpSlots(current);
  const digits = String(input || '').replace(/\D/g, '');
  if (!digits) {
    slots[index] = '';
    return { value: joinOtpSlots(slots), focusIndex: null };
  }
  if (digits.length > 1) {
    digits.slice(0, OTP_LENGTH).split('').forEach((d, i) => { if (index + i < OTP_LENGTH) slots[index + i] = d; });
    return { value: joinOtpSlots(slots), focusIndex: Math.min(OTP_LENGTH - 1, index + digits.length) };
  }
  slots[index] = digits;
  return { value: joinOtpSlots(slots), focusIndex: index < OTP_LENGTH - 1 ? index + 1 : null };
}

/**
 * Attributes for one OTP box. Every box is marked as a one-time code with its own name, so the browser never
 * treats the six boxes as parts of a phone number or address and never fills them while another field
 * (mobile number, email…) is being autofilled. Password managers are told to leave them alone too.
 * `group` keeps the boxes of different codes on one page apart (e.g. "signup-mobile", "signup-email").
 */
export function otpBoxProps(group, index) {
  return {
    id: `${group}-otp-${index + 1}`,
    name: `${group}-otp-${index + 1}`,
    autoComplete: 'one-time-code',
    autoCorrect: 'off',
    autoCapitalize: 'off',
    spellCheck: false,
    'aria-label': `Digit ${index + 1} of ${OTP_LENGTH}`,
    'data-lpignore': 'true',
    'data-1p-ignore': 'true',
    'data-bwignore': 'true',
    'data-form-type': 'other',
  };
}

/**
 * True when the person is typing in some other field right now. A code box only takes the cursor on its own when
 * this is false, so opening a code box never pulls the cursor out of the field being filled in.
 */
export function isTypingElsewhere(boxes = []) {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!active || active === document.body) return false;
  if (boxes.includes(active)) return false;
  const tag = active.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active.isContentEditable;
}

/** Code string from pasted text (digits only, from the first box). */
export function pastedOtp(text) {
  return String(text || '').replace(/\D/g, '').slice(0, OTP_LENGTH);
}
