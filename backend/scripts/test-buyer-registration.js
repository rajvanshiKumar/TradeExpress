import http from 'http';
import prisma from '../src/config/db.js';

const BASE_URL = 'http://localhost:5000/api';

function request(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
      },
      timeout: 10000,
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, data: json });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runBuyerTests() {
  console.log('\n============================================================');
  console.log('TradeExpress Buyer Signup & Verification Test Suite');
  console.log('============================================================\n');

  const timestamp = Date.now();
  const testBuyerEmail = `buyer.procurement.${timestamp}@example.com`;
  const testBuyerPhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;

  // Test 1: Validation - Missing Required Fields
  console.log('Test 1: Server Validation - Mandatory Fields');
  const res1 = await request('/auth/register-buyer', { method: 'POST' }, {
    email: '',
    name: '',
  });
  assert(res1.status === 400, `Returns 400 Bad Request when mandatory fields are missing (got ${res1.status})`);
  assert(res1.data?.success === false, `Response success is false for empty payload`);

  // Test 2: Validation - Password Policy (minimum 8 characters, alphanumeric)
  console.log('\nTest 2: Security Validation - Password Policy');
  const res2 = await request('/auth/register-buyer', { method: 'POST' }, {
    name: 'Vikram Sharma',
    company: 'Sharma Wholesale Ltd',
    email: testBuyerEmail,
    phone: testBuyerPhone,
    country: 'India',
    state: 'Maharashtra',
    city: 'Mumbai',
    postalCode: '400001',
    businessAddress: 'Plot 105, APMC Market, Vashi',
    password: 'weak', // too short, no number
    confirmPassword: 'weak',
    agreeTerms: true,
  });
  assert(res2.status === 400, `Rejects password shorter than 8 characters (got ${res2.status})`);

  // Test 3: Validation - Indian GSTIN when GST status requires it
  console.log('\nTest 3: Tax Compliance - GSTIN Format Validation for Indian Buyers');
  const res3 = await request('/auth/register-buyer', { method: 'POST' }, {
    name: 'Vikram Sharma',
    company: 'Sharma Wholesale Ltd',
    email: testBuyerEmail,
    phone: testBuyerPhone,
    country: 'India',
    state: 'Maharashtra',
    city: 'Mumbai',
    postalCode: '400001',
    businessAddress: 'Plot 105, APMC Market, Vashi',
    password: 'Password@123',
    confirmPassword: 'Password@123',
    buyerType: 'Wholesaler',
    gstStatus: 'Regular GST Registration',
    gstin: 'INVALID_GSTIN_123',
    agreeTerms: true,
  });
  assert(res3.status === 400, `Rejects invalid Indian GSTIN format (got ${res3.status})`);

  // Test 4: Validation - Indian PIN Code format (must be 6 digits)
  console.log('\nTest 4: Address Compliance - Indian PIN Code Format');
  const res4 = await request('/auth/register-buyer', { method: 'POST' }, {
    name: 'Vikram Sharma',
    company: 'Sharma Wholesale Ltd',
    email: testBuyerEmail,
    phone: testBuyerPhone,
    country: 'India',
    state: 'Maharashtra',
    city: 'Mumbai',
    postalCode: '4001', // invalid length
    businessAddress: 'Plot 105, APMC Market, Vashi',
    password: 'Password@123',
    confirmPassword: 'Password@123',
    buyerType: 'Wholesaler',
    gstStatus: 'Not Registered / Not Applicable',
    agreeTerms: true,
  });
  assert(res4.status === 400, `Rejects invalid Indian PIN code length (got ${res4.status})`);

  // Test 5: Email OTP Dispatch & Verification Flow
  console.log('\nTest 5: Email OTP Verification Service');
  const emailOtpRes = await request('/auth/send-email-verification-otp', { method: 'POST' }, {
    email: testBuyerEmail,
    name: 'Vikram Sharma',
    purpose: 'buyer_registration',
  });
  assert(emailOtpRes.status === 200, `Dispatches email OTP successfully (got ${emailOtpRes.status})`);
  assert(emailOtpRes.data?.success === true, `Email OTP response success: true`);

  const devOtp = emailOtpRes.data?.devOtp || '123456';
  const verifyEmailRes = await request('/auth/verify-email-verification-otp', { method: 'POST' }, {
    email: testBuyerEmail,
    otp: devOtp,
    purpose: 'buyer_registration',
  });
  assert(verifyEmailRes.status === 200, `Verifies email OTP successfully (got ${verifyEmailRes.status})`);
  assert(verifyEmailRes.data?.verificationToken !== undefined, `Generates secure verificationToken`);
  const emailToken = verifyEmailRes.data?.verificationToken;

  // Test 6: Mobile OTP Dispatch & Verification Flow
  console.log('\nTest 6: Mobile OTP Verification Service');
  const mobileOtpRes = await request('/auth/send-mobile-otp', { method: 'POST' }, {
    phone: testBuyerPhone,
    country: 'India',
  });
  assert(mobileOtpRes.status === 200, `Dispatches mobile OTP successfully (got ${mobileOtpRes.status})`);
  assert(mobileOtpRes.data?.success === true, `Mobile OTP response success: true`);

  const phoneDevOtp = mobileOtpRes.data?.devOtp || '123456';
  const verifyPhoneRes = await request('/auth/verify-mobile-otp', { method: 'POST' }, {
    phone: testBuyerPhone,
    country: 'India',
    otp: phoneDevOtp,
  });
  assert(verifyPhoneRes.status === 200, `Verifies mobile OTP successfully (got ${verifyPhoneRes.status})`);
  const phoneToken = verifyPhoneRes.data?.data?.verificationToken;
  assert(phoneToken !== undefined, `Generates mobile verificationToken`);

  // Test 7: Successful Full Indian Buyer Registration
  console.log('\nTest 7: Full Indian Buyer Registration (with GST, PAN & OTPs)');
  const buyerPayload = {
    name: 'Vikram Sharma',
    company: 'Sharma Wholesale & Retail Pvt Ltd',
    companyName: 'Sharma Wholesale & Retail Pvt Ltd',
    email: testBuyerEmail,
    phone: testBuyerPhone,
    country: 'India',
    state: 'Maharashtra',
    city: 'Navi Mumbai',
    postalCode: '400703',
    businessAddress: 'Sector 19, Vashi APMC Commercial Complex, Navi Mumbai',
    buyerTypes: ['Wholesaler', 'Distributor'],
    buyerType: 'Wholesaler, Distributor',
    businessDescription: 'Bulk procurer of agricultural commodities and packaged dry food products.',
    gstStatus: 'Regular GST Registration',
    gstin: '27AABCS1429B1Z8',
    panNumber: 'AABCS1429B',
    password: 'Password@123',
    confirmPassword: 'Password@123',
    verificationToken: phoneToken,
    emailVerificationToken: emailToken,
    agreeTerms: true,
    role: 'ADMIN', // Intentional attempt to escalate role: must be ignored by server!
  };

  const regRes = await request('/auth/register-buyer', { method: 'POST' }, buyerPayload);
  assert(regRes.status === 201, `Buyer created with HTTP 201 Created (got ${regRes.status})`);
  assert(regRes.data?.success === true, `Buyer creation returned success: true`);

  const createdUser = regRes.data?.data?.user;
  assert(createdUser?.role === 'BUYER', `Server strictly enforces role BUYER despite client 'ADMIN' attempt`);
  assert(createdUser?.company === 'Sharma Wholesale & Retail Pvt Ltd', `Company name stored correctly`);
  assert(createdUser?.isPhoneVerified === true, `Mobile verified status recorded: true`);
  assert(createdUser?.isVerified === true, `Email verified status recorded: true`);
  assert(createdUser?.pan === 'AABCS****B', `PAN masked in API response (AABCS****B) for data minimization`);
  assert(regRes.data?.data?.buyerCode?.startsWith('BYR-'), `Generated server-side buyer reference code (${regRes.data?.data?.buyerCode})`);
  assert(regRes.data?.data?.token !== undefined, `JWT authentication token generated`);

  // Test 8: Database Persistence & Address Creation in MySQL
  console.log('\nTest 8: Database Integrity & Primary Address Creation');
  const dbUser = await prisma.user.findUnique({
    where: { email: testBuyerEmail },
    include: { addresses: true },
  });
  assert(dbUser !== null, `User record exists in MySQL database`);
  assert(dbUser?.role === 'BUYER', `Database role is BUYER`);
  assert(dbUser?.gstin === '27AABCS1429B1Z8', `DB gstin stored correctly`);
  assert(dbUser?.pan === 'AABCS1429B', `DB pan stored safely`);
  assert(dbUser?.addresses?.length > 0, `Default Address created in addresses table`);
  assert(dbUser?.addresses[0]?.street === 'Sector 19, Vashi APMC Commercial Complex, Navi Mumbai', `Primary street address preserved`);
  assert(dbUser?.addresses[0]?.isDefault === true, `Address marked as default shipping/billing`);

  // Test 9: Duplicate Prevention (Email & Phone Uniqueness)
  console.log('\nTest 9: Abuse Prevention - Duplicate Email & Phone Handling');
  const dupEmailRes = await request('/auth/register-buyer', { method: 'POST' }, {
    ...buyerPayload,
    phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
  });
  assert(dupEmailRes.status === 409, `Rejects duplicate email with 409 Conflict (got ${dupEmailRes.status})`);

  const dupPhoneRes = await request('/auth/register-buyer', { method: 'POST' }, {
    ...buyerPayload,
    email: `unique.${timestamp}@example.com`,
  });
  assert(dupPhoneRes.status === 409, `Rejects duplicate mobile with 409 Conflict (got ${dupPhoneRes.status})`);

  // Test 10: International Buyer Flow (USA, no GSTIN, international postal code)
  console.log('\nTest 10: International Buyer Registration Flow');
  const intlEmail = `intl.procurement.${timestamp}@example.com`;
  const intlPhone = `+1 212 555 ${Math.floor(1000 + Math.random() * 9000)}`;
  const intlPayload = {
    name: 'Johnathan Miller',
    company: 'Miller Global Imports LLC',
    email: intlEmail,
    phone: intlPhone,
    country: 'United States',
    state: 'California',
    city: 'Los Angeles',
    postalCode: '90210',
    businessAddress: '9450 Wilshire Blvd, Suite 400',
    buyerTypes: ['Importer', 'Corporate Procurement'],
    businessDescription: 'Importer and nationwide distributor of industrial hardware.',
    taxId: 'US-95-1234567',
    password: 'Password@123',
    confirmPassword: 'Password@123',
    agreeTerms: true,
  };

  const intlRes = await request('/auth/register-buyer', { method: 'POST' }, intlPayload);
  assert(intlRes.status === 201, `International buyer registered successfully (got ${intlRes.status})`);
  assert(intlRes.data?.data?.user?.country === 'United States', `Country stored as United States`);
  assert(intlRes.data?.data?.user?.taxId === 'US-95-1234567', `International Tax ID stored`);

  // Cleanup test buyers
  try {
    await prisma.address.deleteMany({ where: { userId: dbUser?.id } });
    await prisma.user.delete({ where: { email: testBuyerEmail } });
    await prisma.user.delete({ where: { email: intlEmail } });
  } catch {}

  console.log('\n============================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runBuyerTests().catch((err) => {
  console.error('Test Suite encountered fatal error:', err);
  process.exit(1);
});
