import { describe, it } from 'node:test';
import assert from 'node:assert';
import { numberToIndianWords } from '../src/utils/numberToIndianWords.js';
import { generateTaxInvoiceHtml } from '../src/utils/taxInvoiceGenerator.js';

describe('TradeExpress GST Tax Invoice & PDF Structure Suite', () => {
  describe('1. Number to Indian Currency Words Conversion', () => {
    it('converts amounts to exact Indian numbering system words (Lakhs, Thousands)', () => {
      assert.strictEqual(
        numberToIndianWords(531000),
        'INR Five Lakh Thirty One Thousand Only'
      );
      assert.strictEqual(
        numberToIndianWords(81000),
        'INR Eighty One Thousand Only'
      );
      assert.strictEqual(
        numberToIndianWords(450000),
        'INR Four Lakh Fifty Thousand Only'
      );
      assert.strictEqual(
        numberToIndianWords(1000000),
        'INR Ten Lakh Only'
      );
      assert.strictEqual(
        numberToIndianWords(12500000),
        'INR One Crore Twenty Five Lakh Only'
      );
    });

    it('handles decimal paise values accurately', () => {
      assert.strictEqual(
        numberToIndianWords(50000.5),
        'INR Fifty Thousand and Paise Fifty Only'
      );
      assert.strictEqual(
        numberToIndianWords(0),
        'INR Zero Only'
      );
    });
  });

  describe('2. Master Tax Invoice Page 1 Structure & B2B Content', () => {
    const mockOrder = {
      id: 'ord_12345',
      orderNumber: 'TS-261029-918234',
      supplierInvoiceNumber: 'INV-2026-0101',
      createdAt: '2026-10-29T10:00:00.000Z',
      supplier: {
        company: 'VARDHMAN FINANCIAL SERVICES',
        address: '12-5-14/5/A, 402, 6TH FLOOR MAH MANOR, MASAB TANK',
        city: 'HYDERABAD',
        state: 'Telangana',
        pincode: '500028',
        gstin: '07AABCV4677N1ZO',
      },
      buyerCompany: 'MANISH YADAV',
      buyerGstin: '09AAACM1234F1Z5',
      deliveryAddress: {
        street: 'Karnai, Karnai, Karnai',
        city: 'Ballia',
        state: 'Uttar Pradesh',
        pincode: '277304',
      },
      items: [
        {
          productName: 'Service Charge / Industrial Machinery Consignment',
          hsnCode: '9971',
          quantity: 1,
          unit: 'LOT',
          unitPrice: 450000,
          lineTotal: 450000,
          gstRate: 18,
        },
      ],
      subtotal: 450000,
      total: 531000,
      paymentMethod: 'online',
      paymentStatus: 'PAID',
      isInterState: false,
      cgst: 40500,
      sgst: 40500,
      trackingNumber: 'DEL-LR-987654',
      carrierName: 'Delhivery B2B Express',
    };

    it('generates the Tax Invoice header, invoice number, date and copy indicator', () => {
      const html = generateTaxInvoiceHtml(mockOrder, { role: 'buyer' });
      assert.ok(html.includes('<h1>Tax Invoice</h1>'), 'Document must contain Tax Invoice header');
      assert.ok(html.includes('Original for Recipient'), 'Buyer copy must have recipient tag');
      assert.ok(html.includes('Triplicate for Supplier') === false);
      assert.ok(generateTaxInvoiceHtml(mockOrder, { role: 'supplier' }).includes('Triplicate for Supplier'));
      assert.ok(html.includes('INV-2026-0101'), 'Must include invoice number');
      assert.ok(html.includes('29 Oct 26'), 'Date is printed as dd Mon yy');
    });

    it('places seller (with state code and GSTIN) above buyer in the left column', () => {
      const html = generateTaxInvoiceHtml(mockOrder);
      assert.ok(html.includes('VARDHMAN FINANCIAL SERVICES'));
      assert.ok(html.includes('State Name : Telangana, Code : 36'));
      assert.ok(html.includes('07AABCV4677N1ZO'));
      assert.ok(html.includes('Buyer (Bill to)'));
      assert.ok(html.includes('MANISH YADAV'));
      assert.ok(html.includes('Karnai, Karnai, Karnai, Ballia, Uttar Pradesh, 277304'));
      assert.ok(html.includes('09AAACM1234F1Z5'));
      assert.ok(html.indexOf('VARDHMAN FINANCIAL SERVICES') < html.indexOf('Buyer (Bill to)'));
    });

    it('renders the reference grid with real order data only', () => {
      const html = generateTaxInvoiceHtml(mockOrder);
      for (const label of ['Delivery Note', 'Mode/Terms of Payment', 'Reference No. &amp; Date.', 'Other References', 'Buyer\'s Order No.', 'Dispatch Doc No.', 'Delivery Note Date', 'Dispatched through', 'Destination', 'Terms of Delivery']) {
        assert.ok(html.includes(label), `grid label ${label}`);
      }
      assert.ok(html.includes('DEL-LR-987654'));
      assert.ok(html.includes('Delhivery B2B Express'));
      assert.ok(html.includes('Ballia, Uttar Pradesh'));
      assert.ok(html.includes('Online - Paid'));
      assert.ok(html.includes('TS-261029-918234'));
    });

    it('renders particulars with HSN/SAC, tax ledger lines (rate in Rate column, % in per) and total', () => {
      const html = generateTaxInvoiceHtml(mockOrder);
      assert.ok(html.includes('9971'));
      assert.ok(html.includes('4,50,000.00'));
      assert.match(html, /OUTPUT CGST<\/td>\s*<td><\/td><td><\/td>\s*<td class="r b">9<\/td>\s*<td class="c">%<\/td>\s*<td class="r b">40,500.00/);
      assert.match(html, /Output- SGST<\/td>\s*<td><\/td><td><\/td>\s*<td class="r b">9<\/td>/);
      assert.ok(html.includes('Rs 5,31,000.00'));
      assert.ok(!html.includes('Round Off'), 'No round-off line when the figures already add up');
    });

    it('renders the HSN/SAC summary and both amounts in words', () => {
      const html = generateTaxInvoiceHtml(mockOrder);
      assert.ok(html.includes('Taxable<br>Value'));
      assert.ok(html.includes('SGST/UTGST'));
      assert.ok(html.includes('81,000.00'));
      assert.ok(html.includes('Amount Chargeable (in words)'));
      assert.ok(html.includes('INR Five Lakh Thirty One Thousand Only'));
      assert.ok(html.includes('Tax Amount (in words)'));
      assert.ok(html.includes('INR Eighty One Thousand Only'));
      assert.ok(html.includes('E. &amp; O.E'));
    });

    it('includes remarks, the seller signatory box and computer-generated certification without invented names', () => {
      const html = generateTaxInvoiceHtml(mockOrder);
      assert.ok(html.includes('Remarks:'));
      assert.ok(html.includes('TradeExpress order TS-261029-918234 dated 29 Oct 26.'));
      assert.ok(html.includes('for VARDHMAN FINANCIAL SERVICES'));
      assert.ok(html.includes('Authorised Signatory'));
      assert.ok(html.includes('This is a Computer Generated Invoice'));
      assert.ok(!html.includes('Manish Kumar'), 'No hardcoded signatory name');
      assert.ok(!html.includes('non refundable'), 'No remark contradicting the refund terms');
    });
  });

  describe('3. Tax handling and data integrity', () => {
    it('uses each item\'s own GST rate and shows IGST for inter-state supply', () => {
      const html = generateTaxInvoiceHtml({
        orderNumber: 'TS-1', supplierInvoiceNumber: 'TS-INV-1', isInterState: true, igst: 1200, total: 11200,
        items: [{ productName: 'Steel bolts', hsnCode: '7318', quantity: 100, unit: 'piece', unitPrice: 100, lineTotal: 10000, gstRate: 12 }],
      });
      assert.ok(html.includes('OUTPUT IGST'));
      assert.ok(!html.includes('OUTPUT CGST'));
      assert.match(html, /<td class="c">12%<\/td><td class="r">1,200.00<\/td>/);
      assert.ok(html.includes('100 piece'));
    });

    it('splits tax across HSN rows that have different rates', () => {
      const html = generateTaxInvoiceHtml({
        supplierInvoiceNumber: 'TS-INV-2', isInterState: false, cgst: 1500, sgst: 1500, total: 23000,
        items: [
          { productName: 'A', hsnCode: '1111', quantity: 1, unitPrice: 10000, lineTotal: 10000, gstRate: 18 },
          { productName: 'B', hsnCode: '2222', quantity: 1, unitPrice: 10000, lineTotal: 10000, gstRate: 12 },
        ],
      });
      assert.ok(html.includes('<td class="c">9%</td><td class="r">900.00</td>'));
      assert.ok(html.includes('<td class="c">6%</td><td class="r">600.00</td>'));
      // Mixed rates: the tax ledger lines show no single rate
      assert.match(html, /OUTPUT CGST<\/td>\s*<td><\/td><td><\/td>\s*<td class="r b"><\/td>/);
    });

    it('prints a Proforma Invoice when the seller has not issued an invoice number yet', () => {
      const html = generateTaxInvoiceHtml({ orderNumber: 'TS-9', createdAt: '2026-10-29T10:00:00Z', items: [] });
      assert.ok(html.includes('<h1>Proforma Invoice</h1>'));
      assert.ok(html.includes('Proforma Invoice No.'));
      assert.ok(html.includes('TS-9'));
    });

    it('accepts browser-formatted orders (name, line1/line2, totals) and adds freight and round-off lines', () => {
      const html = generateTaxInvoiceHtml({
        id: 'TS-O-1', orderNumber: 'TS-O-1', supplierInvoiceNumber: 'TS-INV-3', buyerName: 'Asha Rao',
        address: { name: 'Asha Rao', line1: '12 MG Road', line2: 'Floor 3', city: 'Pune', state: 'Maharashtra', postalCode: '411001' },
        items: [{ name: 'Cotton rolls', quantity: 2, unit: 'roll', unitPrice: 500, lineTotal: 1000 }],
        totals: { subtotal: 1000, shipping: 100, tax: 180, total: 1280.4 },
      });
      assert.ok(html.includes('Cotton rolls'));
      assert.ok(html.includes('12 MG Road, Floor 3, Pune, Maharashtra, 411001'));
      assert.ok(html.includes('Freight / Shipping Charges'));
      assert.ok(html.includes('Round Off'));
      assert.ok(html.includes('Rs 1,280.40'));
    });

    it('escapes user-supplied text and never invents seller details', () => {
      const html = generateTaxInvoiceHtml({ buyerName: '<script>alert(1)</script>', items: [] });
      assert.ok(!html.includes('<script>alert(1)</script>'));
      assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
      assert.ok(html.includes('Seller details not available'));
      assert.ok(!html.includes('09AABCT1234F1Z8'), 'No placeholder GSTIN');
      assert.ok(!html.includes('Noida, Gautam Buddha Nagar</div>'), 'No placeholder seller address');
    });
  });

  describe('4. Page 2 Basic Terms & Conditions', () => {
    it('lists 13 basic terms taken from the TradeExpress Terms and Conditions', () => {
      const html = generateTaxInvoiceHtml({ id: 'dummy' }, { siteUrl: 'https://example.test' });
      assert.ok(html.includes('BASIC TERMS &amp; CONDITIONS (TRADEEXPRESS B2B MARKETPLACE)'));
      assert.strictEqual((html.match(/<li><b>/g) || []).length, 13);
      for (const heading of ['Tax Invoice &amp; GST', 'Payment &amp; Settlement', 'Returns &amp; Refunds', 'Governing Law &amp; Jurisdiction', 'Grievances']) {
        assert.ok(html.includes(heading), heading);
      }
      assert.ok(html.includes('within 7 days of delivery'));
      assert.ok(html.includes('Noida, Gautam Buddha Nagar, Uttar Pradesh, India'));
      assert.ok(html.includes('support@tradeexpress.com'));
      assert.ok(html.includes('https://example.test/terms'));
    });
  });
});

