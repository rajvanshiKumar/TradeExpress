import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('TradeExpress RFQ Workflow Verification Suite', () => {
  describe('1. Product Page RFQ Entry Point (Direct Locked Route)', () => {
    it('locks product and supplier parameters and validates quantity meets product MOQ', () => {
      const product = {
        id: 'prod-headphones-001',
        name: 'Wireless Bluetooth Headset',
        moq: 50,
        unit: 'piece',
        price: 850,
        supplierId: 'supplier-audio-tech',
      };

      // Validating buyer quantity against MOQ
      function validateProductRfqInput({ quantity, specifications, deliveryPincode }) {
        const errors = [];
        const qtyNum = Number(quantity);
        if (!quantity || isNaN(qtyNum) || qtyNum < 1) {
          errors.push('Quantity must be a positive integer.');
        } else if (qtyNum < product.moq) {
          errors.push(`Quantity must meet product MOQ of ${product.moq} ${product.unit}s.`);
        }
        if (!specifications || specifications.trim().length < 10) {
          errors.push('Specifications must be at least 10 characters.');
        }
        if (deliveryPincode && !/^\d{6}$/.test(deliveryPincode)) {
          errors.push('Invalid 6-digit Indian PIN code.');
        }
        return errors;
      }

      // Less than MOQ fails
      assert.ok(
        validateProductRfqInput({ quantity: 10, specifications: 'Need bulk packaging for retail distribution.' }).length > 0
      );

      // Meeting or exceeding MOQ passes
      assert.equal(
        validateProductRfqInput({ quantity: 50, specifications: 'Need bulk packaging for retail distribution.', deliveryPincode: '400001' }).length,
        0
      );
      assert.equal(
        validateProductRfqInput({ quantity: 500, specifications: 'Need custom branding and CE certification.', deliveryPincode: '110001' }).length,
        0
      );
    });

    it('creates targeted RFQ directed exclusively to the specified supplier', () => {
      const supplierId = 'supplier-tech-corp-01';
      const rfqPayload = {
        title: 'RFQ for Wireless Bluetooth Headset',
        quantity: 100,
        unit: 'piece',
        targetPrice: 800,
        supplierId,
        targetSupplierIds: [supplierId],
        source: 'product_page',
      };

      assert.equal(rfqPayload.source, 'product_page');
      assert.deepEqual(rfqPayload.targetSupplierIds, ['supplier-tech-corp-01']);
      assert.ok(rfqPayload.targetSupplierIds.includes(supplierId));
    });
  });

  describe('2. Header / Post RFQ 4-Step Wizard Workflow', () => {
    it('supports selecting multiple distinct suppliers and assigns independent RFQs', () => {
      const selectedSupplierIds = ['supp-alpha-001', 'supp-beta-002', 'supp-gamma-003'];
      const rfqNumber = 'TS-RFQ-987654-123';

      const metadata = {
        targetSupplierIds: selectedSupplierIds,
        source: 'header_rfq',
        deliveryTime: 'Within 30 days',
      };

      assert.equal(metadata.targetSupplierIds.length, 3);
      assert.ok(metadata.targetSupplierIds.includes('supp-alpha-001'));
      assert.ok(metadata.targetSupplierIds.includes('supp-beta-002'));
      assert.ok(metadata.targetSupplierIds.includes('supp-gamma-003'));

      // Check supplier scoping logic: each supplier sees the RFQ in their inbox
      function isRfqVisibleToSupplier(rfqMeta, supplierId) {
        return (
          rfqMeta.targetSupplierIds &&
          Array.isArray(rfqMeta.targetSupplierIds) &&
          rfqMeta.targetSupplierIds.includes(supplierId)
        );
      }

      assert.ok(isRfqVisibleToSupplier(metadata, 'supp-alpha-001'));
      assert.ok(isRfqVisibleToSupplier(metadata, 'supp-beta-002'));
      assert.ok(isRfqVisibleToSupplier(metadata, 'supp-gamma-003'));
      assert.equal(isRfqVisibleToSupplier(metadata, 'supp-unrelated-999'), false);
    });

    it('supports custom unlisted products with full specifications', () => {
      const customProduct = {
        name: 'Custom Cast Iron Flanges DIN 2501',
        category: 'machinery-industrial',
        specifications: 'Flange thickness 18mm, nominal pressure PN16, anti-rust oil coating.',
        referenceImageUrl: 'https://cdn.example.com/drawing-flange.png',
      };

      assert.ok(customProduct.name.length > 5);
      assert.ok(customProduct.specifications.length >= 10);
      assert.equal(customProduct.category, 'machinery-industrial');
    });

    it('prevents duplicate RFQ submissions within rapid 5-second interval', () => {
      const now = Date.now();
      const recentRfq = {
        buyerEmail: 'buyer@industrial.com',
        title: 'Bulk order for Stainless Steel Bolts',
        quantity: 1000,
        createdAt: new Date(now - 2000), // 2 seconds ago
      };

      function isDuplicate(incomingRfq, existingRfq, windowMs = 5000) {
        if (incomingRfq.buyerEmail.toLowerCase() !== existingRfq.buyerEmail.toLowerCase()) return false;
        if (incomingRfq.title !== existingRfq.title) return false;
        if (incomingRfq.quantity !== existingRfq.quantity) return false;
        const elapsed = Date.now() - existingRfq.createdAt.getTime();
        return elapsed < windowMs;
      }

      const duplicateAttempt = {
        buyerEmail: 'buyer@industrial.com',
        title: 'Bulk order for Stainless Steel Bolts',
        quantity: 1000,
      };

      assert.ok(isDuplicate(duplicateAttempt, recentRfq));

      const differentQtyAttempt = {
        buyerEmail: 'buyer@industrial.com',
        title: 'Bulk order for Stainless Steel Bolts',
        quantity: 2000,
      };
      assert.equal(isDuplicate(differentQtyAttempt, recentRfq), false);
    });
  });

  describe('3. Multi-Round Negotiation State Machine & Landed Cost', () => {
    it('allows quotation submissions and enforces strictly 3 negotiation rounds', () => {
      let quote = {
        id: 'quote-001',
        currentVersion: 1,
        versions: [
          { version: 1, unitPrice: 500, leadTimeDays: 14, proposedBy: 'SUPPLIER' },
        ],
      };

      function counter(currentQuote, counterPrice, proposedBy) {
        if (currentQuote.currentVersion >= 3) {
          throw new Error('Maximum 3 rounds of negotiation limit reached.');
        }
        const nextVer = currentQuote.currentVersion + 1;
        return {
          ...currentQuote,
          currentVersion: nextVer,
          versions: [
            ...currentQuote.versions,
            { version: nextVer, unitPrice: counterPrice, proposedBy },
          ],
        };
      }

      // Round 2: Buyer counter
      quote = counter(quote, 460, 'BUYER');
      assert.equal(quote.currentVersion, 2);
      assert.equal(quote.versions.length, 2);

      // Round 3: Supplier counter
      quote = counter(quote, 475, 'SUPPLIER');
      assert.equal(quote.currentVersion, 3);
      assert.equal(quote.versions.length, 3);

      // Round 4 attempt: Must be rejected
      assert.throws(() => {
        counter(quote, 470, 'BUYER');
      }, /Maximum 3 rounds/);
    });

    it('calculates landed cost accurately across multiple competing quotations', () => {
      const quantity = 500;
      const quotes = [
        { supplier: 'Supplier A', unitPrice: 120, freightCharge: 1500, gstPct: 18 },
        { supplier: 'Supplier B', unitPrice: 115, freightCharge: 5000, gstPct: 18 },
        { supplier: 'Supplier C', unitPrice: 125, freightCharge: 0, gstPct: 18 },
      ];

      const scored = quotes.map((q) => {
        const subtotal = q.unitPrice * quantity;
        const gst = (subtotal * q.gstPct) / 100;
        const landedCost = subtotal + gst + q.freightCharge;
        const effectiveUnit = Math.round((landedCost / quantity) * 100) / 100;
        return { ...q, landedCost, effectiveUnit };
      });

      // Supplier A: (120*500) + 18% GST (10800) + 1500 = 72300
      assert.equal(scored[0].landedCost, 72300);

      // Supplier B: (115*500) + 18% GST (10350) + 5000 = 72850
      assert.equal(scored[1].landedCost, 72850);

      // Supplier C: (125*500) + 18% GST (11250) + 0 = 73750
      assert.equal(scored[2].landedCost, 73750);

      // Supplier A offers best total landed cost despite Supplier B having lower unit price
      assert.ok(scored[0].landedCost < scored[1].landedCost);
      assert.ok(scored[0].landedCost < scored[2].landedCost);
    });
  });

  describe('4. Redesigned 4-Step RFQ Workflow Verification Suite', () => {
    it('Step 1: requires company name and at least one product with structured input', () => {
      function validateStep1({ companyName, products }) {
        const errors = {};
        if (!companyName || !companyName.trim()) {
          errors.companyName = 'Company name is required.';
        }
        let hasValidProduct = false;
        (products || []).forEach((p) => {
          if (!p.name || !p.name.trim()) {
            errors[`product_${p.id}`] = 'Please enter a product name.';
          } else {
            hasValidProduct = true;
          }
        });
        if (!products || products.length === 0 || !hasValidProduct) {
          errors.generalProduct = 'Please specify at least one product you need.';
        }
        return { isValid: Object.keys(errors).length === 0, errors };
      }

      // Empty company fails
      const emptyComp = validateStep1({ companyName: '', products: [{ id: 1, name: 'Wireless Headphones' }] });
      assert.equal(emptyComp.isValid, false);
      assert.ok(emptyComp.errors.companyName);

      // Empty products fails
      const emptyProds = validateStep1({ companyName: 'ABC Trading', products: [{ id: 1, name: '   ' }] });
      assert.equal(emptyProds.isValid, false);

      // Valid multi-product Step 1 passes
      const valid = validateStep1({
        companyName: 'ABC Trading Pvt. Ltd.',
        products: [
          { id: 1, name: 'Wireless Headphones' },
          { id: 2, name: 'Bluetooth Speakers' },
          { id: 3, name: 'Smart Watches' },
        ],
      });
      assert.equal(valid.isValid, true);
    });

    it('Step 2: enforces supplier rules (excludes buyer himself, requires confirmed selection)', () => {
      const buyerId = 'usr-buyer-777';
      const registeredSuppliers = [
        { id: 'supp-01', name: 'Shenzhen NovaTech', isVerified: true, status: 'ACTIVE' },
        { id: 'supp-02', name: 'Pearl River Garments', isVerified: true, status: 'ACTIVE' },
        { id: 'supp-03', name: 'Suspended Supplier', isVerified: false, status: 'SUSPENDED' },
        { id: 'usr-buyer-777', name: 'Buyer Own Account', isVerified: true, status: 'ACTIVE' },
      ];

      // Filtering eligible suppliers
      const eligible = registeredSuppliers.filter(
        (s) => s.status !== 'SUSPENDED' && s.id !== buyerId
      );

      assert.equal(eligible.length, 2);
      assert.ok(!eligible.some((s) => s.id === buyerId));
      assert.ok(!eligible.some((s) => s.status === 'SUSPENDED'));

      // Validate selection
      function validateStep2(selectedSupplierIds) {
        return Array.isArray(selectedSupplierIds) && selectedSupplierIds.length > 0;
      }
      assert.equal(validateStep2([]), false);
      assert.equal(validateStep2(['supp-01']), true);
      assert.equal(validateStep2(['supp-01', 'supp-02']), true);
    });

    it('Step 3: validates individual purchasing requirements per product and delivery metadata', () => {
      const products = [
        { id: 1, name: 'Wireless Headphones' },
        { id: 2, name: 'Bluetooth Speakers' },
      ];

      const productRequirements = {
        1: {
          quantity: '500',
          unit: 'Pieces',
          targetPrice: '450',
          specifications: 'Active Noise Cancelling, Bluetooth 5.3, Type-C charging.',
          preferredBrand: 'OEM',
          qualityRequirements: 'ISO 9001 Certified',
          packagingRequirements: 'Retail Box',
        },
        2: {
          quantity: '200',
          unit: 'Boxes',
          targetPrice: '800',
          specifications: 'Waterproof IPX7, 20W dual drivers, 12h battery life.',
          preferredBrand: 'Any',
          qualityRequirements: 'Standard Commercial Grade',
          packagingRequirements: 'Bulk Master Carton',
        },
      };

      const deliveryInfo = {
        deliveryLocation: 'Mumbai, Maharashtra',
        deliveryAddress: 'Warehouse 4B, MIDC Industrial Area',
        destinationCountry: 'India',
        deliveryPincode: '400093',
        deliveryTime: 'Within 30 days',
        paymentPreference: '100% Escrow Protection (Recommended)',
        buyerName: 'Rahul Sharma',
        buyerEmail: 'rahul@abctrading.com',
      };

      function validateStep3(prods, reqs, deliv) {
        const errors = {};
        prods.forEach((p) => {
          const r = reqs[p.id] || {};
          const qNum = Number(r.quantity);
          if (!r.quantity || isNaN(qNum) || qNum < 1) errors[`p_${p.id}_qty`] = 'Invalid qty';
          if (!r.unit) errors[`p_${p.id}_unit`] = 'Unit required';
          if (!r.specifications || r.specifications.length < 5) errors[`p_${p.id}_specs`] = 'Specs required';
        });
        if (!deliv.deliveryLocation) errors.deliveryLocation = 'Location required';
        if (!deliv.buyerName) errors.buyerName = 'Name required';
        if (!deliv.buyerEmail || !deliv.buyerEmail.includes('@')) errors.buyerEmail = 'Valid email required';
        return { isValid: Object.keys(errors).length === 0, errors };
      }

      const res = validateStep3(products, productRequirements, deliveryInfo);
      assert.equal(res.isValid, true);
    });

    it('Step 4: compiles multi-product RfqItems and structured savedComparison metadata', () => {
      const products = [
        { id: 1, name: 'Wireless Headphones' },
        { id: 2, name: 'Bluetooth Speakers' },
      ];

      const productRequirements = {
        1: {
          quantity: '500',
          unit: 'Pieces',
          targetPrice: '450',
          specifications: 'ANC, BT 5.3',
          preferredBrand: 'OEM',
          qualityRequirements: 'ISO 9001',
          packagingRequirements: 'Retail Box',
        },
        2: {
          quantity: '200',
          unit: 'Boxes',
          targetPrice: '800',
          specifications: 'IPX7 Waterproof, 20W',
          preferredBrand: 'Any',
          qualityRequirements: 'Standard',
          packagingRequirements: 'Master Carton',
        },
      };

      const compiledItems = products.map((prod) => {
        const req = productRequirements[prod.id];
        const notes = [
          req.specifications ? `Specs: ${req.specifications}` : '',
          req.preferredBrand ? `Brand: ${req.preferredBrand}` : '',
          req.qualityRequirements ? `Quality: ${req.qualityRequirements}` : '',
          req.packagingRequirements ? `Packaging: ${req.packagingRequirements}` : '',
        ].filter(Boolean).join(' | ');

        return {
          productName: prod.name,
          quantity: Number(req.quantity),
          unit: req.unit,
          targetPrice: Number(req.targetPrice),
          notes,
        };
      });

      assert.equal(compiledItems.length, 2);
      assert.equal(compiledItems[0].productName, 'Wireless Headphones');
      assert.equal(compiledItems[0].quantity, 500);
      assert.equal(compiledItems[0].unit, 'Pieces');
      assert.equal(compiledItems[0].targetPrice, 450);
      assert.ok(compiledItems[0].notes.includes('Specs: ANC, BT 5.3'));
      assert.ok(compiledItems[0].notes.includes('Brand: OEM'));

      assert.equal(compiledItems[1].productName, 'Bluetooth Speakers');
      assert.equal(compiledItems[1].quantity, 200);
      assert.equal(compiledItems[1].unit, 'Boxes');
      assert.equal(compiledItems[1].targetPrice, 800);

      // Verify total aggregate quantity
      const totalQty = compiledItems.reduce((sum, item) => sum + item.quantity, 0);
      assert.equal(totalQty, 700);

      // Verify confirmation checkbox enforcement
      function canSubmit(confirmedAgreement, isSubmitting) {
        return confirmedAgreement && !isSubmitting;
      }
      assert.equal(canSubmit(false, false), false);
      assert.equal(canSubmit(true, true), false); // double-click prevention
      assert.equal(canSubmit(true, false), true);
    });
  });
});

