import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSnapshot, cleanRegistrationNumber, parseProfilePhoto, validateLegalStructure, verificationStatus,
} from '../../src/services/supplierDocumentService.js';
import { certificateSvg } from '../../src/services/documents/certificateTemplate.js';
import { idCardBackSvg, idCardFrontSvg } from '../../src/services/documents/idCardTemplate.js';
import { renderCertificatePdf, renderIdCardPdf } from '../../src/services/documents/documentPdf.js';

const jpeg = (size = 32) => `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(size)]).toString('base64')}`;
// A real 1 x 1 pixel PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/AAAMBAQC0AaUcAAAAAElFTkSuQmCC';

const sample = (status, extra = {}) => ({
  supplierId: 'TE-SEL-000042', certificateNumber: 'TE-CERT-000042', supplierName: 'Asha Rao', ownerName: 'Asha Rao', businessName: 'Rao & Sons <Traders>',
  businessAddress: '12 Market Road, Pune', businessType: 'Partnership', registrationNumber: 'REG/1', gstin: '', status, issueDate: new Date('2026-01-05'),
  validUntil: status === 'VERIFIED' ? new Date('2027-01-05') : null, idCardValidUntil: status === 'VERIFIED' ? new Date('2028-01-05') : null,
  publicProfileUrl: 'https://www.tradeexpress.in/supplier/TE-SEL-000042', website: 'www.tradeexpress.in', supportEmail: 'support@tradeexpress.in',
  photo: PNG, signatory: { name: '', title: 'Authorised Signatory', signatureDataUrl: '' }, ...extra,
});

describe('Supplier verification status', () => {
  it('is VERIFIED only after the Super Admin review', () => {
    assert.equal(verificationStatus({ status: 'ACTIVE', kycStatus: 'VERIFIED' }), 'VERIFIED');
    assert.equal(verificationStatus({ status: 'ACTIVE', kycStatus: 'PENDING' }), 'PENDING');
    assert.equal(verificationStatus({ status: 'ACTIVE', kycStatus: 'NOT_SUBMITTED' }), 'PENDING');
    assert.equal(verificationStatus({ status: 'ACTIVE', kycStatus: 'RESUBMISSION_REQUESTED' }), 'PENDING');
    assert.equal(verificationStatus({ status: 'ACTIVE', kycStatus: 'REJECTED' }), 'REJECTED');
  });

  it('is not fooled by isVerified, which a Google sign-in can set', () => {
    assert.equal(verificationStatus({ status: 'ACTIVE', kycStatus: 'PENDING', isVerified: true }), 'PENDING');
  });

  it('shows SUSPENDED even for an approved supplier', () => {
    assert.equal(verificationStatus({ status: 'SUSPENDED', kycStatus: 'VERIFIED' }), 'SUSPENDED');
    assert.equal(verificationStatus({ status: 'ACTIVE', isActive: false, kycStatus: 'VERIFIED' }), 'SUSPENDED');
  });
});

describe('Supplier photograph validation', () => {
  it('accepts a real JPEG or PNG', () => {
    assert.equal(parseProfilePhoto(jpeg()).mime, 'image/jpeg');
    assert.equal(parseProfilePhoto(PNG).mime, 'image/png');
  });

  it('refuses a missing photograph, other types and files that only claim to be images', () => {
    assert.throws(() => parseProfilePhoto(''), { statusCode: 400 });
    assert.throws(() => parseProfilePhoto('https://example.com/a.jpg'), { statusCode: 400 });
    assert.throws(() => parseProfilePhoto('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='), { statusCode: 400 });
    assert.throws(() => parseProfilePhoto(`data:image/jpeg;base64,${Buffer.from('not an image').toString('base64')}`), { code: 'PHOTO_INVALID' });
    assert.throws(() => parseProfilePhoto(PNG.replace('image/png', 'image/jpeg')), { code: 'PHOTO_INVALID' });
  });

  it('refuses a photograph over 2 MB', () => {
    assert.throws(() => parseProfilePhoto(jpeg(2 * 1024 * 1024 + 1)), { code: 'PHOTO_TOO_LARGE' });
  });
});

describe('Supplier details on documents', () => {
  it('requires a listed business type', () => {
    assert.equal(validateLegalStructure('Private Limited'), 'Private Limited');
    assert.throws(() => validateLegalStructure(''), { statusCode: 400 });
    assert.throws(() => validateLegalStructure('Anything'), { statusCode: 400 });
  });

  it('cleans registration numbers and refuses unsafe ones', () => {
    assert.equal(cleanRegistrationNumber(' udyam-up-12-3456789 '), 'UDYAM-UP-12-3456789');
    assert.equal(cleanRegistrationNumber(''), null);
    assert.throws(() => cleanRegistrationNumber('<script>'), { statusCode: 400 });
  });

  it('uses the older certificate number when no registration number was asked for', () => {
    const base = { name: 'A', company: 'B', businessAddress: 'C' };
    assert.equal(buildSnapshot({ ...base, businessType: 'Udyam Registration', taxId: 'UDYAM-1' }).registrationNumber, 'UDYAM-1');
    assert.equal(buildSnapshot({ ...base, businessType: 'GST Certificate', taxId: '09ABC', gstin: '09ABC' }).registrationNumber, '');
    assert.equal(buildSnapshot({ ...base, legalStructure: 'Partnership', businessType: 'GST Certificate' }).businessType, 'Partnership');
  });
});

describe('Certificate and ID card templates', () => {
  const VERIFIED_WORDS = /VERIFIED<|Reviewed &amp; Verified|TRUSTED/;

  for (const status of ['PENDING', 'REJECTED', 'SUSPENDED', 'EXPIRED']) {
    it(`a ${status} document never claims to be verified`, () => {
      const documents = [certificateSvg(sample(status)), idCardFrontSvg(sample(status)), idCardBackSvg(sample(status))];
      documents.forEach((svg) => assert.doesNotMatch(svg, VERIFIED_WORDS));
      assert.match(documents[0], new RegExp(`>${status}<`));
      assert.match(documents[1], new RegExp(`>${status}<`));
    });
  }

  it('a VERIFIED document shows the verified wording', () => {
    assert.match(certificateSvg(sample('VERIFIED')), /Reviewed &amp; Verified by TradeExpress/);
    assert.match(idCardFrontSvg(sample('VERIFIED')), /TRUSTED/);
  });

  it('escapes supplier text, so a business name cannot break or inject into a document', () => {
    const svg = idCardFrontSvg(sample('PENDING', { businessName: '</text><script>alert(1)</script>' }));
    assert.doesNotMatch(svg, /<script/);
    assert.doesNotMatch(certificateSvg(sample('PENDING', { businessName: '<script>x</script>' })), /<script/);
  });

  it('prints no name or signature until a signatory is set', () => {
    const svg = certificateSvg(sample('VERIFIED'));
    assert.match(svg, /Authorised Signatory/);
    assert.doesNotMatch(svg, /Rohit Mehta|Arihant Jain/);
  });

  it('only embeds fonts in the preview version', () => {
    assert.doesNotMatch(certificateSvg(sample('PENDING')), /@font-face/);
    assert.match(certificateSvg(sample('PENDING'), { preview: true }), /@font-face/);
  });

  it('draws a different QR code for each supplier', () => {
    const qr = (svg) => /<path d="(M[^"]+h1v1h-1z)"/.exec(svg)?.[1];
    const a = certificateSvg(sample('PENDING'));
    const b = certificateSvg(sample('PENDING', { publicProfileUrl: 'https://www.tradeexpress.in/supplier/TE-SEL-000043' }));
    assert.ok(qr(a));
    assert.notEqual(qr(a), qr(b));
    // The certificate and the card carry the same code
    assert.equal(qr(a), qr(idCardBackSvg(sample('PENDING'))));
  });

  it('copes with very long details without failing', async () => {
    const long = 'Very Long Business Name International Trading And Manufacturing Private Limited '.repeat(4);
    const data = sample('PENDING', { businessName: long, businessAddress: long, supplierName: long, registrationNumber: 'X'.repeat(64) });
    assert.equal((await renderCertificatePdf(data)).subarray(0, 4).toString(), '%PDF');
    assert.equal((await renderIdCardPdf(data)).subarray(0, 4).toString(), '%PDF');
  });
});
