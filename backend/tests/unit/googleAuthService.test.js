import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Test-only OAuth client; no real network calls are made (Google's endpoints are stubbed)
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
const { clearGoogleKeyCache, getVerifiedGoogleProfile, verifyGoogleIdToken } = await import('../../src/services/googleAuthService.js');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'test-key-1';
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' };

function stubCerts() {
  const calls = [];
  const fetchCerts = async (url) => {
    calls.push(url);
    return { headers: { 'cache-control': 'public, max-age=600' }, data: { keys: [jwk] } };
  };
  return { fetchCerts, calls };
}

function idToken(claims = {}, { key = privateKey, kid = KID, ...options } = {}) {
  return jwt.sign(
    { sub: '1234567890', email: 'Buyer@Example.com', email_verified: true, name: 'Test Buyer', picture: 'https://lh3.googleusercontent.com/a/x', ...claims },
    key,
    { algorithm: 'RS256', keyid: kid, audience: process.env.GOOGLE_CLIENT_ID, issuer: 'https://accounts.google.com', expiresIn: '5m', ...options },
  );
}

function stubTokenEndpoint(status, data) {
  const calls = [];
  const request = async (url, body) => {
    calls.push({ url, body: new URLSearchParams(body) });
    return { status, data };
  };
  return { request, calls };
}

test.beforeEach(() => clearGoogleKeyCache());

test('valid Google sign-in returns the verified profile and sends the code with the client secret', async () => {
  const { request, calls } = stubTokenEndpoint(200, { id_token: idToken() });
  const profile = await getVerifiedGoogleProfile('4/0-one-time-code', { request, fetchCerts: stubCerts().fetchCerts });

  assert.deepEqual(profile, { googleId: '1234567890', email: 'buyer@example.com', name: 'Test Buyer', picture: 'https://lh3.googleusercontent.com/a/x' });
  assert.equal(calls[0].url, 'https://oauth2.googleapis.com/token');
  assert.equal(calls[0].body.get('code'), '4/0-one-time-code');
  assert.equal(calls[0].body.get('client_secret'), 'test-secret');
  assert.equal(calls[0].body.get('redirect_uri'), 'postmessage');
});

test('signing keys are cached between sign-ins', async () => {
  const certs = stubCerts();
  await verifyGoogleIdToken(idToken(), { fetchCerts: certs.fetchCerts });
  await verifyGoogleIdToken(idToken(), { fetchCerts: certs.fetchCerts });
  assert.equal(certs.calls.length, 1);
});

test('a token signed by a different key is rejected', async () => {
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  await assert.rejects(verifyGoogleIdToken(idToken({}, { key: other }), { fetchCerts: stubCerts().fetchCerts }), { statusCode: 401, errorCode: 'GOOGLE_AUTH_FAILED' });
});

test('a token issued for another app (audience) is rejected', async () => {
  await assert.rejects(verifyGoogleIdToken(idToken({}, { audience: 'someone-else' }), { fetchCerts: stubCerts().fetchCerts }), { statusCode: 401 });
});

test('a token from another issuer is rejected', async () => {
  await assert.rejects(verifyGoogleIdToken(idToken({}, { issuer: 'https://evil.example' }), { fetchCerts: stubCerts().fetchCerts }), { statusCode: 401 });
});

test('an expired token is rejected', async () => {
  await assert.rejects(verifyGoogleIdToken(idToken({}, { expiresIn: -10 }), { fetchCerts: stubCerts().fetchCerts }), { statusCode: 401 });
});

test('an unsigned or HS256 token is rejected before key lookup', async () => {
  const forged = jwt.sign({ sub: '1', email: 'x@example.com', email_verified: true }, 'secret', { algorithm: 'HS256', keyid: KID });
  const certs = stubCerts();
  await assert.rejects(verifyGoogleIdToken(forged, { fetchCerts: certs.fetchCerts }), { statusCode: 401 });
  assert.equal(certs.calls.length, 0);
});

test('an email Google has not verified is refused', async () => {
  await assert.rejects(verifyGoogleIdToken(idToken({ email_verified: false }), { fetchCerts: stubCerts().fetchCerts }), { statusCode: 403, errorCode: 'GOOGLE_EMAIL_NOT_VERIFIED' });
});

test('an expired or reused authorization code gives a clear message', async () => {
  const { request } = stubTokenEndpoint(400, { error: 'invalid_grant', error_description: 'Bad Request' });
  await assert.rejects(getVerifiedGoogleProfile('used-code-123', { request, fetchCerts: stubCerts().fetchCerts }), { statusCode: 401, message: /expired or was already used/ });
});

test('Google being unreachable is reported as 503', async () => {
  const request = async () => { throw new Error('ECONNRESET'); };
  await assert.rejects(getVerifiedGoogleProfile('some-code-123', { request, fetchCerts: stubCerts().fetchCerts }), { statusCode: 503, errorCode: 'GOOGLE_UNREACHABLE' });
});
