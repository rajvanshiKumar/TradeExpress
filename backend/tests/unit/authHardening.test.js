import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import prisma from '../../src/config/db.js';
import { changePassword, loginUser, registerBuyer } from '../../src/services/authService.js';
import { activeResendWindow, issueVerifiedEmailToken, lockOtpSession } from '../../src/services/otpService.js';
import { identityQuery, verifiedIdentity } from '../helpers/verifiedIdentity.js';

// Phase 1 audit regressions: admin access through the public login, password change sign-out,
// email OTP resend window and invented signup location data.

let prismaStub;
prisma.$use(async (params) => (prismaStub ? prismaStub(params) : null));

function stubQueries(t, handler) {
  prismaStub = handler;
  t.after(() => { prismaStub = null; });
}

const PASSWORD = 'Strong@Pass123';

async function adminUser() {
  return {
    id: 'admin-test', email: 'owner@tradeexpress.test', name: 'Platform Admin', role: 'SUPER_ADMIN',
    passwordHash: await bcrypt.hash(PASSWORD, 4), isActive: true, status: 'ACTIVE', googleId: null,
  };
}

describe('Public sign-in never grants administrator access', () => {
  it('rejects an admin account on the public login even with the correct password', async (t) => {
    const admin = await adminUser();
    stubQueries(t, async (query) => {
      if (query.model === 'User' && query.action === 'findUnique') return admin;
      if (query.model === 'UserSession' && query.action === 'create') throw new Error('No session may be issued.');
      return null;
    });
    await assert.rejects(
      loginUser({ email: admin.email, password: PASSWORD, role: 'BUYER' }),
      (error) => error.statusCode === 401 && /invalid email or password/i.test(error.message),
    );
  });

  it('does not resolve admin aliases on the public login', async (t) => {
    const admin = await adminUser();
    stubQueries(t, async (query) => {
      if (query.model === 'User' && query.action === 'findUnique') return null;
      if (query.model === 'User' && query.action === 'findFirst') return admin; // must not be used
      // A session can be created here, so the test fails if the alias ever signs an admin in
      if (query.model === 'UserSession' && query.action === 'create') return { id: 'alias-session', ...query.args.data };
      return null;
    });
    await assert.rejects(
      loginUser({ email: 'admin', password: PASSWORD, role: 'BUYER' }),
      (error) => Number(error.statusCode) >= 400 && Number(error.statusCode) < 500,
    );
  });

  it('admin portal: unknown emails never fall back to an admin account; real admin email still works', async (t) => {
    const admin = await adminUser();
    stubQueries(t, async (query) => {
      if (query.model === 'User' && query.action === 'findUnique') return null;
      if (query.model === 'User' && query.action === 'findFirst') return admin; // fallback must not be reached
      if (query.model === 'UserSession' && query.action === 'create') throw new Error('No session may be issued.');
      return null;
    });
    await assert.rejects(
      loginUser({ email: 'someone-else@example.com', password: PASSWORD, isAdminLogin: true }),
      (error) => error.statusCode === 401,
    );

    stubQueries(t, async (query) => {
      if (query.model === 'User' && query.action === 'findUnique') return admin;
      if (query.model === 'UserSession' && query.action === 'create') return { id: 'admin-session', ...query.args.data };
      return null;
    });
    const result = await loginUser({ email: admin.email, password: PASSWORD, isAdminLogin: true });
    assert.equal(result.user.role, 'SUPER_ADMIN');
    assert.ok(result.token);
  });
});

describe('Password change through /auth/change-password', () => {
  it('signs out other devices, moves the token cut-off and returns a fresh token', async (t) => {
    const user = { id: 'buyer-pw', email: 'pw@example.com', role: 'BUYER', passwordHash: await bcrypt.hash(PASSWORD, 4) };
    const calls = [];
    stubQueries(t, async (query) => {
      calls.push(`${query.model}.${query.action}`);
      if (query.model === 'User' && query.action === 'findUnique') return user;
      if (query.model === 'User' && query.action === 'update') {
        assert.ok(query.args.data.sessionsValidAfter instanceof Date, 'sessionsValidAfter must be set');
        return { ...user, ...query.args.data };
      }
      if (query.model === 'UserSession' && query.action === 'updateMany') return { count: 2 };
      if (query.model === 'UserSession' && query.action === 'create') return { id: 'fresh-session', ...query.args.data };
      return null;
    });
    const result = await changePassword({ userId: user.id, currentPassword: PASSWORD, newPassword: 'Newer@Pass456' });
    assert.ok(calls.includes('UserSession.updateMany'), 'other sessions must be revoked');
    assert.ok(result.data?.token, 'a fresh token is returned');
  });

  it('rejects a wrong current password without changing anything', async (t) => {
    const user = { id: 'buyer-pw', email: 'pw@example.com', role: 'BUYER', passwordHash: await bcrypt.hash(PASSWORD, 4) };
    stubQueries(t, async (query) => {
      if (query.model === 'User' && query.action === 'findUnique') return user;
      throw new Error(`No write may happen: ${query.model}.${query.action}`);
    });
    await assert.rejects(
      changePassword({ userId: user.id, currentPassword: 'Wrong@Pass999', newPassword: 'Newer@Pass456' }),
      (error) => error.statusCode === 400,
    );
  });
});

describe('Email OTP resend limit window', () => {
  it('counts resends only within the last hour, then starts again', () => {
    assert.equal(activeResendWindow(null), null);
    assert.equal(activeResendWindow({ resendCount: 5 }), null, 'entries without a window start fresh');
    const recent = { resendCount: 5, windowStartedAt: Date.now() - 10 * 60 * 1000 };
    assert.equal(activeResendWindow(recent), recent, 'still limited inside the hour');
    assert.equal(activeResendWindow({ resendCount: 5, windowStartedAt: Date.now() - 61 * 60 * 1000 }), null, 'limit lifts after an hour');
  });
});

describe('Super Admin user list role filter', () => {
  it('accepts any letter case, and rejects unknown roles with 400 instead of a Prisma error', async (t) => {
    const { getUsers } = await import('../../src/services/superAdminService.js');
    const seen = [];
    stubQueries(t, async (query) => {
      if (query.model === 'User' && (query.action === 'count' || query.action === 'findMany')) {
        seen.push(query.args.where?.role);
        return query.action === 'count' ? 0 : [];
      }
      return null;
    });
    await getUsers({ role: 'buyer' });
    await getUsers({ role: 'all' });
    assert.ok(seen.includes('BUYER'), 'lowercase role is normalised to the enum value');
    assert.ok(seen.includes(undefined), '"all" means no role filter');
    await assert.rejects(getUsers({ role: 'HACKER' }), (error) => error.statusCode === 400);
  });
});

describe('Email OTP lockout keeps its limits', () => {
  it('kills the code but keeps the send time, resend count and window', () => {
    const session = { otpHash: 'hash', attempts: 5, lastSentAt: 1000, resendCount: 3, windowStartedAt: 500 };
    const error = lockOtpSession(session);
    assert.equal(error.statusCode, 429);
    assert.equal(session.otpHash, null, 'the locked code can never match again');
    assert.equal(session.locked, true);
    assert.equal(session.lastSentAt, 1000, 'resend cooldown still measured from the last send');
    assert.equal(session.resendCount, 3, 'hourly limit keeps counting');
    assert.equal(session.windowStartedAt, 500);
  });
});

describe('Buyer signup stores only entered location data', () => {
  it('leaves city, state, PIN code and address empty when the buyer did not enter them', async (t) => {
    const previousMode = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    t.after(() => {
      if (previousMode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousMode;
    });
    let created = null;
    stubQueries(t, async (query) => {
      const identity = identityQuery(query);
      if (identity !== undefined) return identity;
      if (query.model === 'User' && (query.action === 'findUnique' || query.action === 'findFirst')) return null;
      if (query.model === 'UserSession' && query.action === 'create') return { id: 'session-signup', ...query.args.data };
      if (query.model === 'User' && query.action === 'create') {
        created = query.args.data;
        return { id: 'buyer-location', ...query.args.data };
      }
      if (query.model === 'Address' && query.action === 'create') throw new Error('No placeholder address may be saved.');
      return null;
    });
    await registerBuyer({
      name: 'Location Buyer', email: 'location@example.com', phone: '9876543210', country: 'India',
      verificationToken: 'verified', emailVerificationToken: issueVerifiedEmailToken('location@example.com'),
      ...verifiedIdentity(),
    });
    assert.ok(created, 'account was created');
    assert.equal(created.city, null);
    assert.equal(created.state, null);
    assert.equal(created.postalCode, null);
    assert.equal(created.businessAddress, null);
  });
});
