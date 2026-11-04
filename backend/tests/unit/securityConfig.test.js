import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { ENV } from '../../src/config/env.js';
import { isAllowedCorsOrigin } from '../../src/config/cors.js';

describe('Security configuration', () => {
  it('allows only configured origins in production', () => {
    const originalMode = ENV.NODE_ENV;
    const originalOrigins = [...ENV.CORS_ORIGINS];
    try {
      ENV.NODE_ENV = 'production';
      ENV.CORS_ORIGINS.splice(0, ENV.CORS_ORIGINS.length, 'https://shop.example.com');
      assert.equal(isAllowedCorsOrigin('https://shop.example.com'), true);
      assert.equal(isAllowedCorsOrigin('https://evil.example'), false);
      assert.equal(isAllowedCorsOrigin('http://localhost:5173'), false);
      assert.equal(isAllowedCorsOrigin(undefined), true);
    } finally {
      ENV.NODE_ENV = originalMode;
      ENV.CORS_ORIGINS.splice(0, ENV.CORS_ORIGINS.length, ...originalOrigins);
    }
  });

  it('allows localhost origins in development only', () => {
    const originalMode = ENV.NODE_ENV;
    const originalOrigins = [...ENV.CORS_ORIGINS];
    try {
      ENV.CORS_ORIGINS.splice(0, ENV.CORS_ORIGINS.length);
      ENV.NODE_ENV = 'development';
      assert.equal(isAllowedCorsOrigin('http://localhost:5173'), true);
      assert.equal(isAllowedCorsOrigin('http://127.0.0.1:5173'), true);
      assert.equal(isAllowedCorsOrigin('https://localhost:5173'), false);
      assert.equal(isAllowedCorsOrigin('https://evil.example'), false);
      ENV.NODE_ENV = 'production';
      assert.equal(isAllowedCorsOrigin('http://localhost:5173'), false);
    } finally {
      ENV.NODE_ENV = originalMode;
      ENV.CORS_ORIGINS.splice(0, ENV.CORS_ORIGINS.length, ...originalOrigins);
    }
  });

  it('fails configuration loading when JWT_SECRET is missing or weak', () => {
    const envUrl = new URL('../../src/config/env.js', import.meta.url);
    const script = `import(${JSON.stringify(envUrl.href)})`;
    for (const secret of ['', 'short-secret', 'REPLACE_WITH_RANDOM_SECRET_AT_LEAST_32_BYTES']) {
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        encoding: 'utf8',
        env: { ...process.env, JWT_SECRET: secret },
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Invalid JWT_SECRET/);
    }
  });
});
