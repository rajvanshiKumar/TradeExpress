import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { authFetch, isMissingRouteResponse } from '../src/api/authClient.js';

const realFetch = globalThis.fetch;
const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const html = () => new Response('<!doctype html><html></html>', { status: 200, headers: { 'content-type': 'text/html' } });

const ACCOUNT_NOT_FOUND = {
  success: false,
  message: 'No account found with this email. Please sign up to create your TradeExpress account.',
  code: 'ACCOUNT_NOT_FOUND',
};

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('authFetch — wrong email is not a connection failure', () => {
  it('returns the backend 404 "No account found" answer instead of "Unable to connect"', async () => {
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(url);
      return json(404, ACCOUNT_NOT_FOUND);
    };
    const res = await authFetch('/auth/login', { method: 'POST', body: '{}' });
    assert.equal(res.ok, false);
    assert.equal(res.status, 404);
    assert.equal(res.data.code, 'ACCOUNT_NOT_FOUND');
    assert.match(res.data.message, /No account found with this email/);
    assert.doesNotMatch(res.data.message, /Unable to connect/);
    assert.equal(calls.length, 1, 'a real API answer must not be retried on other servers');
  });

  // In Node there is no window, so authFetch has two candidates (localhost:5000 and 127.0.0.1:5000)
  for (const [label, skipped] of [
    ['an HTML fallback page', () => html()],
    ['the backend unmatched-route 404', () => json(404, { success: false, message: 'API Route not found: POST /api/auth/login' })],
  ]) {
    it(`still skips a target that returns ${label} and uses the next one`, async () => {
      const answers = [skipped, () => json(401, { success: false, message: 'Incorrect password.' })];
      let i = 0;
      globalThis.fetch = async () => answers[Math.min(i++, answers.length - 1)]();
      const res = await authFetch('/auth/login', { method: 'POST', body: '{}' });
      assert.equal(res.status, 401);
      assert.equal(res.data.message, 'Incorrect password.');
      assert.equal(i, 2);
    });
  }

  it('reports a connection failure only when no server answers', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    const res = await authFetch('/auth/login', { method: 'POST', body: '{}' });
    assert.equal(res.status, 0);
    assert.match(res.data.message, /Unable to connect to the authentication server/);
  });
});

describe('isMissingRouteResponse', () => {
  it('treats only non-API replies and unmatched routes as missing', () => {
    assert.equal(isMissingRouteResponse(200, 'text/html', null), true);
    assert.equal(isMissingRouteResponse(404, 'text/plain', { message: 'Not Found' }), true);
    assert.equal(isMissingRouteResponse(404, 'application/json', { message: 'API Route not found: POST /api/auth/x' }), true);
    assert.equal(isMissingRouteResponse(404, 'application/json', ACCOUNT_NOT_FOUND), false);
    assert.equal(isMissingRouteResponse(401, 'application/json', { message: 'Incorrect password.' }), false);
    assert.equal(isMissingRouteResponse(200, 'application/json', { success: true }), false);
  });
});
