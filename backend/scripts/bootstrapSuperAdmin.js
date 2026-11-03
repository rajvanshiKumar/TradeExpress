import 'dotenv/config';
import { pathToFileURL } from 'url';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { validatePassword } from '../src/utils/passwordValidator.js';

const prisma = new PrismaClient();

// The password this script used to force on every start. It is public (it was in the source code), so an
// account that still has it is rotated to SUPER_ADMIN_PASSWORD as soon as that variable is set.
const KNOWN_DEFAULT_PASSWORD = '123456';

/**
 * Ensures a Super Admin exists and the platform settings are seeded.
 *
 * - Never overwrites an existing Super Admin's password, except to replace the old public default.
 * - Creates the Super Admin only when none exists, using SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD.
 * - Never logs passwords.
 */
export async function bootstrapSuperAdmin() {
  const email = (process.env.SUPER_ADMIN_EMAIL || 'krajvanshi244@gmail.com').trim().toLowerCase();
  const newPassword = process.env.SUPER_ADMIN_PASSWORD || '';
  const passwordCheck = newPassword ? validatePassword(newPassword) : { isValid: false };
  if (newPassword && !passwordCheck.isValid) {
    console.warn(`[Super Admin] SUPER_ADMIN_PASSWORD does not meet the password policy (${passwordCheck.message}). It was not applied.`);
  }

  let user = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' }, orderBy: { createdAt: 'asc' } });
  let auditNote = null;

  if (!user) {
    if (!passwordCheck.isValid) {
      console.warn('[Super Admin] No Super Admin exists. Set SUPER_ADMIN_EMAIL and a strong SUPER_ADMIN_PASSWORD in backend/.env, then restart.');
    } else {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: await bcrypt.hash(newPassword, 10),
          name: 'Super Admin',
          role: 'SUPER_ADMIN',
          adminRole: 'SUPER_ADMIN',
          isActive: true,
          status: 'ACTIVE',
          company: 'TradeExpress',
        },
      });
      auditNote = 'Super Admin created from SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD';
    }
  } else if (await bcrypt.compare(KNOWN_DEFAULT_PASSWORD, user.passwordHash)) {
    if (passwordCheck.isValid) {
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
      auditNote = 'Super Admin password changed from the public default to SUPER_ADMIN_PASSWORD';
      console.log('[Super Admin] Default password replaced with SUPER_ADMIN_PASSWORD. You can now remove SUPER_ADMIN_PASSWORD from backend/.env.');
    } else {
      console.warn('[Super Admin] WARNING: the Super Admin still uses the public default password. Set a strong SUPER_ADMIN_PASSWORD in backend/.env and restart.');
    }
  }

  // Seed default platform settings if empty (existing values are never changed)
  const defaultSettings = [
    { key: 'platform_name', value: 'TradeExpress', category: 'general', description: 'Platform display name' },
    { key: 'maintenance_mode', value: 'false', category: 'general', description: 'System-wide maintenance mode switch' },
    { key: 'announcement_banner', value: 'Welcome to TradeExpress Super Admin Enterprise Portal', category: 'announcements', description: 'Global header alert banner text' },
    { key: 'announcement_active', value: 'true', category: 'announcements', description: 'Whether the global announcement banner is shown' },
    { key: 'default_commission_rate', value: '2.5', category: 'finance', description: 'Default marketplace platform commission percentage' },
    { key: 'escrow_hold_days', value: '7', category: 'finance', description: 'Days to hold escrow payments before supplier release' },
    { key: 'kyc_auto_approval', value: 'false', category: 'compliance', description: 'Automatic KYC verification trigger' },
    { key: 'rfq_require_approval', value: 'false', category: 'operations', description: 'Whether RFQs must be vetted before broadcasting to suppliers' },
    { key: 'dispute_auto_escalate_hours', value: '48', category: 'disputes', description: 'Hours before an unresolved dispute escalates to Super Admin' },
  ];
  for (const s of defaultSettings) {
    await prisma.platformSetting.upsert({
      where: { key: s.key },
      update: {},
      create: { key: s.key, value: s.value, category: s.category, description: s.description, updatedBy: user?.email || 'system' },
    });
  }

  if (user && auditNote) {
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        actorRole: 'SUPER_ADMIN',
        action: 'BOOTSTRAP',
        resource: 'SYSTEM',
        targetId: user.id,
        details: { note: auditNote },
        result: 'SUCCESS',
      },
    });
  }

  if (user) console.log('Super Admin ready:', { id: user.id, email: user.email });
}

// Run directly with `node scripts/bootstrapSuperAdmin.js`; when imported by the server, the server calls it
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  bootstrapSuperAdmin()
    .catch((err) => {
      console.error('Error bootstrapping Super Admin:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
