import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { buildUserExport, collectExportRows, safeCsvCell } from '../../src/services/userExportService.js';

// 230 fake users, served 100 per page like the real directory query
const users = Array.from({ length: 230 }, (_, i) => ({
  id: `u${i}`, name: i === 0 ? '=HYPERLINK("http://evil.test")' : `User ${i}`, email: `user${i}@example.test`, role: 'BUYER',
  status: i === 1 ? 'DEACTIVATED' : 'ACTIVE', company: 'Acme', phone: '+91 9876543210', city: 'Surat', country: 'India',
  kycStatus: 'APPROVED', isVerified: true, createdAt: new Date('2026-11-01T10:00:00Z'),
}));
const calls = [];
const readPage = async ({ page, limit, ...filters }) => {
  calls.push({ page, ...filters });
  return { users: users.slice((page - 1) * limit, page * limit), pagination: { total: users.length } };
};

test('User Directory export', async (t) => {
  await t.test('exports every matching user (all pages), with the directory filters', async () => {
    calls.length = 0;
    const { rows, total } = await collectExportRows({ role: 'BUYER', status: 'ACTIVE', search: 'acme' }, { readPage });
    assert.equal(rows.length, 230);
    assert.equal(total, 230);
    assert.equal(calls.length, 3);
    assert.deepEqual(calls[0], { page: 1, role: 'BUYER', status: 'ACTIVE', search: 'acme' });
  });

  await t.test('CSV: formula-like cells are written as text', async () => {
    assert.equal(safeCsvCell('=1+1'), '"\'=1+1"');
    assert.equal(safeCsvCell('-5'), '"\'-5"');
    assert.equal(safeCsvCell('Ravi "R" Kumar'), '"Ravi ""R"" Kumar"');
    // Phone numbers open in Excel as text (no error, no lost +), and only digits can take this path
    assert.equal(safeCsvCell('+91 9876543210'), '"=""+91 9876543210"""');
    assert.equal(safeCsvCell('+1 (555) 010-9999'), '"=""+1 (555) 010-9999"""');
    assert.equal(safeCsvCell('+91 98765"&cmd'), '"\'+91 98765""&cmd"', 'anything that is not a pure phone number is neutralised');
    const file = await buildUserExport({ format: 'csv' }, { readPage });
    const text = file.buffer.toString('utf8');
    assert.ok(text.startsWith('﻿"Name","Email"'));
    assert.ok(text.includes('"\'=HYPERLINK'), 'formula is neutralised');
    assert.ok(text.includes('"DELETED"'), 'deleted accounts are labelled clearly');
    assert.match(file.filename, /^tradeexpress-users-.*\.csv$/);
  });

  await t.test('Excel: a real .xlsx with every user as text cells', async () => {
    const file = await buildUserExport({ format: 'xlsx' }, { readPage });
    const sheet = XLSX.read(file.buffer).Sheets.Users;
    assert.equal(XLSX.utils.sheet_to_json(sheet).length, 230);
    assert.equal(sheet.A2.t, 's');
    assert.equal(sheet.A2.f, undefined, 'never a formula');
  });

  await t.test('PDF: a real PDF document', async () => {
    const file = await buildUserExport({ format: 'pdf' }, { readPage });
    assert.equal(file.buffer.subarray(0, 5).toString(), '%PDF-');
    assert.equal(file.contentType, 'application/pdf');
  });

  await t.test('an unknown format is refused', async () => {
    await assert.rejects(buildUserExport({ format: 'exe' }, { readPage }), (e) => e.statusCode === 400 && e.errorCode === 'INVALID_EXPORT_FORMAT');
  });
});
