import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../../src/config/db.js';
import { clearOtpHistory, mobileSendsInWindow, mobileWindowOpen, requestMobileOtp, resendMobileOtp } from '../../src/services/otpService.js';

// All database access goes through this in-memory stub; nothing reaches a real database or sends an SMS.
let row = null;
prisma.$use(async ({ model, action }) => {
  if (model === 'MobileVerification' && action === 'findUnique') return row;
  return null;
});
afterEach(() => { row = null; });

const minutesAgo = (m) => new Date(Date.now() - m * 60 * 1000);

describe('Mobile OTP hourly limit', () => {
  it('counts only the codes sent in the running 1-hour window', () => {
    assert.equal(mobileSendsInWindow({ resendCount: 4, lastSentAt: minutesAgo(10) }), 4);
    assert.equal(mobileSendsInWindow({ resendCount: 9, lastSentAt: minutesAgo(61) }), 0, 'an old account’s count does not carry over');
    assert.equal(mobileSendsInWindow(null), 0);
    assert.equal(mobileWindowOpen({ resendCount: 0, lastSentAt: minutesAgo(5) }), true, 'the first code opens the window');
    assert.equal(mobileWindowOpen({ resendCount: 0, lastSentAt: minutesAgo(70) }), false);
  });

  it('still refuses a 6th code within the hour (signup and resend)', async () => {
    row = { phone: '+91 9876543210', resendCount: 5, lastSentAt: minutesAgo(5), updatedAt: minutesAgo(5) };
    for (const send of [requestMobileOtp, resendMobileOtp]) {
      await assert.rejects(send({ phone: '9876543210', country: 'India', role: 'BUYER' }), (err) => {
        assert.equal(err.statusCode, 429);
        assert.equal(err.errorCode, 'OTP_HOURLY_LIMIT');
        return true;
      });
    }
  });
});

describe('Deleted account: OTP history is forgotten', () => {
  it('removes the mobile number’s OTP record in both stored formats', async () => {
    const calls = [];
    const db = { mobileVerification: { deleteMany: async (args) => { calls.push(args); return { count: 1 }; } } };
    await clearOtpHistory({ email: 'Asha@Example.com', phone: '9876543210', country: 'India', db });
    assert.deepEqual(calls, [{ where: { phone: { in: ['9876543210', '+91 9876543210'] } } }]);
  });

  it('does nothing for an account without a mobile number', async () => {
    const db = { mobileVerification: { deleteMany: async () => { throw new Error('must not be called'); } } };
    await clearOtpHistory({ email: 'asha@example.com', phone: null, db });
  });
});
