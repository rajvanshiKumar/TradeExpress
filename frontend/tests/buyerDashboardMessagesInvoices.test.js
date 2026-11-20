import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('Buyer Dashboard: removed sections and invoice popup', () => {
  it('no longer shows the Messages & Invoices, Tax Invoices & Billing or Recently viewed sections', () => {
    const dashboard = read('src/pages/buyer/BuyerDashboard.jsx');
    assert.doesNotMatch(dashboard, /messages-and-invoices-title|Messages & Invoices/, 'Messages & Invoices section removed');
    assert.doesNotMatch(dashboard, /Tax Invoices & Billing/, 'Tax Invoices & Billing panel removed');
    assert.doesNotMatch(dashboard, /recently-viewed-title|Recently viewed/, 'Recently viewed section removed');
    // Messages stay one click away through the stat card, inside the buyer portal
    assert.match(dashboard, /to="\/buyer\/messages"/, 'Messages card opens the inbox inside the buyer portal');
  });

  it('integrates TaxInvoiceModal with instant view in BuyerDashboard', () => {
    const dashboard = read('src/pages/buyer/BuyerDashboard.jsx');

    // TaxInvoiceModal import and state
    assert.match(dashboard, /import TaxInvoiceModal from '\.\.\/\.\.\/components\/common\/TaxInvoiceModal'/, 'Must import TaxInvoiceModal');
    assert.match(dashboard, /selectedInvoiceOrder/, 'Must manage selectedInvoiceOrder state');
    assert.match(dashboard, /<TaxInvoiceModal/, 'Must mount TaxInvoiceModal component');
    assert.match(dashboard, /defaultRole="buyer"/, 'Must set defaultRole to buyer');
  });

  it('provides an Invoice action button in Recent Orders table', () => {
    const dashboard = read('src/pages/buyer/BuyerDashboard.jsx');

    // Table headers and invoice button
    assert.match(dashboard, /<th scope="col" className="text-right">Invoice<\/th>/, 'Must have Invoice column header in Recent orders table');
    assert.match(dashboard, /setSelectedInvoiceOrder\(order\)/, 'Invoice button must set selectedInvoiceOrder on click');
  });
});

