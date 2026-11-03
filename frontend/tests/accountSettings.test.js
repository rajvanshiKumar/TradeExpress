import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ACCOUNT_CARDS, DASHBOARD_HOME } from '../src/components/account/accountSections.js';

const read = (file) => fs.readFileSync(path.resolve(file), 'utf8');
const rows = ACCOUNT_CARDS.flatMap((card) => card.rows);

describe('Account Settings structure', () => {
  it('has the three cards with the requested options', () => {
    assert.deepEqual(ACCOUNT_CARDS.map((card) => card.title), ['Account Information', 'Account Security', 'Preferences']);
    for (const label of ['My Profile', 'Member Profile', 'Connected Accounts', 'Tax Information', 'Change Password', 'Change Email',
      'Change Phone Number', 'Two-Factor Authentication', 'Active Login Sessions', 'Delete Account', 'Privacy Settings',
      'Email Preferences', 'Notification Preferences', 'Language Preferences']) {
      assert.ok(rows.some((row) => row.label === label), `missing ${label}`);
    }
  });

  it('only marks built sections as available; nothing pretends to work', () => {
    const available = rows.filter((row) => row.available).map((row) => row.id).sort();
    assert.deepEqual(available, ['connected', 'email', 'member', 'password', 'profile', 'tax']);
  });

  it('never offers self-service deletion or tax details to the Super Admin', () => {
    assert.ok(!rows.find((row) => row.id === 'delete').roles.includes('super_admin'));
    assert.ok(!rows.find((row) => row.id === 'tax').roles.includes('super_admin'));
  });

  it('has a dashboard home for each role', () => {
    assert.deepEqual(DASHBOARD_HOME, { buyer: '/buyer', supplier: '/supplier', super_admin: '/super-admin' });
  });
});

describe('Account Settings routing and safety', () => {
  const routes = read('src/routes/AppRoutes.jsx');
  const api = read('src/services/accountApi.js');
  const profile = read('src/components/account/AccountProfileSection.jsx');

  it('routes each role inside its own protected dashboard group', () => {
    for (const base of ['/buyer/account-settings', '/supplier/account-settings', '/super-admin/account-settings']) {
      assert.ok(routes.includes(`path="${base}"`), `missing ${base}`);
      assert.ok(routes.includes(`path="${base}/:section"`), `missing ${base}/:section`);
    }
  });

  it('never sends a user id; the server takes identity from the login token', () => {
    assert.doesNotMatch(api, /userId/);
  });

  it('does not let the profile form change email, phone, role or GSTIN', () => {
    assert.doesNotMatch(profile, /updateAccountProfile\(\{[^}]*(email|phone|role|gstin)/);
    assert.match(profile, /changed through verified steps/);
  });
});

describe('Change password and change email screens', () => {
  const flows = read('src/components/account/AccountVerificationFlows.jsx');
  const api = read('src/services/accountApi.js');

  it('keeps the one-time authorization in memory, never in the URL or browser storage', () => {
    assert.doesNotMatch(flows, /localStorage\.setItem\([^)]*grant/);
    assert.doesNotMatch(flows, /navigate\([^)]*grant|searchParams|\?grant=/);
    assert.match(api, /The authorization \("grant"\) stays in memory only/);
  });

  it('uses the requested wording', () => {
    for (const text of ['Verify your identity', 'For your account security, please verify your registered email address before changing your password.',
      'Your password has been updated successfully.', 'Verify your current email address', 'Your email address has been changed successfully.']) {
      assert.ok(flows.includes(text), `missing text: ${text}`);
    }
  });

  it('shows an expiry countdown and honours the server resend cooldown', () => {
    assert.match(flows, /It expires in \{clock\(expiresIn\)\}/);
    assert.match(flows, /cooldown=\{cooldown\}/);
    assert.match(flows, /err\.cooldownRemaining/);
  });

  it('checks the new email locally before asking the server (format, match, different from current)', () => {
    for (const text of ['Enter a valid email address.', 'The email addresses do not match.', 'The new email address must be different from your current one.']) {
      assert.ok(flows.includes(text), `missing check: ${text}`);
    }
  });
});
