import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAdminDeletionReason } from '../../src/services/accountDeletionService.js';

test('Super Admin deletion reason', async (t) => {
  await t.test('a listed reason is used as is', () => {
    assert.equal(resolveAdminDeletionReason('DUPLICATE_ACCOUNT'), 'Duplicate account');
  });

  await t.test('"Other" uses the reason the Super Admin wrote', () => {
    assert.equal(resolveAdminDeletionReason('OTHER', '  Business   closed permanently '), 'Other: Business closed permanently');
  });

  await t.test('"Other" needs a written reason of 5 to 200 characters', () => {
    for (const text of [undefined, '', '   ', 'abc']) {
      assert.throws(() => resolveAdminDeletionReason('OTHER', text), (e) => e.errorCode === 'OTHER_REASON_REQUIRED' && e.statusCode === 400);
    }
    assert.throws(() => resolveAdminDeletionReason('OTHER', 'x'.repeat(201)), (e) => e.errorCode === 'OTHER_REASON_TOO_LONG');
  });

  await t.test('an unknown or missing reason is refused', () => {
    for (const reason of [undefined, '', 'SOMETHING']) {
      assert.throws(() => resolveAdminDeletionReason(reason, 'some text'), (e) => e.errorCode === 'REASON_REQUIRED');
    }
  });
});
