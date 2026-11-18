import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const layout = fs.readFileSync(path.join(here, '../src/components/layout/SuperAdminLayout.jsx'), 'utf8');
const routes = fs.readFileSync(path.join(here, '../src/routes/AppRoutes.jsx'), 'utf8');
const dashboard = fs.readFileSync(path.join(here, '../src/pages/superadmin/SuperAdminDashboard.jsx'), 'utf8');

describe('Super Admin layout and dashboard', () => {
  it('every sidebar link opens a real page (no placeholder navigation)', () => {
    const links = [...layout.matchAll(/to: '(\/super-admin[^']*)'/g)].map((m) => m[1]);
    assert.ok(links.length >= 15);
    for (const to of links) assert.ok(routes.includes(`path="${to}"`), `${to} has a route`);
  });

  it('no hard-coded identity or permanent "connected" claim in the shell', () => {
    assert.doesNotMatch(layout, /krajvanshi|Rajvanshi Kumar/);
    assert.doesNotMatch(layout, /MySQL Aiven Connected/);
  });

  it('the dashboard takes every figure from the API (no invented growth)', () => {
    assert.match(dashboard, /superAdminApi\.getDashboard\(params\)/);
    assert.match(dashboard, /No earlier data to compare/);
    assert.doesNotMatch(dashboard, /\+\d+(\.\d+)?%/, 'no literal growth percentages');
  });
});
