import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkPanAadhaarLinkStatus,
  clearVerificationCache,
  doesPanMatchMaskedPan,
} from '../../src/services/verificationService.js';

test('PAN-Aadhaar Statutory Verification Service Suite', async (t) => {
  t.beforeEach(() => {
    clearVerificationCache();
  });

  await t.test('1. Statutory Consent Requirement', async () => {
    await assert.rejects(
      async () => {
        await checkPanAadhaarLinkStatus({
          aadhaarNumber: '123456789012',
          pan: 'ABCDE1234F',
          userConsent: false,
        });
      },
      (err) => {
        assert.equal(err.code, 'CONSENT_REQUIRED');
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  await t.test('2. Aadhaar 12-Digit Format Validation', async () => {
    await assert.rejects(
      async () => {
        await checkPanAadhaarLinkStatus({
          aadhaarNumber: '12345',
          pan: 'ABCDE1234F',
          userConsent: true,
        });
      },
      (err) => {
        assert.equal(err.code, 'INVALID_AADHAAR_FORMAT');
        assert.equal(err.statusCode, 422);
        return true;
      }
    );
  });

  await t.test('3. Successful Verification of Linked PAN and Aadhaar', async () => {
    const result = await checkPanAadhaarLinkStatus({
      aadhaarNumber: '999988887777',
      pan: 'ABCDE1234F',
      userConsent: true,
    });

    assert.equal(result.success, true);
    assert.equal(result.status, 'LINKED');
    assert.equal(result.linked, true);
    assert.equal(result.maskedPan, 'ABXXXXXX4F');
    assert.equal(typeof result.message, 'string');
    assert.match(result.disclaimer, /Gold Supplier/);
  });

  await t.test('4. In-Memory Cache Deduplication for Duplicate Requests', async () => {
    const first = await checkPanAadhaarLinkStatus({
      aadhaarNumber: '999988887777',
      pan: 'ABCDE1234F',
      userConsent: true,
    });
    assert.equal(first.status, 'LINKED');

    const second = await checkPanAadhaarLinkStatus({
      aadhaarNumber: '999988887777',
      pan: 'ABCDE1234F',
      userConsent: true,
    });
    assert.equal(second.fromCache, true);
    assert.equal(second.status, 'LINKED');
    assert.equal(second.linked, true);
  });

  await t.test('5. Unlinked Dummy Aadhaar Returns NOT_LINKED', async () => {
    const result = await checkPanAadhaarLinkStatus({
      aadhaarNumber: '000000000000',
      pan: 'ABCDE1234F',
      userConsent: true,
    });

    assert.equal(result.success, true);
    assert.equal(result.status, 'NOT_LINKED');
    assert.equal(result.linked, false);
    assert.equal(result.maskedPan, null);
  });

  await t.test('6. Invalid PAN Format Returns NOT_LINKED', async () => {
    const result = await checkPanAadhaarLinkStatus({
      aadhaarNumber: '999988887777',
      pan: 'INVALID_PAN_123',
      userConsent: true,
    });

    assert.equal(result.success, true);
    assert.equal(result.status, 'NOT_LINKED');
    assert.equal(result.linked, false);
  });

  await t.test('7. Masked PAN Pattern Matching Logic', () => {
    assert.equal(doesPanMatchMaskedPan('MRABC1231F', 'MRXXXXXX1F'), true);
    assert.equal(doesPanMatchMaskedPan('ABCDE1234F', 'MRXXXXXX1F'), false);
    assert.equal(doesPanMatchMaskedPan('MRZZZ9991F', 'MRXXXXXX1F'), true);
    assert.equal(doesPanMatchMaskedPan('ABCDE1234F', 'XXXXXXXXXX'), true);
  });
});

