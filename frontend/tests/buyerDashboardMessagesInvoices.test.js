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

describe('Buyer Dashboard Messages & Invoices Hub Suite', () => {
  it('renders a unified Messages & Invoices section in BuyerDashboard.jsx', () => {
    const dashboard = read('src/pages/buyer/BuyerDashboard.jsx');

    // Section title and accessibility heading
    assert.match(dashboard, /id="messages-and-invoices-title"/, 'Must contain messages-and-invoices-title heading id');
    assert.match(dashboard, /Messages & Invoices/, 'Must display "Messages & Invoices" heading');

    // Sub-cards for Supplier Messages and Tax Invoices
    assert.match(dashboard, /Supplier Messages/, 'Must render Supplier Messages panel');
    assert.match(dashboard, /Tax Invoices & Billing/, 'Must render Tax Invoices & Billing panel');

    // Navigation shortcuts for quick access
    assert.match(dashboard, /to="\/messages"/, 'Must link to /messages inbox');
    assert.match(dashboard, /to="\/buyer\/payments"/, 'Must link to /buyer/payments');
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

  it('deduplicates supplier conversations so each supplier appears only once', () => {
    const dashboard = read('src/pages/buyer/BuyerDashboard.jsx');

    // Deduplication logic
    assert.match(dashboard, /uniqueConversations/, 'Must define uniqueConversations memo');
    assert.match(dashboard, /seen\.has\(suppKey\)/, 'Must deduplicate supplier conversations by suppKey');
  });
});

