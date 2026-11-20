/**
 * One-time: turn encrypted values back into readable text in the database
 * (Aadhaar OTP provider responses and bank account numbers).
 *
 *   node scripts/decryptSensitiveFields.js           dry run: counts only, changes nothing
 *   node scripts/decryptSensitiveFields.js --apply   decrypts (needs the same DATA_ENCRYPTION_KEY that encrypted them)
 *
 * Safe to run again: values that are already plain text are skipped. Each row is updated only if it still holds the
 * encrypted value that was read (no lost concurrent edits). Values are never printed.
 */
import prisma from '../src/config/db.js';
import { decryptField, isEncrypted } from '../src/utils/dataCrypto.js';

const apply = process.argv.includes('--apply');

const TARGETS = [
  { label: 'Aadhaar OTP responses', model: prisma.aadhaarVerification, field: 'responseData' },
  { label: 'Bank account numbers', model: prisma.user, field: 'bankAccountNumber' },
];

async function main() {
  for (const { label, model, field } of TARGETS) {
    const rows = await model.findMany({ where: { [field]: { startsWith: 'enc:v1:' } }, select: { id: true, [field]: true } });
    const encrypted = rows.filter((r) => isEncrypted(r[field]));
    console.log(`${label}: ${encrypted.length} encrypted`);
    if (!apply || !encrypted.length) continue;

    let done = 0;
    for (const row of encrypted) {
      const plain = decryptField(row[field]); // throws (and stops) if the key is missing or wrong
      const { count } = await model.updateMany({ where: { id: row.id, [field]: row[field] }, data: { [field]: plain } });
      done += count;
    }
    console.log(`${label}: decrypted ${done} of ${encrypted.length}`);
  }
  if (!apply) console.log('Dry run only. Re-run with --apply to decrypt.');
}

main()
  .catch((err) => { console.error(err.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
