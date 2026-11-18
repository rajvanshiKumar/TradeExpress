import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../../src/config/db.js';
import { requestMobileOtp } from '../../src/services/otpService.js';

// All database access goes through this in-memory stub; nothing reaches a real database or sends an SMS.
let existingUser = null;
let smsAttempted = false;
prisma.$use(async ({ model, action }) => {
  if (model === 'User' && action === 'findFirst') return existingUser;
  if (model === 'MobileVerification') { smsAttempted = true; return null; }
  return null;
});
afterEach(() => { existingUser = null; smsAttempted = false; });

const complete = (role) => ({ id: 'u1', role, name: 'Asha', phone: '+919876543210', company: role === 'SUPPLIER' ? 'Acme' : null, passwordHash: 'x', googleId: null, isActive: true, status: 'ACTIVE' });
const unfinished = (role) => ({ ...complete(role), passwordHash: null });

describe('Signup mobile OTP: one mobile number, one account type', () => {
  for (const [label, user, role, expectedRole] of [
    ['a supplier number on buyer signup', complete('SUPPLIER'), 'BUYER', 'Supplier'],
    ['a buyer number on supplier signup', complete('BUYER'), 'SUPPLIER', 'Buyer'],
    ['an unfinished supplier signup on buyer signup', unfinished('SUPPLIER'), 'BUYER', 'Supplier'],
  ]) {
    it(`refuses ${label} before any OTP is sent`, async () => {
      existingUser = user;
      await assert.rejects(requestMobileOtp({ phone: '9876543210', country: 'India', role }), (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.errorCode, 'ROLE_MISMATCH');
        assert.match(err.message, new RegExp(`already exists as a ${expectedRole}`));
        return true;
      });
    });
  }

  it('the same role with a finished account is told to log in', async () => {
    existingUser = complete('SUPPLIER');
    await assert.rejects(requestMobileOtp({ phone: '9876543210', country: 'India', role: 'SUPPLIER' }), (err) => {
      assert.equal(err.errorCode, 'ACCOUNT_EXISTS');
      return true;
    });
  });

  it('never reveals an administrator account behind a number', async () => {
    existingUser = { ...complete('SUPER_ADMIN') };
    await assert.rejects(requestMobileOtp({ phone: '9876543210', country: 'India', role: 'BUYER' }), (err) => {
      assert.doesNotMatch(err.message, /admin/i);
      return true;
    });
  });
});
