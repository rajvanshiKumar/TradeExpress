import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TERMS_SECTIONS, TERMS_METADATA } from '../src/data/termsData.js';

describe('Terms & Conditions Legal Compliance & Content Integrity Test Suite', () => {
  it('contains exactly 26 numbered sections from 1 to 26', () => {
    assert.equal(TERMS_SECTIONS.length, 26, 'Must contain all 26 official Terms & Conditions clauses');
    assert.equal(TERMS_METADATA.totalSections, 26);
    
    TERMS_SECTIONS.forEach((sec, idx) => {
      const expectedNum = String(idx + 1);
      assert.equal(sec.number, expectedNum, `Section ${idx + 1} must have number '${expectedNum}'`);
      assert.ok(sec.title && sec.title.length > 0, `Section ${sec.number} must have a non-empty title`);
      assert.ok(sec.badge && sec.badge.length > 0, `Section ${sec.number} must have a badge`);
      assert.ok(sec.summary && sec.summary.length > 0, `Section ${sec.number} must have a summary`);
      assert.ok(
        sec.paragraphs || sec.clauses || sec.subItems || sec.definitions,
        `Section ${sec.number} must have legal content`
      );
      assert.equal(sec.id, `section-${expectedNum}`);
    });
  });

  it('validates Section 1 contains Introduction, 18+ capacity and all 6 core definitions', () => {
    const sec1 = TERMS_SECTIONS.find((s) => s.number === '1');
    assert.ok(sec1, 'Section 1 must exist');
    assert.equal(sec1.title, 'INTRODUCTION AND ACCEPTANCE');
    assert.ok(Array.isArray(sec1.definitions));
    assert.equal(sec1.definitions.length, 6);
    
    const defTerms = sec1.definitions.map((d) => d.term);
    assert.ok(defTerms.includes('Buyer'));
    assert.ok(defTerms.includes('Seller or Supplier'));
    assert.ok(defTerms.includes('User'));
    assert.ok(defTerms.includes('Products'));
    assert.ok(defTerms.includes('Order'));
    assert.ok(defTerms.includes('Logistics Partner'));
  });

  it('validates Section 2 sets out the B2B marketplace facilitator role of TradeExpress', () => {
    const sec2 = TERMS_SECTIONS.find((s) => s.number === '2');
    assert.ok(sec2, 'Section 2 must exist');
    assert.equal(sec2.title, 'NATURE AND ROLE OF TRADEEXPRESS');
    assert.equal(sec2.clauses.length, 8);
  });

  it('validates Section 4 requires mandatory product specifications (4.2 a-j)', () => {
    const sec4 = TERMS_SECTIONS.find((s) => s.number === '4');
    assert.ok(sec4, 'Section 4 must exist');
    const clause42 = sec4.clauses.find((c) => c.id === '4.2');
    assert.ok(clause42, 'Clause 4.2 must exist');
    assert.equal(clause42.subItems.length, 10, 'Subitems a through j must exist');
  });

  it('validates Section 9 establishes Open-Box Inspection at Pickup (Clause 9.5)', () => {
    const sec9 = TERMS_SECTIONS.find((s) => s.number === '9');
    assert.ok(sec9, 'Section 9 must exist');
    assert.equal(sec9.title, 'DELIVERY AND LOGISTICS');
    assert.equal(sec9.badge, 'Freight & Inspection');
    
    const clause95 = sec9.clauses.find((c) => c.id === '9.5');
    assert.ok(clause95, 'Clause 9.5 must exist');
    assert.match(clause95.text, /open-box inspection/i);
  });

  it('validates Section 12 establishes 7-day reporting (12.3) and 5-day refund initiation (12.8)', () => {
    const sec12 = TERMS_SECTIONS.find((s) => s.number === '12');
    assert.ok(sec12, 'Section 12 must exist');
    assert.equal(sec12.title, 'RETURNS, REPLACEMENTS AND REFUNDS');
    
    const clause123 = sec12.clauses.find((c) => c.id === '12.3');
    assert.match(clause123.text, /7 days of delivery/i);

    const clause128 = sec12.clauses.find((c) => c.id === '12.8');
    assert.match(clause128.text, /5 business days after approval/i);
  });

  it('validates Section 22 defines designated Grievance Officer details and statutory SLAs', () => {
    const sec22 = TERMS_SECTIONS.find((s) => s.number === '22');
    assert.ok(sec22, 'Section 22 must exist');
    assert.equal(sec22.title, 'COMPLAINTS AND GRIEVANCE REDRESSAL');
    assert.equal(sec22.grievanceCard.email, 'support@tradeexpress.com');
    assert.equal(sec22.grievanceCard.contact, '+91 9600012345');
    assert.match(sec22.grievanceCard.sla, /48 hours/i);
  });

  it('validates Section 23 specifies Noida, Gautam Buddha Nagar, Uttar Pradesh jurisdiction', () => {
    const sec23 = TERMS_SECTIONS.find((s) => s.number === '23');
    assert.ok(sec23, 'Section 23 must exist');
    assert.equal(sec23.title, 'DISPUTE RESOLUTION AND GOVERNING LAW');
    
    const clause234 = sec23.clauses.find((c) => c.id === '23.4');
    assert.match(clause234.text, /Noida, Gautam buddha nagar, Uttar Pradesh India/i);
  });

  it('validates Section 26 contains TradeExpress registered office and support contact info', () => {
    const sec26 = TERMS_SECTIONS.find((s) => s.number === '26');
    assert.ok(sec26, 'Section 26 must exist');
    assert.equal(sec26.title, 'CONTACT INFORMATION');
    assert.equal(sec26.contactCard.email, 'support@tradeexpress.com');
    assert.equal(sec26.contactCard.phone, '+91 9600012345');
    assert.match(sec26.contactCard.address, /Sector 62, Noida, Gautam Buddha Nagar/i);
  });
});
