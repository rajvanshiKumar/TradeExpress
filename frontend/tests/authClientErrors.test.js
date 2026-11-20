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

  // The backend comes only from VITE_PUBLIC_API_BASE_URL: a wrong reply is reported, never retried on localhost
  for (const [label, reply] of [
    ['an HTML page (e.g. a tunnel sign-in or warning page)', () => html()],
    ['the backend unmatched-route 404', () => json(404, { success: false, message: 'API Route not found: POST /api/auth/login' })],
  ]) {
    it(`reports ${label} as a connection problem and never falls back to localhost`, async () => {
      const calls = [];
      globalThis.fetch = async (url) => { calls.push(String(url)); return reply(); };
      const res = await authFetch('/auth/login', { method: 'POST', body: '{}' });
      assert.equal(res.ok, false);
      assert.equal(res.status, 0);
      assert.match(res.data.message, /Unable to connect to the authentication server/);
      assert.equal(calls.length, 1, 'only the configured backend is called');
      assert.equal(calls.some((u) => /localhost|127\.0\.0\.1/.test(u)), false);
    });
  }

  it('reports a connection failure only when no server answers', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    const res = await authFetch('/auth/login', { method: 'POST', body: '{}' });
    assert.equal(res.status, 0);
    assert.match(res.data.message, /Unable to connect to the authentication server/);
    assert.equal(res.reason, 'unreachable', 'nothing reached the server, so no code can have been sent');
  });

  it('reports a late reply as a timeout (the server may still have sent the code)', async () => {
    globalThis.fetch = async () => {
      throw new DOMException('The operation timed out.', 'TimeoutError');
    };
    const res = await authFetch('/auth/send-email-otp', { method: 'POST', body: '{}' });
    assert.equal(res.status, 0);
    assert.equal(res.reason, 'timeout');
    assert.match(res.data.message, /taking longer than usual/);
  });
});

describe('Login OTP request failures', () => {
  it('never claims a code was sent when the server could not be reached', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/components/forms/LoginForm.jsx', import.meta.url), 'utf8');
    assert.ok(!src.includes('Verification code was dispatched'), 'no "code dispatched" message on a failed request');
    assert.match(src, /res\.reason === "unreachable"/, 'an unreachable server is reported as a connection problem');
    assert.match(src, /res\.reason === "timeout"/, 'only a late reply keeps the code boxes open');
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
