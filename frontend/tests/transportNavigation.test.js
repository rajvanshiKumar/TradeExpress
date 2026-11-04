import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROLE_HOME } from '../src/utils/constants.js';
import { dashboardNav } from '../src/data/navigation.js';

const routes = readFileSync(new URL('../src/routes/AppRoutes.jsx', import.meta.url), 'utf8');

describe('Transport & Delivery Management navigation', () => {
  it('suppliers have exactly one transport menu entry, pointing at the new module', () => {
    const transport = dashboardNav.supplier.filter((item) => /transport|shipping|logistics/i.test(`${item.label} ${item.to}`));
    assert.equal(transport.length, 1);
    assert.deepEqual({ label: transport[0].label, to: transport[0].to }, { label: 'Transport & Delivery Management', to: '/supplier/transport' });
  });

  it('old shipping and logistics URLs redirect to the new pages', () => {
    assert.match(routes, /path="\/supplier\/transport" element={<SupplierTransport \/>}/);
    assert.match(routes, /path="\/supplier\/shipping" element={<Navigate to="\/supplier\/transport" replace \/>}/);
    assert.match(routes, /path="\/super-admin\/transport" element={<SuperAdminTransport \/>}/);
    assert.match(routes, /path="\/super-admin\/logistics" element={<Navigate to="\/super-admin\/transport" replace \/>}/);
    assert.match(routes, /path="\/buyer\/shipments" element={<Navigate to="\/buyer\/orders" replace \/>}/);
  });

  it('the retired transport-partner portal has no menu and sends visitors home', () => {
    assert.equal(dashboardNav.transport_partner, undefined);
    assert.equal(ROLE_HOME.transport_partner, '/');
    assert.match(routes, /path="\/transporter\/\*" element={<Navigate to="\/" replace \/>}/);
    assert.doesNotMatch(routes, /TransporterDashboard|SupplierShipping|SuperAdminLogistics|BuyerShipments/);
  });

  it('buyers get no truck booking screens', () => {
    const buyerTransport = dashboardNav.buyer.filter((item) => /transport|truck|logistics/i.test(`${item.label} ${item.to}`));
    assert.equal(buyerTransport.length, 0);
  });
});
