import * as documents from '../services/supplierDocumentService.js';

const wrap = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    next(error);
  }
};
const ok = (res, data, message) => res.json({ success: true, ...(message ? { message } : {}), data });

const sendPdf = (res, { pdf, fileName }) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(pdf);
};
const sendSvg = (res, svg) => {
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  // Documents are only ever shown as images: nothing inside can run even if opened directly
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; sandbox");
  res.send(svg);
};
const sendPhoto = (res, { bytes, mime }, cache) => {
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', cache);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(bytes);
};

/* ---------- supplier: always their own record, taken from the signed-in account ---------- */
export const getMine = wrap(async (req, res) => ok(res, await documents.getOwnDocuments(req.user.id)));
export const previewMine = wrap(async (req, res) => sendSvg(res, await documents.renderPreview(req.user.id, req.params.kind)));
export const certificateMine = wrap(async (req, res) => sendPdf(res, await documents.renderCertificate(req.user.id)));
export const idCardMine = wrap(async (req, res) => sendPdf(res, await documents.renderIdCard(req.user.id)));
export const photoMine = wrap(async (req, res) => sendPhoto(res, await documents.getOwnPhoto(req.user.id), 'private, no-store'));
export const updatePhotoMine = wrap(async (req, res) => ok(res, await documents.updateOwnPhoto(req.user.id, req.body.photo), 'Profile photograph saved.'));
export const updateDetailsMine = wrap(async (req, res) => ok(res, await documents.updateOwnDetails(req.user.id, req.body), 'Business details saved.'));
export const updatePrivacyMine = wrap(async (req, res) => ok(res, await documents.updateOwnPrivacy(req.user.id, req.body), 'Public profile settings saved.'));

/* ---------- Super Admin ---------- */
export const adminList = wrap(async (req, res) => ok(res, await documents.listForAdmin(req.query)));
export const adminGet = wrap(async (req, res) => ok(res, await documents.getForAdmin(req.params.id)));
export const adminPreview = wrap(async (req, res) => sendSvg(res, await documents.renderPreview(req.params.id, req.params.kind)));
export const adminCertificate = wrap(async (req, res) => sendPdf(res, await documents.renderCertificate(req.params.id)));
export const adminIdCard = wrap(async (req, res) => sendPdf(res, await documents.renderIdCard(req.params.id)));
export const adminPhoto = wrap(async (req, res) => sendPhoto(res, await documents.getOwnPhoto(req.params.id), 'private, no-store'));
export const adminReplacePhoto = wrap(async (req, res) => ok(res, await documents.replacePhotoForAdmin(req.params.id, req.body.photo, req), 'Photograph replaced.'));
export const adminRegenerate = wrap(async (req, res) => ok(res, await documents.regenerateForAdmin(req.params.id, req), 'Documents regenerated with the current details.'));
export const adminValidity = wrap(async (req, res) => ok(res, await documents.updateValidityForAdmin(req.params.id, req.body, req), 'Validity updated.'));
export const adminGetSignatory = wrap(async (req, res) => ok(res, await documents.getSignatory()));
export const adminUpdateSignatory = wrap(async (req, res) => ok(res, await documents.updateSignatory({ ...req.body, req }), 'Signatory saved.'));

/* ---------- public ---------- */
export const publicProfile = wrap(async (req, res) => ok(res, await documents.getPublicProfile(req.params.code)));
export const publicPhoto = wrap(async (req, res) => sendPhoto(res, await documents.getPublicPhoto(req.params.code), 'public, max-age=3600'));
