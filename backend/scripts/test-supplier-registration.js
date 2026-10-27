import prisma from '../src/config/db.js';
import * as authService from '../src/services/authService.js';

async function runSupplierRegistrationTests() {
  console.log('========================================================');
  console.log('🧪 Starting TradeExpress Supplier Registration Test Suite');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  function assert(cond, msg) {
    total++;
    if (cond) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  const testEmailIndia = `test.supplier.india.${Date.now()}@tradeexpress.com`;
  const testEmailGlobal = `test.supplier.global.${Date.now()}@tradeexpress.com`;
  const testPhoneIndia = `+91 98${Math.floor(10000000 + Math.random() * 89999999)}`;
  const testPhoneGlobal = `+1 212${Math.floor(1000000 + Math.random() * 8999999)}`;

  try {
    // 1. Indian Supplier with Valid GSTIN & PAN
    console.log('[Test 1] Registering Indian Manufacturer with valid GSTIN & PAN...');
    const indiaSupplierRes = await authService.registerSupplier({
      name: 'Rohan Mehra',
      companyName: 'Mehra Precision Engineering Pvt Ltd',
      email: testEmailIndia,
      password: 'SupplierPass@123',
      phone: testPhoneIndia,
      country: 'India',
      state: 'Maharashtra',
      city: 'Pune',
      postalCode: '411001',
      businessAddress: 'Plot 42, Bhosari MIDC Industrial Area',
      factoryAddressSame: true,
      businessType: 'Manufacturer',
      gstStatus: 'Regular GST Registration',
      taxId: '27ABCDE1234F1Z5',
      panNumber: 'ABCDE1234F',
      yearEstablished: 2010,
      companyDescription: 'Premier CNC machining and aerospace precision components manufacturer.',
      documents: [
        {
          type: 'GST_CERTIFICATE',
          docNumber: 'REG-06-27ABCDE1234F1Z5',
          fileUrl: '/uploads/gst_sample.pdf',
          fileName: 'gst_certificate.pdf',
          fileSize: 102400,
        },
      ],
    });

    assert(indiaSupplierRes.user.role === 'SUPPLIER', 'Role assigned as SUPPLIER');
    assert(indiaSupplierRes.user.kycStatus === 'PENDING', 'KYC status set to PENDING');
    assert(indiaSupplierRes.user.isVerified === false, 'isVerified initialized to false');
    assert(
      typeof indiaSupplierRes.user.supplierCode === 'string' &&
      indiaSupplierRes.user.supplierCode.startsWith('SUP-'),
      `Server-generated unique supplier code: ${indiaSupplierRes.user.supplierCode}`
    );
    assert(indiaSupplierRes.user.gstStatus === 'Regular GST Registration', 'GST status correctly saved');
    assert(indiaSupplierRes.user.taxId === '27ABCDE1234F1Z5', 'GSTIN correctly persisted');
    assert(indiaSupplierRes.user.panNumber === 'ABCDE1234F', 'PAN correctly persisted');
    assert(indiaSupplierRes.documentsCount === 1, 'Supporting KYC document created in database');
    assert(Boolean(indiaSupplierRes.token), 'JWT Token generated for registered supplier');

    // 2. Reject Invalid GSTIN Format for Indian Regular GST
    console.log('\n[Test 2] Ensuring Invalid Indian GSTIN is rejected by backend...');
    let threwForInvalidGst = false;
    try {
      await authService.registerSupplier({
        name: 'Invalid GST Supplier',
        companyName: 'Bad Tax Corp',
        email: `badgst.${Date.now()}@tradeexpress.com`,
        password: 'Password@123',
        phone: '+91 9876543211',
        country: 'India',
        businessAddress: 'Address line',
        businessType: 'Manufacturer',
        gstStatus: 'Regular GST Registration',
        taxId: 'INVALID_GST_123',
      });
    } catch (err) {
      threwForInvalidGst = true;
      assert(err.message.includes('GSTIN'), `Caught expected error: ${err.message}`);
    }
    assert(threwForInvalidGst, 'Backend strictly enforces Indian GSTIN regex validation');

    // 3. International / Global Supplier (United States)
    console.log('\n[Test 3] Registering Global Supplier (United States) without Indian GSTIN...');
    const globalSupplierRes = await authService.registerSupplier({
      name: 'Michael Vance',
      companyName: 'Vance Dynamics Inc',
      email: testEmailGlobal,
      password: 'SupplierPass@123',
      phone: testPhoneGlobal,
      country: 'United States',
      state: 'California',
      city: 'San Jose',
      postalCode: '95112',
      businessAddress: '100 Innovation Way, Suite 400',
      factoryAddressSame: false,
      factoryAddress: '250 Factory Blvd, Fremont, CA 94538',
      businessType: 'Exporter',
      taxId: 'US-EIN-12-3456789',
      yearEstablished: 2018,
      companyDescription: 'Specialty high-efficiency solar invertor technology and global exporter.',
    });

    assert(globalSupplierRes.user.role === 'SUPPLIER', 'Global supplier role is SUPPLIER');
    assert(globalSupplierRes.user.country === 'United States', 'Country saved as United States');
    assert(globalSupplierRes.user.taxId === 'US-EIN-12-3456789', 'International Tax ID persisted without GST format error');
    assert(
      typeof globalSupplierRes.user.supplierCode === 'string' &&
      globalSupplierRes.user.supplierCode.startsWith('SUP-'),
      `Global supplier assigned code: ${globalSupplierRes.user.supplierCode}`
    );

    // 4. Duplicate Email Rejection
    console.log('\n[Test 4] Ensuring duplicate supplier email is safely rejected...');
    let duplicateRejected = false;
    try {
      await authService.registerSupplier({
        name: 'Duplicate Guy',
        companyName: 'Duplicate Corp',
        email: testEmailIndia,
        password: 'Password@123',
        country: 'India',
        businessType: 'Distributor',
      });
    } catch (err) {
      duplicateRejected = true;
      assert(err.message.includes('already exists'), `Caught duplicate error: ${err.message}`);
    }
    assert(duplicateRejected, 'Duplicate account registration properly rejected');

    console.log('\n========================================================');
    console.log(`🎉 All ${passed}/${total} Supplier Registration Tests Passed!`);
    console.log('========================================================');
  } finally {
    // Clean up test users
    await prisma.kycDocument.deleteMany({
      where: { user: { email: { in: [testEmailIndia, testEmailGlobal] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [testEmailIndia, testEmailGlobal] } },
    });
    console.log('🧹 Cleaned up temporary test supplier records.');
    await prisma.$disconnect();
  }
}

runSupplierRegistrationTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
