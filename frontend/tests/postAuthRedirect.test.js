import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { postAuthPath } from '../src/utils/postAuthRedirect.js';

const buyer = { role: 'buyer' };
const supplier = { role: 'supplier' };

describe('After sign-in / sign-up: buyers and suppliers land on Home', () => {
  it('buyer and supplier (password, OTP, Google, sign-up) go to "/" and never to a dashboard', () => {
    assert.equal(postAuthPath(buyer), '/');
    assert.equal(postAuthPath(supplier), '/');
    assert.equal(postAuthPath({ role: 'exporter' }), '/');
  });

  it('Super Admin and Admin keep their console', () => {
    assert.equal(postAuthPath({ role: 'super_admin' }), '/super-admin');
    assert.equal(postAuthPath({ role: 'admin' }), '/admin');
  });

  it('returns to the page that asked for sign-in, when the role may open it', () => {
    assert.equal(postAuthPath(buyer, '/products/cow-ghee'), '/products/cow-ghee');
    assert.equal(postAuthPath(buyer, '/buyer/orders'), '/buyer/orders'); // the user chose this dashboard page
    assert.equal(postAuthPath(supplier, '/supplier/products'), '/supplier/products');
  });

  it('never returns to a login page, another role\'s dashboard or the admin area (no loops)', () => {
    assert.equal(postAuthPath(buyer, '/login'), '/');
    assert.equal(postAuthPath(supplier, '/supplier/login'), '/');
    assert.equal(postAuthPath(buyer, '/register'), '/');
    assert.equal(postAuthPath(buyer, '/supplier/products'), '/');
    assert.equal(postAuthPath(supplier, '/buyer/orders'), '/');
    assert.equal(postAuthPath(buyer, '/super-admin'), '/');
    assert.equal(postAuthPath(buyer, 'https://evil.example/'), '/');
  });
});
