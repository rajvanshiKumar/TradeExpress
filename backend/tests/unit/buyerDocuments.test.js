import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSnapshot, cleanRegistrationNumber, parseProfilePhoto, siteUrl, validateLegalStructure, verificationStatus,
} from '../../src/services/supplierDocumentService.js';
import { certificateSvg } from '../../src/services/documents/certificateTemplate.js';
import { idCardBackSvg, idCardFrontSvg } from '../../src/services/documents/idCardTemplate.js';
import { renderCertificatePdf, renderIdCardPdf } from '../../src/services/documents/documentPdf.js';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/AAAMBAQC0AaUcAAAAAElFTkSuQmCC';

const sampleBuyer = (status, extra = {}) => ({
  audience: 'buyer',
  supplierId: 'TE-BUY-000042',
  certificateNumber: 'TE-BCERT-000042',
  supplierName: 'Kavita Patel',
  ownerName: 'Kavita Patel',
  businessName: 'Patel Wholesale Enterprises',
  businessAddress: '45 Industrial Area, Ahmedabad, Gujarat',
  businessType: 'Private Limited',
  registrationNumber: 'CIN-U12345GJ2020PTC123456',
  gstin: '24AAACP1234A1Z5',
  status,
  issueDate: new Date('2026-02-10'),
  validUntil: status === 'VERIFIED' ? new Date('2027-02-10') : null,
  idCardValidUntil: status === 'VERIFIED' ? new Date('2028-02-10') : null,
  publicProfileUrl: 'https://www.tradeexpress.in/buyer/TE-BUY-000042',
  website: 'www.tradeexpress.in',
  supportEmail: 'support@tradeexpress.in',
  photo: PNG,
  signatory: { name: 'Mohit Sharma', title: 'Authorised Signatory', signatureDataUrl: '' },
  ...extra,
});

describe('Buyer verification status & snapshot logic', () => {
  it('correctly builds snapshot for a buyer account', () => {
    const buyerUser = {
      name: 'Kavita Patel',
      company: 'Patel Wholesale Enterprises',
      city: 'Ahmedabad',
      state: 'Gujarat',
      postalCode: '380001',
      country: 'India',
      businessAddress: '45 Industrial Area',
      legalStructure: 'Private Limited',
      registrationNumber: 'REG-9988',
      gstin: '24AAACP1234A1Z5',
      role: 'BUYER',
    };
    const snap = buildSnapshot(buyerUser);
    assert.equal(snap.audience, 'buyer');
    assert.equal(snap.supplierName, 'Kavita Patel');
    assert.equal(snap.businessName, 'Patel Wholesale Enterprises');
    assert.equal(snap.businessType, 'Private Limited');
    assert.equal(snap.registrationNumber, 'REG-9988');
  });

  it('verifies status for verified buyer vs pending', () => {
    // Only Admin review (kycStatus === 'VERIFIED') marks a buyer as VERIFIED; buyers are not directly verified
    assert.equal(verificationStatus({ role: 'BUYER', status: 'ACTIVE', kycStatus: 'VERIFIED' }), 'VERIFIED');
    assert.equal(verificationStatus({ role: 'BUYER', status: 'ACTIVE', isVerified: true, kycStatus: 'PENDING' }), 'PENDING');
    assert.equal(verificationStatus({ role: 'BUYER', status: 'ACTIVE', isVerified: true }), 'PENDING');
    assert.equal(verificationStatus({ role: 'BUYER', status: 'ACTIVE', isVerified: false, kycStatus: 'NOT_SUBMITTED' }), 'PENDING');
    assert.equal(verificationStatus({ role: 'BUYER', status: 'ACTIVE', kycStatus: 'REJECTED' }), 'REJECTED');
    assert.equal(verificationStatus({ role: 'BUYER', status: 'SUSPENDED' }), 'SUSPENDED');
  });
});

describe('Buyer Certificate and ID Card SVG & PDF templates', () => {
  it('renders Buyer Registration Certificate with buyer role wording', () => {
    const svg = certificateSvg(sampleBuyer('VERIFIED'));
    assert.match(svg, /BUYER REGISTRATION/);
    assert.match(svg, /Buyer ID/);
    assert.match(svg, /TE-BUY-000042/);
    assert.match(svg, /TE-BCERT-000042/);
    assert.match(svg, /is registered as a buyer on/);
    assert.match(svg, /source, request quotations and purchase products/);
    assert.match(svg, /Patel Wholesale Enterprises/i);
  });

  it('renders Buyer ID Card front with buyer badges and labels', () => {
    const front = idCardFrontSvg(sampleBuyer('VERIFIED'));
    assert.match(front, /BUYER ID CARD/);
    assert.match(front, /BUYER NAME/);
    assert.match(front, /BUYER ID/);
    assert.match(front, /TRUSTED/);
    assert.match(front, /B2B BUYER/);
    assert.match(front, /Kavita Patel/);
  });

  it('renders Buyer ID Card back with buyer verification details', () => {
    const back = idCardBackSvg(sampleBuyer('VERIFIED'));
    assert.match(back, /Buyer Verification/);
    assert.match(back, /Scan the QR code to verify this buyer’s registration details/);
    assert.match(back, /Buyers/);
  });

  it('renders PENDING watermark until admin verifies, and removes it once VERIFIED', () => {
    // When pending admin verification
    const pendingCert = certificateSvg(sampleBuyer('PENDING'));
    assert.match(pendingCert, /PENDING/);
    assert.match(pendingCert, /NOT VERIFIED • REVIEW PENDING/);

    const pendingFront = idCardFrontSvg(sampleBuyer('PENDING'));
    assert.match(pendingFront, /PENDING/);
    assert.match(pendingFront, /NOT VERIFIED • PENDING/);

    const pendingBack = idCardBackSvg(sampleBuyer('PENDING'));
    assert.match(pendingBack, /NOT VERIFIED • PENDING/);

    // Once admin verifies the buyer
    const verifiedCert = certificateSvg(sampleBuyer('VERIFIED'));
    assert.doesNotMatch(verifiedCert, /NOT VERIFIED • REVIEW PENDING/);

    const verifiedFront = idCardFrontSvg(sampleBuyer('VERIFIED'));
    assert.doesNotMatch(verifiedFront, /NOT VERIFIED • PENDING/);

    const verifiedBack = idCardBackSvg(sampleBuyer('VERIFIED'));
    assert.doesNotMatch(verifiedBack, /NOT VERIFIED • PENDING/);
  });

  it('renders valid PDF binary streams for buyer certificate and ID card', async () => {
    const certPdf = await renderCertificatePdf(sampleBuyer('VERIFIED'));
    assert.ok(Buffer.isBuffer(certPdf) && certPdf.length > 500);
    assert.equal(certPdf.subarray(0, 4).toString(), '%PDF');

    const idCardPdf = await renderIdCardPdf(sampleBuyer('VERIFIED'));
    assert.ok(Buffer.isBuffer(idCardPdf) && idCardPdf.length > 500);
    assert.equal(idCardPdf.subarray(0, 4).toString(), '%PDF');
  });
});

