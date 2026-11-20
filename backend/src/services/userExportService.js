import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import { getUsers } from './superAdminService.js';

/*
 * Super Admin: User Directory export in CSV, Excel (.xlsx) or PDF, with the same filters as the directory
 * (role, status, search). Every matching user is exported (read 100 at a time), up to MAX_EXPORT_ROWS.
 */

export const EXPORT_FORMATS = {
  csv: { contentType: 'text/csv; charset=utf-8', extension: 'csv' },
  xlsx: { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx' },
  pdf: { contentType: 'application/pdf', extension: 'pdf' },
};
export const MAX_EXPORT_ROWS = 5000;
const PAGE_SIZE = 100;

const COLUMNS = [
  { key: 'name', label: 'Name', pdfWidth: 95 },
  { key: 'email', label: 'Email', pdfWidth: 150 },
  { key: 'role', label: 'Role', pdfWidth: 55 },
  { key: 'status', label: 'Status', pdfWidth: 62 },
  { key: 'company', label: 'Company', pdfWidth: 105 },
  { key: 'phone', label: 'Phone', pdfWidth: 82 },
  { key: 'city', label: 'City', pdfWidth: 62 },
  { key: 'country', label: 'Country', pdfWidth: 50 },
  { key: 'kycStatus', label: 'KYC Status', pdfWidth: 62 },
  { key: 'verified', label: 'Verified', pdfWidth: 40 },
  { key: 'joinedAt', label: 'Joined', pdfWidth: 58 },
  { key: 'id', label: 'User ID', pdfWidth: 0 }, // CSV / Excel only (too long for a PDF page)
];

const STATUS_LABEL = { DEACTIVATED: 'DELETED' };

function toRow(u) {
  return {
    id: u.id,
    name: u.name || '',
    email: u.email || '',
    role: u.role || '',
    status: STATUS_LABEL[u.status] || u.status || 'ACTIVE',
    company: u.company || '',
    phone: u.phone || '',
    city: u.city || '',
    country: u.country || '',
    kycStatus: u.kycStatus || '',
    verified: u.isVerified ? 'Yes' : 'No',
    joinedAt: u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : '',
  };
}

/** Every user matching the directory filters, newest first. */
export async function collectExportRows({ role, status, search } = {}, { readPage = getUsers } = {}) {
  const rows = [];
  let total = 0;
  for (let page = 1; rows.length < MAX_EXPORT_ROWS; page += 1) {
    const result = await readPage({ page, limit: PAGE_SIZE, role, status, search });
    total = result.pagination?.total ?? 0;
    rows.push(...result.users.map(toRow));
    if (result.users.length < PAGE_SIZE || rows.length >= total) break;
  }
  return { rows: rows.slice(0, MAX_EXPORT_ROWS), total, truncated: total > MAX_EXPORT_ROWS };
}

// A phone number: digits with an optional leading +, spaces, dashes and brackets only (nothing that can run)
const PHONE_LIKE = /^\+?\d[\d ()-]{4,24}$/;

/**
 * One CSV cell, safe and readable in Excel:
 * - a phone number ("+91 98765 43210") is written as ="+91 98765 43210", so Excel shows it as text
 *   (otherwise Excel reads the leading + as a formula and shows an error, or drops the + and leading zeros);
 * - any other cell a spreadsheet would run as a formula (=, +, -, @, tab, CR) gets a leading apostrophe.
 */
export function safeCsvCell(value) {
  let text = String(value ?? '');
  if (PHONE_LIKE.test(text)) return `"=""${text}"""`;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(rows) {
  const header = COLUMNS.map((c) => safeCsvCell(c.label)).join(',');
  const lines = rows.map((row) => COLUMNS.map((c) => safeCsvCell(row[c.key])).join(','));
  // BOM so Excel reads names with non-English letters correctly
  return Buffer.from(`﻿${[header, ...lines].join('\r\n')}\r\n`, 'utf8');
}

function buildXlsx(rows) {
  const sheet = XLSX.utils.aoa_to_sheet([
    COLUMNS.map((c) => c.label),
    // Every value is a text cell, so nothing is ever evaluated as a formula
    ...rows.map((row) => COLUMNS.map((c) => String(row[c.key] ?? ''))),
  ]);
  sheet['!cols'] = COLUMNS.map((c) => ({ wch: Math.max(c.label.length, ...rows.slice(0, 500).map((r) => String(r[c.key] ?? '').length)) + 2 }));
  sheet['!autofilter'] = { ref: sheet['!ref'] };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Users');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
}

const filterSummary = ({ role, status, search }) => [
  `Role: ${role && role !== 'ALL' ? role : 'All'}`,
  `Status: ${status && status !== 'ALL' ? (STATUS_LABEL[status] || status) : 'All'}`,
  search ? `Search: "${String(search).slice(0, 60)}"` : null,
].filter(Boolean).join('   ·   ');

function buildPdf(rows, { filters, total, truncated, generatedAt }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28, bufferPages: true, info: { Title: 'TradeExpress User Directory', Creator: 'TradeExpress', Producer: 'TradeExpress' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const cols = COLUMNS.filter((c) => c.pdfWidth);
    const left = doc.page.margins.left;
    const tableWidth = cols.reduce((sum, c) => sum + c.pdfWidth, 0);
    const bottom = () => doc.page.height - doc.page.margins.bottom - 18;
    const EMERALD = '#065f46';

    const drawHeader = () => {
      doc.fillColor(EMERALD).font('Helvetica-Bold').fontSize(15).text('TradeExpress · User Directory', left, 28);
      doc.fillColor('#475569').font('Helvetica').fontSize(8.5)
        .text(`${filterSummary(filters)}   ·   ${rows.length} of ${total} users${truncated ? ` (first ${MAX_EXPORT_ROWS})` : ''}   ·   Generated ${generatedAt.toISOString().replace('T', ' ').slice(0, 16)} UTC`, left, 48);
      let x = left;
      const y = 66;
      doc.rect(left, y, tableWidth, 18).fill(EMERALD);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
      cols.forEach((c) => { doc.text(c.label, x + 4, y + 5, { width: c.pdfWidth - 8, lineBreak: false, ellipsis: true }); x += c.pdfWidth; });
      return y + 18;
    };

    let y = drawHeader();
    doc.font('Helvetica').fontSize(7.8);
    rows.forEach((row, i) => {
      if (y + 16 > bottom()) {
        doc.addPage();
        y = drawHeader();
        doc.font('Helvetica').fontSize(7.8);
      }
      if (i % 2) doc.rect(left, y, tableWidth, 16).fill('#f1f5f9');
      let x = left;
      doc.fillColor('#0f172a');
      cols.forEach((c) => { doc.text(String(row[c.key] ?? ''), x + 4, y + 4.5, { width: c.pdfWidth - 8, lineBreak: false, ellipsis: true }); x += c.pdfWidth; });
      y += 16;
    });
    if (!rows.length) doc.fillColor('#64748b').fontSize(10).text('No users match these filters.', left, y + 12);

    const range = doc.bufferedPageRange();
    for (let p = range.start; p < range.start + range.count; p += 1) {
      doc.switchToPage(p);
      doc.fillColor('#94a3b8').font('Helvetica').fontSize(7.5)
        .text(`Confidential: TradeExpress Super Admin export   ·   Page ${p + 1} of ${range.count}`, left, doc.page.height - 22, { width: tableWidth, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}

/** Builds the export file. Returns { buffer, contentType, filename, count, total, truncated }. */
export async function buildUserExport({ format, role, status, search } = {}, deps = {}) {
  const spec = EXPORT_FORMATS[String(format || '').toLowerCase()];
  if (!spec) {
    const error = new Error('Choose an export format: CSV, Excel or PDF.');
    error.statusCode = 400;
    error.errorCode = 'INVALID_EXPORT_FORMAT';
    throw error;
  }
  const filters = { role, status, search };
  const { rows, total, truncated } = await collectExportRows(filters, deps);
  const generatedAt = new Date();
  let buffer;
  if (spec.extension === 'csv') buffer = buildCsv(rows);
  else if (spec.extension === 'xlsx') buffer = buildXlsx(rows);
  else buffer = await buildPdf(rows, { filters, total, truncated, generatedAt });
  const stamp = generatedAt.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return { buffer, contentType: spec.contentType, filename: `tradeexpress-users-${stamp}.${spec.extension}`, count: rows.length, total, truncated };
}
