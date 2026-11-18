/**
 * One-time: encrypt bank account numbers that are still stored as plaintext.
 *
 *   node scripts/encryptBankAccounts.js           dry run: counts only, changes nothing
 *   node scripts/encryptBankAccounts.js --apply   encrypts (needs DATA_ENCRYPTION_KEY)
 *
 * Safe to run again: already-encrypted values are skipped. Each row is updated only if it still holds the
 * plaintext that was read (no lost concurrent edits). Account numbers are never printed.
 * IMPORTANT: use the same DATA_ENCRYPTION_KEY as every server (local and Render) that reads this database.
 */
import prisma from '../src/config/db.js';
import { decryptField, encryptField, encryptionAvailable, isEncrypted } from '../src/utils/dataCrypto.js';

const apply = process.argv.includes('--apply');

async function main() {
  const rows = await prisma.user.findMany({ where: { bankAccountNumber: { not: null } }, select: { id: true, bankAccountNumber: true } });
  const plaintext = rows.filter((r) => r.bankAccountNumber && !isEncrypted(r.bankAccountNumber));
  console.log(`Users with a bank account number: ${rows.length}`);
  console.log(`Already encrypted: ${rows.length - plaintext.length}`);
  console.log(`Plaintext to encrypt: ${plaintext.length}`);

  if (!apply) {
    console.log('Dry run only. Re-run with --apply to encrypt.');
    return;
  }
  if (!encryptionAvailable()) throw new Error('DATA_ENCRYPTION_KEY is not set (or not 32 bytes). Nothing was changed.');

  let done = 0;
  for (const row of plaintext) {
    const enc = encryptField(row.bankAccountNumber);
    if (decryptField(enc) !== row.bankAccountNumber) throw new Error(`Round-trip check failed for user ${row.id}. Stopped; nothing else changed.`);
    const { count } = await prisma.user.updateMany({ where: { id: row.id, bankAccountNumber: row.bankAccountNumber }, data: { bankAccountNumber: enc } });
    done += count;
  }
  console.log(`Encrypted: ${done} of ${plaintext.length}`);
}

main()
  .catch((err) => { console.error(err.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
