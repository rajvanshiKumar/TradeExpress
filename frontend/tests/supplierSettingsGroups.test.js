import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_SECTION_TITLES, SUPPLIER_SETTINGS_GROUPS } from '../src/components/account/accountSections.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const routes = fs.readFileSync(path.join(here, '../src/routes/AppRoutes.jsx'), 'utf8');
const page = fs.readFileSync(path.join(here, '../src/pages/account/AccountSettingsPage.jsx'), 'utf8');

describe('Supplier Account Settings groups', () => {
  it('has the agreed groups in order', () => {
    assert.deepEqual(SUPPLIER_SETTINGS_GROUPS.map((g) => g.title), [
      'Business Profile', 'Account Security & Login', 'Bank & Payment', 'Notification Settings', 'Order Preferences', 'Shipping & Logistics',
      'Documents & Compliance', 'Account Management',
    ]);
  });

  it('removed settings are not offered to suppliers', () => {
    const ids = SUPPLIER_SETTINGS_GROUPS.flatMap((g) => g.rows.map((r) => r.id));
    for (const id of ['team-members', 'privacy', 'communication-defaults', 'shipping-defaults', 'sessions', 'login-activity', 'two-factor', 'inventory-defaults', 'order-defaults', 'sms-channel', 'invoice-settings', 'real-time-inventory', 'messages', 'buyer-rfqs', 'language']) {
      assert.ok(!ids.includes(id), `${id} must not be listed`);
    }
  });

  it('every row is a working section, an existing module page, or clearly planned', () => {
    const ids = new Set();
    for (const row of SUPPLIER_SETTINGS_GROUPS.flatMap((g) => g.rows)) {
      assert.ok(!ids.has(row.id), `duplicate row id ${row.id}`);
      ids.add(row.id);
      if (row.to) {
        assert.ok(routes.includes(`path="${row.to}"`), `${row.label}: route ${row.to} exists`);
      } else if (row.available) {
        const key = /^[a-z]+$/.test(row.id) ? `  ${row.id}: ` : `  '${row.id}': `;
        assert.ok(page.includes(key), `${row.label}: has a section component`);
        assert.ok(ALL_SECTION_TITLES[row.id], `${row.label}: has a page title`);
      } else {
        assert.ok(row.planned, `${row.label}: says when it is planned`);
      }
    }
  });

  it('supplier settings sections are reachable by URL', () => {
    assert.ok(routes.includes('path="/supplier/account-settings/:section"'));
    assert.ok(routes.includes('path="/exporter/account-settings/:section"'));
  });
});
