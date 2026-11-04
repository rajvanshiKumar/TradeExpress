import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';
import { registerFonts } from './docAssets.js';
import { certificateSvg } from './certificateTemplate.js';
import { idCardBackSvg, idCardFrontSvg } from './idCardTemplate.js';

const MM_TO_PT = 72 / 25.4;
const A4_LANDSCAPE = [841.89, 595.28];
const CR80 = [54 * MM_TO_PT, 85.6 * MM_TO_PT];
const CARD_MARGIN = 8 * MM_TO_PT;
const CARD_GAP = 8 * MM_TO_PT;
const CARD_PAGE = [CR80[0] * 2 + CARD_GAP + CARD_MARGIN * 2, CR80[1] + CARD_MARGIN * 2];

const drawOptions = (width, height) => ({
  width,
  height,
  preserveAspectRatio: 'xMidYMid meet',
  assumePt: true,
  // Each weight is registered under its family name
  fontCallback: (family) => String(family || '').replace(/['"]/g, '').trim(),
});

function collect(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function newPdf(info) {
  // No margins: the artwork fills the page exactly
  const doc = new PDFDocument({ autoFirstPage: false, margin: 0, info: { Creator: 'TradeExpress', Producer: 'TradeExpress', ...info } });
  registerFonts(doc);
  return doc;
}

/** The Registration Certificate as one A4 landscape page. */
export async function renderCertificatePdf(data) {
  const doc = newPdf({ Title: `Seller Registration Certificate ${data.certificateNumber}`, Subject: data.businessName });
  const finished = collect(doc);
  doc.addPage({ size: A4_LANDSCAPE, margin: 0 });
  SVGtoPDF(doc, certificateSvg(data), 0, 0, drawOptions(A4_LANDSCAPE[0], A4_LANDSCAPE[1]));
  doc.end();
  return finished;
}

/** The ID card on one page: front and back side by side, each the exact size of a standard CR80 card. */
export async function renderIdCardPdf(data) {
  const doc = newPdf({ Title: `Supplier ID Card ${data.supplierId}`, Subject: data.businessName });
  const finished = collect(doc);
  doc.addPage({ size: CARD_PAGE, margin: 0 });
  // A light background, so the white card's rounded edges stay visible
  doc.rect(0, 0, CARD_PAGE[0], CARD_PAGE[1]).fill('#eef1ef');
  [idCardFrontSvg, idCardBackSvg].forEach((draw, index) => {
    SVGtoPDF(doc, draw(data), CARD_MARGIN + index * (CR80[0] + CARD_GAP), CARD_MARGIN, drawOptions(CR80[0], CR80[1]));
  });
  doc.end();
  return finished;
}
