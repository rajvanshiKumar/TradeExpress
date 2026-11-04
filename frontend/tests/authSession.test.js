import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readTokenPayload, sessionMatchesToken } from '../src/utils/authSession.js';

// Unsigned test tokens: only the payload matters here (the server verifies signatures)
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const tokenFor = (payload) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.signature`;
const inAnHour = Math.floor(Date.now() / 1000) + 3600;

describe('Session must match the stored login token (Forbidden-error root cause)', () => {
  const supplierSession = { userId: 'sup-1', role: 'supplier', expiresAt: Date.now() + 3600e3 };

  it('accepts the supplier\'s own token', () => {
    assert.equal(sessionMatchesToken(supplierSession, tokenFor({ userId: 'sup-1', role: 'SUPPLIER', exp: inAnHour })), true);
  });

  it('rejects a buyer token left in storage while the page thinks it is a supplier (the 403 cause)', () => {
    assert.equal(sessionMatchesToken(supplierSession, tokenFor({ userId: 'buyer-9', role: 'BUYER', exp: inAnHour })), false);
  });

  it('rejects another supplier\'s token', () => {
    assert.equal(sessionMatchesToken(supplierSession, tokenFor({ userId: 'sup-2', role: 'SUPPLIER', exp: inAnHour })), false);
  });

  it('rejects an expired or missing token', () => {
    assert.equal(sessionMatchesToken(supplierSession, tokenFor({ userId: 'sup-1', role: 'SUPPLIER', exp: Math.floor(Date.now() / 1000) - 5 })), false);
    assert.equal(sessionMatchesToken(supplierSession, null), false);
    assert.equal(sessionMatchesToken(supplierSession, 'not-a-token'), false);
  });

  it('compares only the role for the Super Admin profile session', () => {
    const adminSession = { userId: 'TS-SUPER-ADMIN', role: 'super_admin', expiresAt: Date.now() + 3600e3 };
    assert.equal(sessionMatchesToken(adminSession, tokenFor({ userId: 'real-uuid', role: 'SUPER_ADMIN', exp: inAnHour })), true);
    assert.equal(sessionMatchesToken(adminSession, tokenFor({ userId: 'real-uuid', role: 'BUYER', exp: inAnHour })), false);
  });

  it('is satisfied when nobody is signed in', () => {
    assert.equal(sessionMatchesToken({ userId: null, role: null }, null), true);
  });

  it('reads base64url payloads', () => {
    assert.deepEqual(readTokenPayload(tokenFor({ userId: 'a~b?', role: 'BUYER' })), { userId: 'a~b?', role: 'BUYER' });
  });
});
