// Password hashing with the browser's Web Crypto API (PBKDF2-SHA-256).
//
// Only a salted hash is ever stored, never the password itself. This keeps passwords out
// of plain sight in browser storage, but it is NOT real security: anything in a front-end
// app can be read or changed by whoever controls the browser. Real accounts need a server.

const ITERATIONS = 210000;
const encoder = new TextEncoder();

const toBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = (text) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

export const isCryptoAvailable = () => typeof crypto !== 'undefined' && Boolean(crypto.subtle);

/** Returns "pbkdf2$<iterations>$<salt>$<hash>". */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

/** Checks a password against a stored "pbkdf2$…" hash. Never throws. */
export async function verifyPassword(password, stored) {
  try {
    const [scheme, iterations, salt, expected] = String(stored ?? '').split('$');
    if (scheme !== 'pbkdf2' || !salt || !expected) return false;
    const actual = toBase64(await derive(password, fromBase64(salt), Number(iterations)));
    // Compare every character so the check takes the same time whatever the input.
    let difference = actual.length ^ expected.length;
    for (let index = 0; index < Math.max(actual.length, expected.length); index += 1) difference |= (actual.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
    return difference === 0;
  } catch {
    return false;
  }
}
