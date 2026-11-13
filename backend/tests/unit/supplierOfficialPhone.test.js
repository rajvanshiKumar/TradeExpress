import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../../src/config/db.js';
import { checkPhoneAvailability, registerSupplier } from '../../src/services/authService.js';
import { issueVerifiedEmailToken } from '../../src/services/otpService.js';

let prismaStub;
prisma.$use(async (params, next) => (prismaStub ? prismaStub(params) : null));

function stubQueries(t, handler) {
  prismaStub = handler;
  t.after(() => { prismaStub = null; });
}

describe('Supplier Official Phone Number Uniqueness', () => {
  const baseSupplier = () => ({
    name: 'Rajesh Kumar',
    company: 'Kumar Enterprises',
    companyName: 'Kumar Enterprises',
    email: 'rajesh@kumarenterprises.example',
    password: 'StrongPassword@123',
    confirmPassword: 'StrongPassword@123',
    phone: '9876543210',
    country: 'India',
    state: 'Maharashtra',
    city: 'Mumbai',
    postalCode: '400001',
    businessType: 'Udyam Certificate',
    taxId: 'UDYAM-MH-12-0012345',
    emailVerificationToken: issueVerifiedEmailToken('rajesh@kumarenterprises.example'),
    verificationToken: 'token_verified',
    profilePhoto: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    legalStructure: 'Private Limited',
    companyDescription: 'We are leading manufacturers of industrial goods since twenty years.',
    businessPhone: '',
  });

  it('rejects official phone when it matches representative mobile number', async (t) => {
    stubQueries(t, async (query) => {
      if (query.model === 'User' && query.action === 'findUnique') return null;
      if (query.model === 'User' && query.action === 'findFirst') return null;
      return null;
    });

    const payload = {
      ...baseSupplier(),
      phone: '9876543210',
      businessPhone: '9876543210',
    };

    await assert.rejects(
      async () => registerSupplier(payload),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /cannot be the same as your representative mobile/i);
        return true;
      }
    );
  });

  it('rejects official phone when it already belongs to an existing buyer', async (t) => {
    stubQueries(t, async (query) => {
      if (query.model === 'User' && query.action === 'findUnique') return null;
      if (query.model === 'User' && query.action === 'findFirst') {
        const where = query.args?.where;
        if (where?.OR?.some((cond) => cond.businessPhone || cond.phone)) {
          const matchesBiz = where.OR.some((c) =>
            (c.businessPhone && (c.businessPhone === '2245678900' || c.businessPhone?.in?.includes('2245678900'))) ||
            (c.phone && (c.phone === '2245678900' || c.phone?.in?.includes('2245678900')))
          );
          if (matchesBiz) {
            return { id: 'buyer-user-1', role: 'BUYER', phone: '2245678900' };
          }
        }
        return null;
      }
      return null;
    });

    const payload = {
      ...baseSupplier(),
      businessPhone: '2245678900',
    };

    await assert.rejects(
      async () => registerSupplier(payload),
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.match(err.message, /already registered to a buyer account/i);
        return true;
      }
    );
  });

  it('rejects official phone when it already belongs to an existing supplier', async (t) => {
    stubQueries(t, async (query) => {
      if (query.model === 'User' && query.action === 'findUnique') return null;
      if (query.model === 'User' && query.action === 'findFirst') {
        const where = query.args?.where;
        if (where?.OR?.some((cond) => cond.businessPhone || cond.phone)) {
          const matchesBiz = where.OR.some((c) =>
            (c.businessPhone && (c.businessPhone === '2245678900' || c.businessPhone?.in?.includes('2245678900'))) ||
            (c.phone && (c.phone === '2245678900' || c.phone?.in?.includes('2245678900')))
          );
          if (matchesBiz) {
            return { id: 'supplier-user-2', role: 'SUPPLIER', businessPhone: '2245678900' };
          }
        }
        return null;
      }
      return null;
    });

    const payload = {
      ...baseSupplier(),
      businessPhone: '2245678900',
    };

    await assert.rejects(
      async () => registerSupplier(payload),
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.match(err.message, /already registered to a supplier account/i);
        return true;
      }
    );
  });

  it('checkPhoneAvailability detects available vs registered phone numbers', async (t) => {
    stubQueries(t, async (query) => {
      if (query.model === 'User' && query.action === 'findFirst') {
        const where = query.args?.where;
        const matchesRegistered = where?.OR?.some((c) =>
          (c.businessPhone && (c.businessPhone === '9988776655' || c.businessPhone?.in?.includes('9988776655'))) ||
          (c.phone && (c.phone === '9988776655' || c.phone?.in?.includes('9988776655')))
        );
        if (matchesRegistered) {
          return { id: 'user-99', role: 'SUPPLIER', phone: '9988776655' };
        }
        return null;
      }
      return null;
    });

    const available = await checkPhoneAvailability({ phone: '9123456780' });
    assert.equal(available.available, true);
    assert.equal(available.registered, false);

    const taken = await checkPhoneAvailability({ phone: '9988776655' });
    assert.equal(taken.available, false);
    assert.equal(taken.registered, true);
    assert.equal(taken.role, 'SUPPLIER');
    assert.match(taken.message, /already registered to a supplier account/i);
  });
});
