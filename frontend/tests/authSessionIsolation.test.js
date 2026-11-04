import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

// A browser with one shared localStorage and one sessionStorage per window. Switching window = page load in that window.
class FakeStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
  key(i) { return [...this.data.keys()][i] ?? null; }
  get length() { return this.data.size; }
}

const events = [];
const shared = new FakeStorage();
const windows = {};
globalThis.window = {
  localStorage: shared,
  sessionStorage: new FakeStorage(),
  location: { pathname: '/' },
  dispatchEvent: (e) => events.push(e.type),
};

const auth = await import('../src/utils/authSession.js');

const makeToken = (role, userId, expSeconds = 3600) => {
  const part = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'HS256' })}.${part({ userId, role, exp: Math.floor(Date.now() / 1000) + expSeconds })}.sig`;
};
const openWindow = (name, pathname) => {
  windows[name] = windows[name] || new FakeStorage();
  window.sessionStorage = windows[name];
  window.location.pathname = pathname;
  auth.resetWindowSlotForTests();
  return auth.resolveWindowSlot(pathname);
};
const signIn = (name, pathname, role, userId) => {
  openWindow(name, pathname);
  const token = makeToken(role, userId);
  auth.storeAuthToken(token);
  auth.writeRoleSession(auth.slotForRole(role), { userId, role: role.toLowerCase(), expiresAt: Date.now() + 3600e3 });
  return token;
};

describe('Independent sessions for Buyer, Supplier and Super Admin', () => {
  let tokens;
  beforeEach(() => {
    shared.data.clear();
    Object.keys(windows).forEach((k) => delete windows[k]);
    events.length = 0;
    tokens = {
      buyer: signIn('w1', '/login', 'BUYER', 'B1'),
      supplier: signIn('w2', '/login', 'SUPPLIER', 'S1'),
      admin: signIn('w3', '/super-admin/login', 'SUPER_ADMIN', 'A1'),
    };
  });
  const tokenIn = (name, path) => { openWindow(name, path); return auth.getAuthToken(); };

  it('gives each window the token of its own role, also after a refresh', () => {
    assert.equal(tokenIn('w1', '/buyer'), tokens.buyer);
    assert.equal(tokenIn('w2', '/supplier/dashboard'), tokens.supplier);
    assert.equal(tokenIn('w3', '/super-admin'), tokens.admin);
    // Public page: the window keeps its own role instead of the last one used elsewhere
    assert.equal(tokenIn('w1', '/products'), tokens.buyer);
  });

  for (const [who, name, path] of [['buyer', 'w1', '/buyer'], ['supplier', 'w2', '/supplier'], ['admin', 'w3', '/super-admin']]) {
    it(`signing out as ${who} signs out only ${who}`, () => {
      openWindow(name, path);
      assert.equal(auth.signOutWindow(), who);
      assert.equal(auth.getAuthToken(), '');
      assert.equal(shared.getItem(auth.TOKEN_KEYS[who]), null);
      for (const other of ['buyer', 'supplier', 'admin'].filter((s) => s !== who)) {
        assert.equal(auth.getTokenForSlot(other), tokens[other]);
        assert.ok(auth.readRoleSession(other).userId);
      }
    });
  }

  it('stays signed out after a refresh on a public page, while other roles stay signed in', () => {
    openWindow('w1', '/buyer');
    auth.signOutWindow();
    assert.equal(openWindow('w1', '/products'), null);
    assert.equal(auth.getAuthToken(), '');
    assert.equal(auth.getTokenForSlot('supplier'), tokens.supplier);
  });

  it('starts a new window on a sign-in page signed out, so another role can sign in', () => {
    assert.equal(openWindow('new', '/login'), null);
    assert.equal(openWindow('new2', '/register'), null);
    assert.equal(openWindow('new3', '/super-admin/login'), 'admin'); // That role is already signed in here
  });

  it('continues as the role in use when a link opens in a new tab on a public page', () => {
    openWindow('w2', '/supplier');
    auth.rememberActiveSlot('supplier');
    assert.equal(openWindow('tab', '/products/1'), 'supplier');
  });

  it('a dashboard address does not match public pages such as /suppliers', () => {
    assert.equal(auth.slotForPath('/supplier/orders'), 'supplier');
    assert.equal(auth.slotForPath('/suppliers'), null);
    assert.equal(auth.slotForPath('/suppliers/acme'), null);
    // A supplier's public profile, opened by scanning a QR code, belongs to nobody's dashboard
    assert.equal(auth.slotForPath('/supplier/TE-SEL-000123'), null);
    assert.equal(auth.slotForPath('/supplier/SUP-123456'), null);
    assert.equal(auth.slotForPath('/supplier/documents'), 'supplier');
    assert.equal(auth.slotForPath('/buyer'), 'buyer');
    assert.equal(auth.slotForPath('/super-admin/users'), 'admin');
    assert.equal(auth.slotForPath('/admin'), 'admin');
  });

  it('an expired token ends only that role', () => {
    shared.setItem('supplier_token', makeToken('SUPPLIER', 'S1', -10));
    assert.equal(auth.readRoleSession('supplier').userId, null);
    assert.equal(shared.getItem('supplier_token'), null);
    assert.equal(auth.readRoleSession('buyer').userId, 'B1');
    assert.equal(auth.readRoleSession('admin').userId, 'A1');
  });

  it('a token the server rejects ends only that role, and an old response cannot end a newer sign-in', () => {
    auth.handleRejectedToken(tokens.supplier);
    assert.equal(shared.getItem('supplier_token'), null);
    assert.equal(auth.getTokenForSlot('buyer'), tokens.buyer);
    assert.deepEqual(events, [auth.AUTH_CHANGED_EVENT]);

    const newer = signIn('w2', '/login', 'SUPPLIER', 'S1b');
    auth.handleRejectedToken(tokens.supplier);
    assert.equal(shared.getItem('supplier_token'), newer);
  });

  it('never returns a session whose token belongs to another account', () => {
    shared.setItem('buyer_token', makeToken('BUYER', 'SOMEONE-ELSE'));
    assert.equal(auth.readRoleSession('buyer').userId, null);
  });

  it('moves an old shared sign-in into its role and removes the old keys', () => {
    shared.data.clear();
    const old = makeToken('SUPPLIER', 'S9');
    shared.setItem('tradeexpress_auth_token', old);
    shared.setItem('tradesphere_auth_token', old);
    shared.setItem('tradesphere:v3:session', JSON.stringify({ userId: 'S9', role: 'supplier', expiresAt: Date.now() + 3600e3 }));
    assert.equal(openWindow('legacy', '/supplier'), 'supplier');
    assert.equal(auth.getAuthToken(), old);
    assert.equal(auth.readRoleSession('supplier').userId, 'S9');
    assert.equal(shared.getItem('tradeexpress_auth_token'), null);
    assert.equal(shared.getItem('tradesphere_auth_token'), null);
    assert.equal(shared.getItem('tradesphere:v3:session'), null);
  });
});
