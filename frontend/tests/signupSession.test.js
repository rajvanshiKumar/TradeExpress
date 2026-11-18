import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Minimal browser storage for node
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
};
globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));

const {
  saveSignupSession, loadSignupSession, clearSignupSession, resolveResume, isProofAlive, tokenExpiresAt, PHONE_PROOF_LIFETIME_MS,
} = await import('../src/utils/signupSession.js');

const fakeJwt = (expMs) => `h.${Buffer.from(JSON.stringify({ exp: Math.floor(expMs / 1000) })).toString('base64url')}.s`;
const NOW = 1_800_000_000_000;

describe('Signup session (resume after refresh)', () => {
  beforeEach(() => store.clear());

  it('reads the expiry from a signed proof', () => {
    assert.equal(tokenExpiresAt(fakeJwt(NOW + 3_600_000)), Math.floor((NOW + 3_600_000) / 1000) * 1000);
    assert.equal(tokenExpiresAt('not-a-jwt'), null);
    assert.equal(isProofAlive(fakeJwt(NOW + 30 * 60_000), NOW), true);
    assert.equal(isProofAlive(fakeJwt(NOW + 30_000), NOW), false, 'within the one-minute margin counts as expired');
    assert.equal(isProofAlive('', NOW), false);
  });

  it('saves, loads and clears per role', () => {
    saveSignupSession('buyer', { email: 'a@b.co', step: 2 });
    assert.equal(loadSignupSession('buyer').step, 2);
    assert.equal(loadSignupSession('supplier'), null);
    clearSignupSession('buyer');
    assert.equal(loadSignupSession('buyer'), null);
  });

  it('drops progress older than a day', () => {
    saveSignupSession('buyer', { email: 'a@b.co', step: 2 });
    assert.equal(loadSignupSession('buyer', Date.now() + 25 * 3_600_000), null);
  });

  it('valid email and mobile: continue on the saved step', () => {
    const r = resolveResume({ step: 3, emailToken: fakeJwt(NOW + 3_600_000), phoneToken: 'p', phoneVerifiedAt: NOW - 60_000 }, NOW);
    assert.deepEqual(r, { emailValid: true, phoneValid: true, step: 3, resumeStep: null });
  });

  it('verified email but no mobile yet: step 2', () => {
    const r = resolveResume({ step: 2, emailToken: fakeJwt(NOW + 3_600_000) }, NOW);
    assert.equal(r.step, 2);
  });

  it('mobile proof expired: back to step 2, not further', () => {
    const r = resolveResume({ step: 3, emailToken: fakeJwt(NOW + 3_600_000), phoneToken: 'p', phoneVerifiedAt: NOW - PHONE_PROOF_LIFETIME_MS - 1 }, NOW);
    assert.equal(r.phoneValid, false);
    assert.equal(r.step, 2);
  });

  it('email proof expired: verify the email again, then continue where the user was', () => {
    const r = resolveResume({ step: 3, emailToken: fakeJwt(NOW - 1000), phoneToken: 'p', phoneVerifiedAt: NOW - 60_000 }, NOW);
    assert.deepEqual(r, { emailValid: false, phoneValid: true, step: 1, resumeStep: 3 });
  });
});
