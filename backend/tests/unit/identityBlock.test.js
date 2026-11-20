import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertIdentityNotSuspended, blockUserIdentities, identityHash, unblockUserIdentities, SUSPENDED_IDENTITY_CODE,
} from '../../src/services/identityBlockService.js';
import { canResumeSignup, existingAccountError } from '../../src/utils/accountStatus.js';
import { secretHash } from '../../src/services/verificationService.js';

/** In-memory stand-in for prisma (blockedIdentity + the user being suspended). */
function fakeDb(user) {
  const rows = [];
  return {
    rows,
    user: { findUnique: async () => user },
    blockedIdentity: {
      findUnique: async ({ where }) => rows.find((r) => r.kind === where.kind_valueHash.kind && r.valueHash === where.kind_valueHash.valueHash) || null,
      createMany: async ({ data }) => {
        let count = 0;
        for (const d of data) if (!rows.some((r) => r.kind === d.kind && r.valueHash === d.valueHash)) { rows.push(d); count += 1; }
        return { count };
      },
      deleteMany: async ({ where }) => {
        const before = rows.length;
        for (let i = rows.length - 1; i >= 0; i -= 1) if (rows[i].userId === where.userId) rows.splice(i, 1);
        return { count: before - rows.length };
      },
    },
  };
}

const suspendedUser = {
  email: 'Ravi@Example.com',
  pan: 'befpk1234j',
  aadhaarVerifications: [{ aadhaarHash: secretHash('aadhaar:234123412346') }],
};

test('Suspended identities cannot sign up again', async (t) => {
  await t.test('hashes are stable and case-insensitive for email and PAN; Aadhaar matches the OTP records', () => {
    assert.equal(identityHash('EMAIL', 'Ravi@Example.com'), identityHash('EMAIL', 'ravi@example.com'));
    assert.equal(identityHash('PAN', 'befpk1234j'), identityHash('PAN', 'BEFPK1234J'));
    assert.equal(identityHash('AADHAAR', '234123412346'), secretHash('aadhaar:234123412346'));
    assert.equal(identityHash('AADHAAR', '1234'), null);
    assert.equal(identityHash('EMAIL', ''), null);
  });

  await t.test('suspending blocks the email, PAN and Aadhaar; reactivating lifts the block', async () => {
    const db = fakeDb(suspendedUser);
    assert.equal(await blockUserIdentities('u1', 'Fraud', db), 3);
    assert.equal(await blockUserIdentities('u1', 'Fraud', db), 0, 'suspending twice adds nothing');
    for (const [kind, value] of [['EMAIL', 'ravi@example.com'], ['PAN', 'BEFPK1234J'], ['AADHAAR', '234123412346']]) {
      await assert.rejects(assertIdentityNotSuspended(kind, value, db), (e) => e.statusCode === 403 && e.errorCode === SUSPENDED_IDENTITY_CODE && /suspended/.test(e.message), kind);
    }
    assert.ok(!JSON.stringify(db.rows).includes('BEFPK1234J') && !JSON.stringify(db.rows).toLowerCase().includes('ravi@'), 'only hashes are stored');

    assert.equal(await unblockUserIdentities('u1', db), 3);
    await assertIdentityNotSuspended('EMAIL', 'ravi@example.com', db);
    await assertIdentityNotSuspended('PAN', 'BEFPK1234J', db);
  });

  await t.test('other people are not affected', async () => {
    const db = fakeDb(suspendedUser);
    await blockUserIdentities('u1', 'Fraud', db);
    await assertIdentityNotSuspended('EMAIL', 'someone@example.com', db);
    await assertIdentityNotSuspended('PAN', 'ABCDE1234F', db);
  });

  await t.test('signing up with a suspended account’s email says suspended, not "please log in"', () => {
    const err = existingAccountError({ role: 'BUYER', status: 'SUSPENDED', isActive: false }, 'BUYER');
    assert.equal(err.statusCode, 403);
    assert.match(err.message, /suspended/);
    assert.ok(!/log in/i.test(err.message));
    assert.equal(canResumeSignup({ role: 'BUYER', status: 'SUSPENDED', isActive: false }, 'BUYER'), false);
  });
});
