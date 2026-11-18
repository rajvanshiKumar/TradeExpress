import crypto from 'crypto';
import { ENV } from '../config/env.js';

/*
 * Field encryption for sensitive values kept in the database (2FA secrets, bank account numbers).
 * AES-256-GCM with a random 12-byte IV; stored as "enc:v1:<base64(iv | tag | ciphertext)>".
 *
 * Key: DATA_ENCRYPTION_KEY (32 bytes as 64 hex characters or base64). There is deliberately no fallback key:
 * the local and hosted servers share one database, so every server must use the same explicit key (or none).
 * Values without the "enc:v1:" prefix are legacy plaintext and are returned unchanged by decryptField.
 */

const PREFIX = 'enc:v1:';

function loadKey() {
  const raw = (ENV.DATA_ENCRYPTION_KEY || '').trim();
  if (!raw) return null;
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes (64 hex characters or base64).');
  return key;
}

/** True when DATA_ENCRYPTION_KEY is configured, so sensitive fields can be encrypted. */
export function encryptionAvailable() {
  try {
    return Boolean(loadKey());
  } catch {
    return false;
  }
}

function requireKey() {
  const key = loadKey();
  if (!key) {
    const error = new Error('Secure storage is not configured on the server (DATA_ENCRYPTION_KEY).');
    error.statusCode = 503;
    error.errorCode = 'ENCRYPTION_NOT_CONFIGURED';
    throw error;
  }
  return key;
}

export const isEncrypted = (value) => typeof value === 'string' && value.startsWith(PREFIX);

export function encryptField(plain) {
  if (plain === null || plain === undefined || plain === '') return plain;
  if (isEncrypted(plain)) return plain;
  const key = requireKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

export function decryptField(stored) {
  if (!isEncrypted(stored)) return stored;
  const key = requireKey();
  const data = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
}

/** Decrypts for display; returns null instead of throwing when the key is missing or the value is damaged. */
export function readEncryptedField(stored) {
  try {
    return decryptField(stored);
  } catch {
    return null;
  }
}

/** Stores encrypted when a key is configured; otherwise unchanged (same as before encryption existed). */
export const encryptIfConfigured = (plain) => (encryptionAvailable() ? encryptField(plain) : plain);
