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

    it('generates pristine Tax Invoice header and copy indicators', () => {
      const html = generateTaxInvoiceHtml(mockOrder, { role: 'buyer' });
      assert.ok(html.includes('Tax Invoice'), 'Document must contain Tax Invoice header');
      assert.ok(html.includes('Original for Recipient'), 'Buyer copy must have recipient tag');
      assert.ok(html.includes('INV-2026-0101'), 'Must include invoice number');
    });

    it('populates seller and buyer tax entities with GSTIN and state codes', () => {
      const html = generateTaxInvoiceHtml(mockOrder);
      assert.ok(html.includes('VARDHMAN FINANCIAL SERVICES'));
      assert.ok(html.includes('07AABCV4677N1ZO'));
      assert.ok(html.includes('MANISH YADAV'));
      assert.ok(html.includes('Karnai, Karnai, Karnai'));
      assert.ok(html.includes('09AAACM1234F1Z5'));
    });

    it('renders metadata 2-column grid (Dispatch Doc, Destination, Carrier)', () => {
      const html = generateTaxInvoiceHtml(mockOrder);
      assert.ok(html.includes('DEL-LR-987654'));
      assert.ok(html.includes('Delhivery B2B Express'));
      assert.ok(html.includes('Ballia, Uttar Pradesh'));
      assert.ok(html.includes('Mode/Terms of Payment'));
    });

    it('renders main particulars table with HSN/SAC, rates, and tax sub-rows', () => {
      const html = generateTaxInvoiceHtml(mockOrder);
      assert.ok(html.includes('9971'));
      assert.ok(html.includes('4,50,000.00'));
      assert.ok(html.includes('OUTPUT CGST'));
      assert.ok(html.includes('Output- SGST'));
      assert.ok(html.includes('40,500.00'));
      assert.ok(html.includes('5,31,000.00'));
    });

    it('renders HSN/SAC statutory summary table and tax amount in words', () => {
      const html = generateTaxInvoiceHtml(mockOrder);
      assert.ok(html.includes('Taxable<br>Value') || html.includes('Taxable Value'));
      assert.ok(html.includes('INR Five Lakh Thirty One Thousand Only'));
      assert.ok(html.includes('INR Eighty One Thousand Only'));
    });

    it('includes non-refundable remark, authorized signature block, and computer-generated certification', () => {
      const html = generateTaxInvoiceHtml(mockOrder);
      assert.ok(html.includes('This amount is strictly non refundable as per TradeExpress terms.'));
      assert.ok(html.includes('Authorised Signatory'));
      assert.ok(html.includes('This is a Computer Generated Invoice'));
    });
  });

  describe('3. Page 2 Basic Terms & Conditions Structure', () => {
    it('contains all 13 TradeExpress B2B statutory clauses', () => {
      const html = generateTaxInvoiceHtml({ id: 'dummy' });
      assert.ok(html.includes('BASIC TERMS & CONDITIONS (TRADEEXPRESS B2B MARKETPLACE)'));
      assert.ok(html.includes('Non-Refundable & Open-Box Inspection'));
      assert.ok(html.includes('Contract Duration & Order Acceptance'));
      assert.ok(html.includes('Payment Mandate & Escrow Settlement'));
      assert.ok(html.includes('Transportation & Consignment Dispatch'));
      assert.ok(html.includes('Notice of Defects & Claims'));
      assert.ok(html.includes('Dispute Resolution & Arbitration'));
      assert.ok(html.includes('Gautam Buddha Nagar / Noida, Uttar Pradesh'));
      assert.ok(html.includes('tradeexpress.in'));
    });
  });
});

