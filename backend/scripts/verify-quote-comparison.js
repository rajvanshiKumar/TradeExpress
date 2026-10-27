import prisma from '../src/config/db.js';
import * as productService from '../src/services/productService.js';
import * as rfqService from '../src/services/rfqService.js';
import bcrypt from 'bcryptjs';

async function runTests() {
  console.log('====================================================');
  console.log('Testing Product Search & Smart Quote Comparison');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Test Smart Product Search
    console.log('[Test 1] Testing Smart Product Search with filters...');
    const searchResult = await productService.listProducts({
      search: 'Headphones',
      limit: 10,
    });
    assert(searchResult.products.length > 0, `Search for 'Headphones' returned ${searchResult.products.length} products`);
    assert(searchResult.products[0].name.toLowerCase().includes('headphone') || searchResult.products[0].summary.toLowerCase().includes('headphone'), 'Returned product matches keyword search');

    // Filter by category
    const catResult = await productService.listProducts({
      category: 'electronics',
      limit: 10,
    });
    assert(catResult.products.length > 0, `Category filter for 'electronics' returned ${catResult.products.length} products`);

    // Filter by maxMoq
    const moqResult = await productService.listProducts({
      maxMoq: 150,
      limit: 10,
    });
    assert(moqResult.products.every(p => p.moq <= 150), 'All returned products respect maxMoq <= 150');

    // 2. Test getProductSuppliers
    console.log('\n[Test 2] Testing Product Supplier Listing (Genuine DB records)...');
    const firstProduct = searchResult.products[0];
    const supplierList = await productService.getProductSuppliers(firstProduct.slug);

    assert(supplierList.product && supplierList.product.id === firstProduct.id, 'Target product found');
    assert(Array.isArray(supplierList.suppliers) && supplierList.suppliers.length > 0, `Found ${supplierList.suppliers.length} genuine suppliers offering product`);
    
    const sampleSup = supplierList.suppliers[0];
    assert(typeof sampleSup.supplierId === 'string', 'Supplier has genuine supplierId');
    assert(typeof sampleSup.companyName === 'string' && sampleSup.companyName.length > 0, `Supplier has companyName: ${sampleSup.companyName}`);
    assert(typeof sampleSup.isVerified === 'boolean', `Supplier has genuine boolean isVerified: ${sampleSup.isVerified}`);
    assert(typeof sampleSup.location === 'string' && sampleSup.location.length > 0, `Supplier has location: ${sampleSup.location}`);
    assert(typeof sampleSup.availableQuantity === 'number', `Supplier has availableQuantity: ${sampleSup.availableQuantity}`);
    assert(typeof sampleSup.moq === 'number', `Supplier has MOQ: ${sampleSup.moq}`);
    assert(typeof sampleSup.price === 'number', `Supplier has price: ₹${sampleSup.price}`);
    assert(typeof sampleSup.leadTimeDays === 'number', `Supplier has leadTimeDays: ${sampleSup.leadTimeDays}d`);

    // 3. Test Smart Quote Comparison with multiple quotes on same RFQ
    console.log('\n[Test 3] Creating multi-supplier quotes for Smart Quote Comparison...');
    // Find or create test buyer and two suppliers
    const buyer = await prisma.user.findFirst({ where: { role: 'BUYER' } });
    const suppliers = await prisma.user.findMany({ where: { role: 'SUPPLIER' }, take: 2 });
    
    assert(buyer !== null, `Found test buyer (${buyer.email})`);
    assert(suppliers.length >= 1, `Found ${suppliers.length} test supplier(s) in database`);

    // Ensure we have a second supplier user for comparison
    let supplier2 = suppliers[1];
    if (!supplier2) {
      const pw = await bcrypt.hash('TradeSphere@2026', 10);
      supplier2 = await prisma.user.create({
        data: {
          email: `supplier2_test_${Date.now()}@example.com`,
          passwordHash: pw,
          name: 'Apex Precision Tools Ltd',
          company: 'Apex Precision Tools Ltd',
          role: 'SUPPLIER',
          city: 'Pune',
          country: 'India',
          isVerified: true,
          kycStatus: 'VERIFIED',
        },
      });
    }

    const supplier1 = suppliers[0];

    // Create an RFQ for 500 units
    const testRfq = await rfqService.createRfq({
      buyerId: buyer.id,
      buyerName: buyer.name,
      buyerEmail: buyer.email,
      buyerCompany: buyer.company,
      title: `Wholesale Comparison Test Order for ${firstProduct.name}`,
      categorySlug: firstProduct.categorySlug,
      targetPrice: 1200,
      quantity: 500,
      unit: 'piece',
      deliveryPincode: '400703',
      destinationCountry: 'India',
      specifications: 'Custom packaging with UV coating, ISO certified manufacturing.',
      items: [{
        productId: firstProduct.id,
        productName: firstProduct.name,
        quantity: 500,
        unit: 'piece',
      }],
    });
    assert(testRfq && testRfq.id, `Created RFQ #${testRfq.rfqNumber} for 500 pieces`);

    // Supplier 1 submits quote
    const quote1 = await rfqService.submitQuote(testRfq.id, {
      supplierId: supplier1.id,
      unitPrice: 1150,
      moq: 100,
      availableQuantity: 2000,
      gstPercentage: 18,
      freightCharge: 4500,
      otherCharges: 500,
      otherChargesDesc: 'Export palletizing fee',
      shippingMethod: 'Express Road Freight',
      leadTimeDays: 10,
      paymentTerms: '30% Advance, 70% Before Dispatch',
      sampleAvailable: true,
      sampleCost: 1500,
      notes: 'Direct factory pricing with expedited transit.',
    });
    assert(quote1 && quote1.quoteNumber, `Supplier 1 submitted Quote #${quote1.quoteNumber} (₹1,150/unit, 10 days)`);

    // Supplier 2 submits quote
    const quote2 = await rfqService.submitQuote(testRfq.id, {
      supplierId: supplier2.id,
      unitPrice: 1080,
      moq: 250,
      availableQuantity: 5000,
      gstPercentage: 18,
      freightCharge: 8000,
      otherCharges: 0,
      shippingMethod: 'Economy Surface Line',
      leadTimeDays: 18,
      paymentTerms: '100% Advance via Escrow',
      sampleAvailable: true,
      sampleCost: 1200,
      notes: 'Volume discount applied for 500+ units.',
    });
    assert(quote2 && quote2.quoteNumber, `Supplier 2 submitted Quote #${quote2.quoteNumber} (₹1,080/unit, 18 days)`);

    // 4. Test Comparison Endpoint & Landed Cost Breakdown
    console.log('\n[Test 4] Testing Smart Quote Comparison API calculation and highlights...');
    const comparison = await rfqService.getRfqComparison(testRfq.id, buyer);
    
    assert(comparison.summary.totalQuotes === 2, 'Comparison includes both competing supplier quotes');
    assert(comparison.quotations.length === 2, '2 quote columns returned');

    // Verify Landed Cost for Quote 1:
    // Subtotal = 1150 * 500 = 575,000
    // GST = 575,000 * 0.18 = 103,500
    // Freight = 4500
    // Other = 500
    // Total Landed Cost = 683,500
    const q1Result = comparison.quotations.find(q => q.supplierId === supplier1.id);
    assert(q1Result.calculation.subtotal === 575000, `Quote 1 Subtotal calculated correctly: ₹${q1Result.calculation.subtotal}`);
    assert(q1Result.calculation.gstAmount === 103500, `Quote 1 GST calculated correctly: ₹${q1Result.calculation.gstAmount}`);
    assert(q1Result.calculation.totalLandedCost === 683500, `Quote 1 Total Landed Cost calculated correctly: ₹${q1Result.calculation.totalLandedCost}`);
    assert(q1Result.calculation.effectiveUnitPrice === 1367, `Quote 1 Effective Unit Price: ₹${q1Result.calculation.effectiveUnitPrice}`);

    // Verify Comparative Highlights:
    // Supplier 2 has lowest unit price (1080 < 1150)
    // Supplier 1 has shortest lead time (10 < 18)
    const q2Result = comparison.quotations.find(q => q.supplierId === supplier2.id);
    assert(q2Result.highlights.isLowestUnitPrice === true, 'Quote 2 marked as Lowest Unit Price');
    assert(q1Result.highlights.isShortestLeadTime === true, 'Quote 1 marked as Shortest Lead Time');
    assert(q2Result.highlights.isShortestLeadTime === false, 'Quote 2 is NOT shortest lead time');

    // 5. Test IDOR Protection
    console.log('\n[Test 5] Testing Security & Competitor IDOR Protection...');
    try {
      // Supplier 1 tries to view the comparison with competitor's quotes
      await rfqService.getRfqComparison(testRfq.id, supplier1);
      assert(false, 'Should have blocked supplier from viewing competitor comparison');
    } catch (err) {
      assert(err.statusCode === 403, `Blocked unauthorized competitor with 403 Forbidden: "${err.message}"`);
    }

    // 6. Test Save Comparison Preferences
    console.log('\n[Test 6] Testing Save Comparison Preferences...');
    const saved = await rfqService.saveComparisonPreferences(testRfq.id, buyer.id, {
      shortlistedQuoteIds: [quote2.id],
      preferredSort: 'totalCost',
      buyerNotes: 'Considering Supplier 2 due to lower total cost despite longer transit.',
    });
    assert(saved && saved.preferredSort === 'totalCost', 'Saved comparison preferences successfully in MySQL');

    // Clean up test RFQ and quotes
    await prisma.quotationVersion.deleteMany({ where: { quotationId: { in: [quote1.id, quote2.id] } } });
    await prisma.quotation.deleteMany({ where: { rfqId: testRfq.id } });
    await prisma.rfqItem.deleteMany({ where: { rfqId: testRfq.id } });
    await prisma.rfq.delete({ where: { id: testRfq.id } });
    console.log('\nCleaned up test RFQ records.');

    console.log('\n====================================================');
    console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) process.exit(1);
  } catch (error) {
    console.error('Fatal test error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
