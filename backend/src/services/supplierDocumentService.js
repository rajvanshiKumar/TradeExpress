import prisma from '../config/db.js';
import { logAuditAction } from './auditService.js';
import { qrPngDataUrl } from './documents/docAssets.js';
import { certificateSvg } from './documents/certificateTemplate.js';
import { idCardBackSvg, idCardFrontSvg } from './documents/idCardTemplate.js';
import { renderCertificatePdf, renderIdCardPdf } from './documents/documentPdf.js';

/**
 * Registration certificates and supplier ID cards.
 *
 * Each supplier has one SupplierDocument row holding their permanent Supplier ID, Certificate Number and QR code.
 * Verification status is never stored here: it is always read live from the Super Admin's review and the account status,
 * so no document can say VERIFIED before approval or after a suspension.
 *
 * Once approved, the printed details are frozen in `snapshot`, so editing a company profile cannot change what a verified
 * certificate says. A Super Admin regenerates the documents to accept changes.
 */

const CERTIFICATE_VALID_YEARS = 1;
const ID_CARD_VALID_YEARS = 2;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const MAX_SIGNATURE_BYTES = 512 * 1024;
const SIGNATORY_KEY = 'document_signatory';
const DEFAULT_SIGNATORY = { name: '', title: 'Authorised Signatory', signatureDataUrl: '' };

export const LEGAL_STRUCTURES = [
  'Proprietorship',
  'Partnership',
  'Limited Liability Partnership (LLP)',
  'Private Limited',
  'Public Limited',
  'One Person Company (OPC)',
  'Other',
];

const SUPPLIER_SELECT = {
  id: true, email: true, name: true, role: true, status: true, statusReason: true, isActive: true, company: true, phone: true,
  businessPhone: true, city: true, state: true, postalCode: true, country: true, businessAddress: true, businessType: true,
  businessTypeOther: true, legalStructure: true, registrationNumber: true, taxId: true, gstin: true, logoUrl: true,
  companyDescription: true, yearEstablished: true, kycStatus: true, kycRejectionReason: true, supplierCode: true, createdAt: true,
};

// Everything except the photo itself, which is only read when it is needed
const DOCUMENT_SELECT = {
  id: true, userId: true, sequence: true, supplierId: true, certificateNumber: true, legacySupplierCode: true, publicProfileUrl: true,
  qrCodeDataUrl: true, photoMime: true, snapshot: true, issueDate: true, validUntil: true, idCardValidUntil: true, verifiedAt: true,
  revision: true, generatedAt: true, showBusinessAddress: true, showBusinessPhone: true, showBusinessEmail: true, createdAt: true, updatedAt: true,
};

function fail(message, statusCode = 400, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
}

const addYears = (date, years) => {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
};

export function siteUrl() {
  return String(process.env.PUBLIC_SITE_URL || 'https://www.tradeexpress.in').trim().replace(/\/+$/, '');
}
const websiteLabel = () => siteUrl().replace(/^https?:\/\//, '');
const supportEmail = () => String(process.env.SUPPORT_EMAIL || 'support@tradeexpress.in').trim();

/** PENDING, VERIFIED, REJECTED or SUSPENDED. Only the Super Admin's review can make a supplier VERIFIED. */
export function verificationStatus(user) {
  if (user.status === 'SUSPENDED' || user.isActive === false) return 'SUSPENDED';
  if (user.kycStatus === 'VERIFIED') return 'VERIFIED';
  if (user.kycStatus === 'REJECTED') return 'REJECTED';
  return 'PENDING';
}

/** What a document shows. A verified supplier whose validity has passed shows EXPIRED on the document only. */
function documentStatus(user, doc) {
  const status = verificationStatus(user);
  if (status === 'VERIFIED' && doc.validUntil && new Date(doc.validUntil) < new Date()) return 'EXPIRED';
  return status;
}

/** Validates a supplier photograph sent as a data URL. Returns its bytes and type. The browser sends a cropped JPEG. */
export function parseProfilePhoto(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!match) throw fail('Please upload a clear profile photograph in JPG, PNG or WebP format.', 400, 'PHOTO_INVALID');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) throw fail('The profile photograph must be smaller than 2 MB.', 400, 'PHOTO_TOO_LARGE');
  // The file's own bytes decide its type, not the label sent with it
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!(isJpeg && match[1] === 'image/jpeg') && !(isPng && match[1] === 'image/png')) {
    throw fail('That file is not a valid image. Please upload a JPG, PNG or WebP photograph.', 400, 'PHOTO_INVALID');
  }
  // The PDF library cannot embed interlaced PNG files
  if (isPng && bytes[28] !== 0) throw fail('That PNG format is not supported. Please upload a JPG or a standard PNG.', 400, 'PHOTO_INVALID');
  return { bytes, mime: match[1] };
}

export function validateLegalStructure(value) {
  const clean = String(value || '').trim();
  if (!LEGAL_STRUCTURES.includes(clean)) throw fail('Please select your business type.', 400, 'BUSINESS_TYPE_REQUIRED');
  return clean;
}

export function cleanRegistrationNumber(value) {
  const clean = String(value || '').trim().toUpperCase();
  if (!clean) return null;
  if (clean.length > 64 || !/^[A-Z0-9][A-Z0-9 ./-]*$/.test(clean)) {
    throw fail('Enter a valid business registration number, using letters, numbers, spaces, dots, slashes or hyphens.', 400, 'REGISTRATION_NUMBER_INVALID');
  }
  return clean;
}

/** The details printed on a document, from the supplier's current record. */
export function buildSnapshot(user) {
  const location = [user.city, user.state].filter(Boolean).join(', ');
  const address = String(user.businessAddress || '').trim()
    || [location, user.postalCode, user.country].filter(Boolean).join(' - ');
  const certificateType = user.businessType === 'Other' ? user.businessTypeOther : user.businessType;
  // Older signups recorded a certificate type here, whose number is in taxId
  const isGstType = /gst/i.test(String(user.businessType || ''));
  return {
    supplierName: String(user.name || '').trim(),
    businessName: String(user.company || '').trim(),
    businessAddress: address,
    businessType: user.legalStructure || certificateType || '',
    registrationNumber: user.registrationNumber || (!isGstType && user.taxId ? user.taxId : ''),
    gstin: user.gstin || '',
  };
}

const sameDetails = (a, b) => ['supplierName', 'businessName', 'businessAddress', 'businessType', 'registrationNumber', 'gstin']
  .every((key) => String(a?.[key] || '') === String(b?.[key] || ''));

/** Approved details stay frozen; until approval the documents follow the supplier's current details. */
const printedDetails = (user, doc) => (verificationStatus(user) !== 'PENDING' && verificationStatus(user) !== 'REJECTED' && doc.snapshot ? doc.snapshot : buildSnapshot(user));

const missingDetails = (details) => [
  !details.supplierName && 'supplier name',
  !details.businessName && 'business name',
  !details.businessAddress && 'business address',
].filter(Boolean);

async function loadSupplier(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: SUPPLIER_SELECT });
  if (!user || user.role !== 'SUPPLIER') throw fail('Supplier not found.', 404, 'SUPPLIER_NOT_FOUND');
  return user;
}

/**
 * Gives a supplier their permanent Supplier ID, Certificate Number and QR code, once. Safe to call repeatedly.
 * The number comes from the database's own counter, so two signups can never receive the same one.
 */
export async function ensureSupplierDocument(userId, { photo } = {}) {
  const existing = await prisma.supplierDocument.findUnique({ where: { userId }, select: DOCUMENT_SELECT });
  if (existing?.supplierId) return existing;

  const user = await loadSupplier(userId);
  const now = new Date();
  const alreadyVerified = verificationStatus(user) === 'VERIFIED' || user.kycStatus === 'VERIFIED';

  try {
    return await prisma.$transaction(async (tx) => {
      const row = existing || await tx.supplierDocument.create({
        data: {
          userId,
          legacySupplierCode: user.supplierCode || null,
          issueDate: now,
          ...(photo ? { photoData: photo.bytes, photoMime: photo.mime } : {}),
          // Suppliers approved before this feature keep their verified status
          ...(alreadyVerified ? {
            verifiedAt: now,
            snapshot: buildSnapshot(user),
            validUntil: addYears(now, CERTIFICATE_VALID_YEARS),
            idCardValidUntil: addYears(now, ID_CARD_VALID_YEARS),
          } : {}),
        },
        select: { id: true, sequence: true },
      });
      const number = String(row.sequence).padStart(6, '0');
      const supplierId = `TE-SEL-${number}`;
      const publicProfileUrl = `${siteUrl()}/supplier/${supplierId}`;
      const qrCodeDataUrl = await qrPngDataUrl(publicProfileUrl);
      const saved = await tx.supplierDocument.update({
        where: { id: row.id },
        data: { supplierId, certificateNumber: `TE-CERT-${number}`, publicProfileUrl, qrCodeDataUrl },
        select: DOCUMENT_SELECT,
      });
      // One ID everywhere on the platform; the old code stays on the document and still opens the profile
      await tx.user.update({ where: { id: userId }, data: { supplierCode: supplierId } });
      return saved;
    }, { maxWait: 15000, timeout: 30000 });
  } catch (error) {
    // Two requests raced: the other one already created the record
    if (error.code === 'P2002') {
      const raced = await prisma.supplierDocument.findUnique({ where: { userId }, select: DOCUMENT_SELECT });
      if (raced?.supplierId) return raced;
    }
    throw error;
  }
}

/**
 * Called after a Super Admin's review. Approval issues the documents: the dates start and the details are frozen.
 * Any other decision clears that, so a later approval issues them afresh.
 */
export async function syncAfterVerification(userId) {
  const doc = await ensureSupplierDocument(userId);
  const user = await loadSupplier(userId);
  if (user.kycStatus === 'VERIFIED') {
    if (doc.verifiedAt) return;
    const now = new Date();
    await prisma.supplierDocument.update({
      where: { userId },
      data: {
        verifiedAt: now,
        issueDate: now,
        validUntil: addYears(now, CERTIFICATE_VALID_YEARS),
        idCardValidUntil: addYears(now, ID_CARD_VALID_YEARS),
        snapshot: buildSnapshot(user),
        generatedAt: now,
        revision: { increment: 1 },
      },
    });
  } else if (doc.verifiedAt) {
    await prisma.supplierDocument.update({ where: { userId }, data: { verifiedAt: null, validUntil: null, idCardValidUntil: null } });
  }
}

export async function getSignatory() {
  const row = await prisma.platformSetting.findUnique({ where: { key: SIGNATORY_KEY } });
  return { ...DEFAULT_SIGNATORY, ...(row?.value && typeof row.value === 'object' ? row.value : {}) };
}

export async function updateSignatory({ name, title, signatureDataUrl, removeSignature, req }) {
  const current = await getSignatory();
  const next = {
    name: String(name ?? current.name).trim().slice(0, 80),
    title: String(title ?? current.title).trim().slice(0, 80) || DEFAULT_SIGNATORY.title,
    signatureDataUrl: removeSignature ? '' : current.signatureDataUrl,
  };
  if (signatureDataUrl) {
    const { bytes } = parseProfilePhoto(signatureDataUrl);
    if (bytes.length > MAX_SIGNATURE_BYTES) throw fail('The signature image must be smaller than 512 KB.');
    next.signatureDataUrl = signatureDataUrl;
  }
  await prisma.platformSetting.upsert({
    where: { key: SIGNATORY_KEY },
    update: { value: next, updatedBy: req?.user?.email || null },
    create: { key: SIGNATORY_KEY, value: next, category: 'documents', description: 'Signatory printed on supplier certificates and ID cards', updatedBy: req?.user?.email || null },
  });
  await logAuditAction({ req, action: 'DOCUMENT_SIGNATORY_UPDATED', resource: 'SUPPLIERS', details: { name: next.name, title: next.title, hasSignature: Boolean(next.signatureDataUrl) } });
  return next;
}

async function templateData(user, doc, { withPhoto = false } = {}) {
  const details = printedDetails(user, doc);
  let photo = '';
  if (withPhoto && doc.photoMime) {
    const row = await prisma.supplierDocument.findUnique({ where: { userId: user.id }, select: { photoData: true, photoMime: true } });
    if (row?.photoData) photo = `data:${row.photoMime};base64,${Buffer.from(row.photoData).toString('base64')}`;
  }
  return {
    supplierId: doc.supplierId,
    certificateNumber: doc.certificateNumber,
    supplierName: details.supplierName,
    ownerName: details.supplierName,
    businessName: details.businessName,
    businessAddress: details.businessAddress,
    businessType: details.businessType,
    registrationNumber: details.registrationNumber,
    gstin: details.gstin,
    status: documentStatus(user, doc),
    issueDate: doc.issueDate,
    // Dates of validity only exist once a Super Admin has approved the supplier
    validUntil: doc.verifiedAt ? doc.validUntil : null,
    idCardValidUntil: doc.verifiedAt ? doc.idCardValidUntil : null,
    publicProfileUrl: doc.publicProfileUrl,
    website: websiteLabel(),
    supportEmail: supportEmail(),
    signatory: await getSignatory(),
    photo,
  };
}

function assertPrintable(data, { needsPhoto = false } = {}) {
  const missing = missingDetails(data);
  if (missing.length) throw fail(`These details are needed before documents can be generated: ${missing.join(', ')}.`, 422, 'DETAILS_MISSING');
  if (needsPhoto && !data.photo) throw fail('A profile photograph is required for the Supplier ID Card. Please upload one.', 422, 'PHOTO_REQUIRED');
}

/** A document as a preview image (SVG with its fonts embedded). kind: certificate, id-card-front or id-card-back. */
export async function renderPreview(userId, kind) {
  const doc = await ensureSupplierDocument(userId);
  const user = await loadSupplier(userId);
  const data = await templateData(user, doc, { withPhoto: kind === 'id-card-front' });
  assertPrintable(data);
  if (kind === 'certificate') return certificateSvg(data, { preview: true });
  if (kind === 'id-card-front') return idCardFrontSvg(data, { preview: true });
  if (kind === 'id-card-back') return idCardBackSvg(data, { preview: true });
  throw fail('Unknown document.', 404);
}

export async function renderCertificate(userId) {
  const doc = await ensureSupplierDocument(userId);
  const user = await loadSupplier(userId);
  const data = await templateData(user, doc);
  assertPrintable(data);
  return { pdf: await renderCertificatePdf(data), fileName: `TradeExpress-Certificate-${doc.certificateNumber}.pdf` };
}

export async function renderIdCard(userId) {
  const doc = await ensureSupplierDocument(userId);
  const user = await loadSupplier(userId);
  const data = await templateData(user, doc, { withPhoto: true });
  assertPrintable(data, { needsPhoto: true });
  return { pdf: await renderIdCardPdf(data), fileName: `TradeExpress-ID-Card-${doc.supplierId}.pdf` };
}

function summary(user, doc) {
  const details = printedDetails(user, doc);
  const missing = missingDetails(details);
  return {
    userId: user.id,
    supplierId: doc.supplierId,
    certificateNumber: doc.certificateNumber,
    legacySupplierCode: doc.legacySupplierCode,
    publicProfileUrl: doc.publicProfileUrl,
    qrCodeDataUrl: doc.qrCodeDataUrl,
    hasPhoto: Boolean(doc.photoMime),
    verificationStatus: verificationStatus(user),
    documentStatus: documentStatus(user, doc),
    rejectionReason: user.kycRejectionReason || null,
    suspensionReason: user.status === 'SUSPENDED' ? user.statusReason || null : null,
    issueDate: doc.issueDate,
    validUntil: doc.verifiedAt ? doc.validUntil : null,
    idCardValidUntil: doc.verifiedAt ? doc.idCardValidUntil : null,
    verifiedAt: doc.verifiedAt,
    revision: doc.revision,
    generatedAt: doc.generatedAt,
    details,
    missingDetails: missing,
    canEditDetails: !doc.verifiedAt,
    // A verified supplier's profile has changed since the documents were approved
    detailsChanged: Boolean(doc.verifiedAt && doc.snapshot && !sameDetails(doc.snapshot, buildSnapshot(user))),
    privacy: { showBusinessAddress: doc.showBusinessAddress, showBusinessPhone: doc.showBusinessPhone, showBusinessEmail: doc.showBusinessEmail },
  };
}

/* ---------- supplier ---------- */

export async function getOwnDocuments(userId) {
  const doc = await ensureSupplierDocument(userId);
  const user = await loadSupplier(userId);
  return {
    ...summary(user, doc),
    legalStructure: user.legalStructure || '',
    registrationNumber: user.registrationNumber || '',
    legalStructures: LEGAL_STRUCTURES,
  };
}

export async function getOwnPhoto(userId) {
  const row = await prisma.supplierDocument.findUnique({ where: { userId }, select: { photoData: true, photoMime: true } });
  if (!row?.photoData) throw fail('No photograph has been uploaded.', 404, 'PHOTO_NOT_FOUND');
  return { bytes: Buffer.from(row.photoData), mime: row.photoMime };
}

/** A verified ID card keeps its photograph unless a Super Admin replaces it; suppliers without one can always add one. */
export async function updateOwnPhoto(userId, dataUrl) {
  const photo = parseProfilePhoto(dataUrl);
  const doc = await ensureSupplierDocument(userId);
  if (doc.verifiedAt && doc.photoMime) {
    throw fail('Your verified ID card already has a photograph. Please contact TradeExpress support to change it.', 409, 'PHOTO_LOCKED');
  }
  await prisma.supplierDocument.update({ where: { userId }, data: { photoData: photo.bytes, photoMime: photo.mime } });
  return getOwnDocuments(userId);
}

/** Business type and registration number for suppliers who registered before these were asked. Locked once verified. */
export async function updateOwnDetails(userId, { legalStructure, registrationNumber }) {
  const doc = await ensureSupplierDocument(userId);
  if (doc.verifiedAt) throw fail('Verified documents cannot be changed here. Please contact TradeExpress support.', 409, 'DETAILS_LOCKED');
  await prisma.user.update({
    where: { id: userId },
    data: { legalStructure: validateLegalStructure(legalStructure), registrationNumber: cleanRegistrationNumber(registrationNumber) },
  });
  return getOwnDocuments(userId);
}

export async function updateOwnPrivacy(userId, { showBusinessAddress, showBusinessPhone, showBusinessEmail }) {
  await ensureSupplierDocument(userId);
  await prisma.supplierDocument.update({
    where: { userId },
    data: { showBusinessAddress: Boolean(showBusinessAddress), showBusinessPhone: Boolean(showBusinessPhone), showBusinessEmail: Boolean(showBusinessEmail) },
  });
  return getOwnDocuments(userId);
}

/* ---------- Super Admin ---------- */

export async function listForAdmin({ page = 1, limit = 12, status = 'ALL', search = '' } = {}) {
  const take = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
  const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * take;
  const where = { role: 'SUPPLIER', NOT: { status: 'DEACTIVATED' } };
  const term = String(search || '').trim();
  if (term) {
    where.OR = [
      { company: { contains: term } }, { name: { contains: term } }, { email: { contains: term } }, { supplierCode: { contains: term } },
      { supplierDocument: { certificateNumber: { contains: term } } },
    ];
  }
  if (status === 'SUSPENDED') where.status = 'SUSPENDED';
  if (status === 'VERIFIED') Object.assign(where, { kycStatus: 'VERIFIED', status: 'ACTIVE' });
  if (status === 'REJECTED') Object.assign(where, { kycStatus: 'REJECTED', status: 'ACTIVE' });
  if (status === 'PENDING') Object.assign(where, { kycStatus: { notIn: ['VERIFIED', 'REJECTED'] }, status: 'ACTIVE' });

  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, select: SUPPLIER_SELECT, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.user.count({ where }),
  ]);
  const suppliers = [];
  for (const user of users) {
    // Suppliers from before this feature receive their record the first time they are listed
    // eslint-disable-next-line no-await-in-loop
    const doc = await ensureSupplierDocument(user.id);
    suppliers.push({ ...summary(user, doc), name: user.name, company: user.company, email: user.email, status: user.status, kycStatus: user.kycStatus });
  }
  return { suppliers, pagination: { page: Math.floor(skip / take) + 1, limit: take, total, totalPages: Math.max(1, Math.ceil(total / take)) } };
}

export async function getForAdmin(userId) {
  const doc = await ensureSupplierDocument(userId);
  const user = await loadSupplier(userId);
  const kycDocuments = await prisma.kycDocument.findMany({
    where: { userId },
    select: { id: true, docType: true, docNumber: true, fileName: true, fileUrl: true, status: true, notes: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return {
    ...summary(user, doc),
    account: {
      name: user.name, company: user.company, email: user.email, phone: user.phone, status: user.status, kycStatus: user.kycStatus,
      city: user.city, state: user.state, country: user.country, postalCode: user.postalCode, businessAddress: user.businessAddress,
      createdAt: user.createdAt,
    },
    currentDetails: buildSnapshot(user),
    kycDocuments,
  };
}

/** Accepts the supplier's current details onto the documents. The Supplier ID, certificate number and QR code never change. */
export async function regenerateForAdmin(userId, req) {
  const doc = await ensureSupplierDocument(userId);
  const user = await loadSupplier(userId);
  const details = buildSnapshot(user);
  const missing = missingDetails(details);
  if (missing.length) throw fail(`These details are needed before documents can be generated: ${missing.join(', ')}.`, 422, 'DETAILS_MISSING');
  await prisma.supplierDocument.update({
    where: { userId },
    data: { snapshot: details, generatedAt: new Date(), revision: { increment: 1 } },
  });
  await logAuditAction({ req, action: 'SUPPLIER_DOCUMENTS_REGENERATED', resource: 'SUPPLIERS', targetId: userId, details: { supplierId: doc.supplierId, revision: doc.revision + 1 } });
  return getForAdmin(userId);
}

export async function updateValidityForAdmin(userId, { validUntil, idCardValidUntil }, req) {
  const doc = await ensureSupplierDocument(userId);
  if (!doc.verifiedAt) throw fail('Validity can only be set after the supplier has been verified.', 409, 'NOT_VERIFIED');
  const parse = (value, label) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw fail(`Enter a valid ${label} date.`);
    if (date <= new Date(doc.issueDate)) throw fail(`The ${label} date must be after the issue date.`);
    return date;
  };
  const data = {};
  if (validUntil) data.validUntil = parse(validUntil, 'certificate validity');
  if (idCardValidUntil) data.idCardValidUntil = parse(idCardValidUntil, 'ID card validity');
  if (!Object.keys(data).length) throw fail('Enter at least one date.');
  await prisma.supplierDocument.update({ where: { userId }, data });
  await logAuditAction({ req, action: 'SUPPLIER_DOCUMENT_VALIDITY_UPDATED', resource: 'SUPPLIERS', targetId: userId, details: { supplierId: doc.supplierId, ...data } });
  return getForAdmin(userId);
}

export async function replacePhotoForAdmin(userId, dataUrl, req) {
  const photo = parseProfilePhoto(dataUrl);
  const doc = await ensureSupplierDocument(userId);
  await prisma.supplierDocument.update({ where: { userId }, data: { photoData: photo.bytes, photoMime: photo.mime } });
  await logAuditAction({ req, action: 'SUPPLIER_DOCUMENT_PHOTO_REPLACED', resource: 'SUPPLIERS', targetId: userId, details: { supplierId: doc.supplierId } });
  return getForAdmin(userId);
}

/* ---------- public profile, opened by scanning the QR code ---------- */

const STATUS_MESSAGES = {
  VERIFIED: 'This supplier’s documents have been reviewed and approved by TradeExpress.',
  PENDING: 'This supplier has registered on TradeExpress. Verification by TradeExpress is pending.',
  REJECTED: 'TradeExpress did not approve this supplier’s verification.',
  SUSPENDED: 'This supplier’s account is currently suspended on TradeExpress.',
};

async function findByPublicCode(code) {
  const clean = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,32}$/.test(clean)) return null;
  const doc = await prisma.supplierDocument.findFirst({
    where: { OR: [{ supplierId: clean }, { legacySupplierCode: clean }] },
    select: DOCUMENT_SELECT,
  });
  if (doc) return doc;
  // A supplier from before this feature, whose record has not been created yet
  const user = await prisma.user.findFirst({ where: { supplierCode: clean, role: 'SUPPLIER' }, select: { id: true } });
  return user ? ensureSupplierDocument(user.id) : null;
}

const notFound = () => fail('No TradeExpress supplier matches this code.', 404, 'SUPPLIER_NOT_FOUND');

/** Only permitted business information. Everything optional is off until the supplier turns it on. */
export async function getPublicProfile(code) {
  const doc = await findByPublicCode(code);
  if (!doc) throw notFound();
  const user = await prisma.user.findUnique({ where: { id: doc.userId }, select: SUPPLIER_SELECT });
  if (!user || user.role !== 'SUPPLIER' || user.status === 'DEACTIVATED') throw notFound();

  const status = verificationStatus(user);
  const visible = status === 'VERIFIED' || status === 'PENDING';
  const details = printedDetails(user, doc);
  const profile = {
    supplierId: doc.supplierId,
    businessName: details.businessName || user.company || 'TradeExpress supplier',
    verificationStatus: status,
    statusMessage: STATUS_MESSAGES[status],
    canContact: visible,
    products: [],
    productCount: 0,
    categories: [],
  };
  if (!visible) return profile;

  const products = await prisma.product.findMany({
    where: { supplierId: user.id, status: 'Active' },
    select: { id: true, name: true, slug: true, photo: true, price: true, unit: true, moq: true, supplierId: true, category: { select: { slug: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 120,
  });
  const categories = new Map();
  products.forEach((product) => { if (product.category) categories.set(product.category.slug, product.category.name); });

  return {
    ...profile,
    contactId: user.id,
    photoUrl: doc.photoMime ? `/public/suppliers/${doc.supplierId}/photo` : null,
    logoUrl: user.logoUrl || null,
    businessType: details.businessType || null,
    description: user.companyDescription || null,
    yearEstablished: user.yearEstablished || null,
    location: [user.city, user.state, user.country].filter(Boolean).join(', ') || null,
    memberSince: user.createdAt,
    businessAddress: doc.showBusinessAddress ? details.businessAddress || null : null,
    businessPhone: doc.showBusinessPhone ? user.businessPhone || null : null,
    businessEmail: doc.showBusinessEmail ? user.email : null,
    products: products.map(({ category, price, ...product }) => ({ ...product, price: Number(price), categorySlug: category?.slug || null, categoryName: category?.name || null })),
    productCount: products.length,
    categories: [...categories].map(([slug, name]) => ({ slug, name })),
  };
}

export async function getPublicPhoto(code) {
  const doc = await findByPublicCode(code);
  if (!doc?.photoMime) throw notFound();
  const user = await prisma.user.findUnique({ where: { id: doc.userId }, select: { role: true, status: true, isActive: true, kycStatus: true } });
  if (!user || user.role !== 'SUPPLIER' || user.status === 'DEACTIVATED') throw notFound();
  if (!['VERIFIED', 'PENDING'].includes(verificationStatus(user))) throw notFound();
  return getOwnPhoto(doc.userId);
}
