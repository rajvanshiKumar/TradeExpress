import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyGstin,
  getGstProviderConfig,
  clearVerificationCache,
  GST_STATE_CODES,
  GST_ENTITY_TYPES,
} from '../../src/services/verificationService.js';

describe('TradeExpress Statutory GSTIN Verification Suite', () => {
  beforeEach(() => {
    clearVerificationCache();
  });

  describe('1. Provider Credentials & Environment Configuration', () => {
    it('retrieves configured provider credentials from environment', () => {
      const config = getGstProviderConfig();
      assert.ok(config.baseUrl, 'Base URL must be configured');
      assert.ok(config.baseUrl.includes('/v1/uat/gst/verify') || config.baseUrl.includes('devtunnels.ms'), 'Base URL must match target');
      assert.strictEqual(config.apiId, 'API838738');
      assert.strictEqual(config.apiKey, 'vk_live_s6Yk3EspeWx0_CzH_CtAdjmvyqoG-5Zqr70aXT8YRaA');
      assert.strictEqual(config.tokenId, 'vt_live_NmyHNd4BMOCHPSa0OyZwBaEHdXMSRwXJnZRtxCe8Kcc');
    });
  });

  describe('2. GSTIN Format Validation & Parsing', () => {
    it('successfully verifies and decodes valid Maharashtra corporate GSTIN', async () => {
      const gstin = '27AACCA1234F1Z5';
      const result = await verifyGstin({ gstin });

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.gstin, '27AACCA1234F1Z5');
      assert.strictEqual(result.stateCode, '27');
      assert.strictEqual(result.state, 'Maharashtra');
      assert.strictEqual(result.pan, 'AACCA1234F');
      assert.strictEqual(result.status, 'ACTIVE');
      assert.ok(result.constitutionOfBusiness.includes('Company'));
      assert.ok(result.source === 'EXTERNAL_PROVIDER' || result.source === 'STATUTORY_VERIFICATION');
    });

    it('successfully verifies and decodes valid Karnataka partnership GSTIN', async () => {
      const gstin = '29ABCDE1234F1Z5';
      const result = await verifyGstin({ gstin });

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.gstin, '29ABCDE1234F1Z5');
      assert.strictEqual(result.stateCode, '29');
      assert.strictEqual(result.state, 'Karnataka');
      assert.strictEqual(result.pan, 'ABCDE1234F');
    });

    it('successfully verifies and decodes Delhi individual proprietorship GSTIN', async () => {
      const gstin = '07APMPR1234A1Z1'; // 'P' in 4th character of PAN = Proprietorship
      const result = await verifyGstin({ gstin });

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.stateCode, '07');
      assert.strictEqual(result.state, 'Delhi');
      assert.ok(result.constitutionOfBusiness.includes('Individual') || result.constitutionOfBusiness.includes('Proprietorship'));
    });

    it('rejects incomplete GSTIN with fewer than 15 characters', async () => {
      await assert.rejects(
        async () => {
          await verifyGstin({ gstin: '27ABCDE1234F1Z' }); // 14 chars
        },
        (err) => {
          assert.strictEqual(err.statusCode, 422);
          assert.strictEqual(err.code, 'INVALID_GSTIN_FORMAT');
          return true;
        }
      );
    });

    it('rejects invalid GSTIN with illegal special characters or lowercase letters by sanitizing or validating', async () => {
      // Lowercase is auto-uppercased
      const res = await verifyGstin({ gstin: '27abcde1234f1z5' });
      assert.strictEqual(res.gstin, '27ABCDE1234F1Z5');

      // Invalid characters fail
      await assert.rejects(
        async () => {
          await verifyGstin({ gstin: '27ABCDE1234F!Z5' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 422);
          return true;
        }
      );
    });
  });

  describe('3. Deduplication & In-Memory Caching', () => {
    it('serves repeated inquiries from in-memory cache to save provider quotas', async () => {
      const gstin = '24ABCDE1234F1Z5'; // Gujarat
      const first = await verifyGstin({ gstin });
      assert.strictEqual(first.fromCache, undefined);

      const second = await verifyGstin({ gstin });
      assert.strictEqual(second.fromCache, true);
      assert.strictEqual(second.gstin, first.gstin);
      assert.strictEqual(second.state, 'Gujarat');
    });
  });

  describe('4. Statutory State and Entity Reference Lookups', () => {
    it('contains standard statutory Indian GST states mapping', () => {
      assert.strictEqual(GST_STATE_CODES['27'], 'Maharashtra');
      assert.strictEqual(GST_STATE_CODES['07'], 'Delhi');
      assert.strictEqual(GST_STATE_CODES['29'], 'Karnataka');
      assert.strictEqual(GST_STATE_CODES['33'], 'Tamil Nadu');
      assert.strictEqual(GST_STATE_CODES['09'], 'Uttar Pradesh');
    });

    it('contains standard statutory entity constitution mapping', () => {
      assert.ok(GST_ENTITY_TYPES['C'].includes('Company'));
      assert.ok(GST_ENTITY_TYPES['P'].includes('Individual') || GST_ENTITY_TYPES['P'].includes('Proprietorship'));
      assert.ok(GST_ENTITY_TYPES['F'].includes('Partnership') || GST_ENTITY_TYPES['F'].includes('LLP'));
    });
  });
});
