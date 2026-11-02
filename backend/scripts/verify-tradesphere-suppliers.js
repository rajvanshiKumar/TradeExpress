import assert from 'assert';
import * as productService from '../src/services/productService.js';
import prisma from '../src/config/db.js';

async function runTests() {
  console.log('====================================================');
  console.log('TradeSphere-Only Supplier Comparison Verification');
  console.log('====================================================\n');

  // Test 1: Query suppliers for a product with multiple TradeSphere listings
  console.log('[Test 1] Querying suppliers for "wireless-noise-cancelling-headphones"...');
  const res = await productService.getProductSuppliers('wireless-noise-cancelling-headphones');

  assert(res && res.product, 'Product should be returned');
  assert(Array.isArray(res.suppliers), 'Suppliers should be an array');
  assert(res.suppliers.length >= 2, `Expected at least 2 TradeSphere suppliers, got ${res.suppliers.length}`);
  console.log(`  ✓ PASS: Found ${res.suppliers.length} active TradeSphere suppliers with actual listings`);

  // Test 2: Verify every supplier is registered on TradeSphere with role SUPPLIER
  console.log('\n[Test 2] Verifying all returned suppliers are TradeSphere registered suppliers...');
  for (const s of res.suppliers) {
    const user = await prisma.user.findUnique({
      where: { id: s.supplierId },
    });
    assert(user, `Supplier user ${s.supplierId} must exist in TradeSphere database`);
    assert.strictEqual(user.role, 'SUPPLIER', `User ${user.id} must have role SUPPLIER`);
    console.log(`  ✓ PASS: Supplier "${s.companyName}" (${user.email}) is genuine TradeSphere SUPPLIER in MySQL`);
  }

  // Test 3: Verify all 7 required database fields are present and real
  console.log('\n[Test 3] Verifying required database information fields...');
  for (const s of res.suppliers) {
    assert(typeof s.price === 'number' && s.price > 0, `Price must be valid number, got ${s.price}`);
    assert(typeof s.moq === 'number' && s.moq > 0, `MOQ must be positive number, got ${s.moq}`);
    assert(typeof s.availableQuantity === 'number' && s.availableQuantity >= 0, `Stock must be >= 0, got ${s.availableQuantity}`);
    assert(typeof s.shippingCost === 'number' && s.shippingCost > 0, `Shipping cost must be positive number, got ${s.shippingCost}`);
    assert(typeof s.estimatedDelivery === 'string' && s.estimatedDelivery.length > 0, `Estimated delivery required, got ${s.estimatedDelivery}`);
    assert(typeof s.paymentTerms === 'string' && s.paymentTerms.length > 0, `Payment terms required, got ${s.paymentTerms}`);
    assert(Array.isArray(s.qualityCertifications) && s.qualityCertifications.length > 0, `Quality certifications must be non-empty array, got ${JSON.stringify(s.qualityCertifications)}`);
  }
  console.log('  ✓ PASS: All 7 required database fields (price, MOQ, stock, shipping cost, delivery, payment terms, certifications) are verified');

  // Test 4: Verify NO external or arbitrary fallback suppliers exist without a listing
  console.log('\n[Test 4] Verifying NO suppliers without actual product listing are included...');
  for (const s of res.suppliers) {
    const listing = await prisma.product.findFirst({
      where: {
        id: s.productId,
        supplierId: s.supplierId,
        status: 'Active',
      },
    });
    assert(listing, `Supplier ${s.supplierId} must have an actual active listing in MySQL for product ${s.productId}`);
  }
  console.log('  ✓ PASS: Every returned supplier has a genuine, verified product listing in MySQL');

  // Test 5: Test Side-by-Side Supplier Comparison API
  console.log('\n[Test 5] Testing compareProductSuppliers with selected TradeSphere suppliers...');
  const selectedIds = res.suppliers.slice(0, 2).map((s) => s.supplierId);
  const comparison = await productService.compareProductSuppliers('wireless-noise-cancelling-headphones', selectedIds);

  assert.strictEqual(comparison.totalCompared, 2, 'Should compare exactly 2 selected suppliers');
  assert(comparison.spreadSummary, 'Spread summary should be calculated');
  assert(comparison.spreadSummary.minPrice > 0, 'Min price in spread must be positive');

  for (const cs of comparison.suppliers) {
    assert(cs.calculations, 'Calculations must be present');
    assert(cs.calculations.totalLandedCostAtMoq > 0, 'Total landed cost at MOQ must be positive');
    assert(cs.calculations.shippingCost > 0, 'Shipping cost must be present');
    assert(cs.highlights, 'Highlights must be present');
  }
  console.log(`  ✓ PASS: Side-by-side comparison calculated landed cost at MOQ: ₹${comparison.suppliers[0].calculations.totalLandedCostAtMoq} vs ₹${comparison.suppliers[1].calculations.totalLandedCostAtMoq}`);

  // Test 6: Verify exclusion of non-existent / external supplier IDs
  console.log('\n[Test 6] Testing exclusion of external/fake supplier ID...');
  const comparisonFiltered = await productService.compareProductSuppliers('wireless-noise-cancelling-headphones', [
    selectedIds[0],
    'external-fake-supplier-999',
  ]);
  assert.strictEqual(comparisonFiltered.totalCompared, 1, 'Fake external supplier must be excluded from TradeSphere comparison');
  console.log('  ✓ PASS: External/unregistered supplier ID was excluded strictly by backend API');

  console.log('\n====================================================');
  console.log('🎉 ALL TRADESPEHERE SUPPLIER COMPARISON TESTS PASSED!');
  console.log('====================================================');
}

runTests()
  .catch((e) => {
    console.error('Test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
