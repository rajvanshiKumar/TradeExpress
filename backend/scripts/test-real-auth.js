/**
 * End-to-End Automated Verification: Real B2B Authentication & Signup/Signin Integrity
 */
import assert from 'assert';
import prisma from '../src/config/db.js';
import * as authService from '../src/services/authService.js';
import * as otpService from '../src/services/otpService.js';

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${desc}:`, err.message);
    failed++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${desc}:`, err.message);
    failed++;
  }
}

async function run() {
  console.log('\n======================================================');
  console.log('TradeExpress Real B2B Authentication & Validation Test');
  console.log('======================================================\n');

  const testBuyerEmail = `buyer.test.${Date.now()}@realb2b.example`;
  const testBuyerPhone = `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testPassword = 'SecurePassword@2026';

  // 1. Unregistered user sign-in MUST be rejected
  await itAsync('1. Unregistered email sign-in is strictly rejected with 401', async () => {
    try {
      await authService.loginUser({
        email: 'unregistered.ghost.account@nowhere.example',
        password: 'AnyPassword@123',
      });
      assert.fail('Expected loginUser to throw for unregistered account');
    } catch (err) {
      assert.strictEqual(err.statusCode, 401, 'Should return statusCode 401');
      assert.ok(
        err.message.includes('No account found') || err.message.includes('Invalid email or password'),
        'Message should inform user account does not exist or credentials invalid'
      );
    }
  });

  // 2. Missing password validation
  await itAsync('2. Sign-in without password throws statusCode 400', async () => {
    try {
      // Create a temporary mock user to test missing password
      const tempEmail = `temppass.${Date.now()}@test.example`;
      const created = await prisma.user.create({
        data: {
          email: tempEmail,
          passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
          name: 'Temp User',
          role: 'BUYER',
          phone: `+91 97${Math.floor(10000000 + Math.random() * 90000000)}`,
        },
      });

      try {
        await authService.loginUser({
          email: tempEmail,
          password: '',
        });
        assert.fail('Expected loginUser to throw when password is empty');
      } catch (err) {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes('Password is required'));
      } finally {
        await prisma.user.delete({ where: { id: created.id } }).catch(() => {});
      }
    } catch (err) {
      assert.fail(err.message);
    }
  });

  // 3. User can sign up as Buyer
  let registeredBuyer = null;
  await itAsync('3. User registers as Buyer with valid credentials and business profile', async () => {
    const regResult = await authService.registerBuyer({
      name: 'Priya Sharma',
      company: 'Sharma Global Trading LLP',
      email: testBuyerEmail,
      password: testPassword,
      confirmPassword: testPassword,
      phone: testBuyerPhone,
      country: 'India',
      state: 'Maharashtra',
      city: 'Mumbai',
      postalCode: '400001',
      businessAddress: 'Plot 45, Nariman Point, Mumbai',
      buyerTypes: ['Wholesaler / Distributor'],
      businessDescription: 'Import and domestic distribution of precision tools',
      gstStatus: 'Regular GST Registration',
      gstin: '27AAAAA0000A1Z5',
      panNumber: 'AAAAA0000A',
    });

    assert.ok(regResult, 'Registration result should be truthy');
    assert.ok(regResult.user, 'Result should have user');
    assert.strictEqual(regResult.user.email, testBuyerEmail);
    assert.strictEqual(regResult.user.role, 'BUYER');
    assert.ok(regResult.token, 'Should return signed JWT token');
    registeredBuyer = regResult.user;
  });

  // 4. Buyer cannot sign in with WRONG password
  await itAsync('4. Registered Buyer fails to sign in with WRONG password (401)', async () => {
    try {
      await authService.loginUser({
        email: testBuyerEmail,
        password: 'CompletelyWrongPassword!123',
      });
      assert.fail('Expected wrong password to throw');
    } catch (err) {
      assert.strictEqual(err.statusCode, 401);
      assert.ok(err.message.includes('Invalid email or password'));
    }
  });

  // 5. Buyer CAN sign in with CORRECT registered email & password
  await itAsync('5. Registered Buyer successfully signs in with registered email and password', async () => {
    const loginResult = await authService.loginUser({
      email: testBuyerEmail,
      password: testPassword,
      role: 'BUYER',
    });

    assert.ok(loginResult, 'Login result should be truthy');
    assert.ok(loginResult.user, 'Should contain user record');
    assert.strictEqual(loginResult.user.email, testBuyerEmail);
    assert.strictEqual(loginResult.user.role, 'BUYER');
    assert.ok(loginResult.token, 'Should return valid JWT session token');
  });

  // 6. Check that OTP dispatch does not leak devOtp
  await itAsync('6. OTP dispatch responses NEVER leak devOtp in real B2B mode', async () => {
    const mobileRes = await otpService.requestMobileOtp({
      phone: testBuyerPhone,
      country: 'India',
    }).catch((e) => ({ message: e.message }));

    if (mobileRes.success) {
      assert.strictEqual(mobileRes.devOtp, undefined, 'devOtp must not be leaked in mobile OTP response');
    }

    const emailRes = await otpService.requestEmailVerificationOtp({
      email: `clean.otp.${Date.now()}@example.com`,
      name: 'Test Partner',
      purpose: 'registration',
    }).catch((e) => ({ message: e.message }));

    if (emailRes.success) {
      assert.strictEqual(emailRes.devOtp, undefined, 'devOtp must not be leaked in email OTP response');
    }
  });

  // 7. Cleanup test buyer
  if (registeredBuyer?.id) {
    await prisma.user.delete({ where: { id: registeredBuyer.id } }).catch(() => {});
  }

  await prisma.$disconnect();

  console.log('\n------------------------------------------------------');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('------------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
