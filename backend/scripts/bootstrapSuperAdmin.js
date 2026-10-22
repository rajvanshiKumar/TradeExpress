import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function bootstrapSuperAdmin() {
  const hash = await bcrypt.hash('super-raj@12345', 10);
  const user = await prisma.user.upsert({
    where: { email: 'krajvanshi244@gmail.com' },
    update: {
      name: 'Rajvanshi Kumar (Super Admin)',
      role: 'SUPER_ADMIN',
      adminRole: 'SUPER_ADMIN',
      isActive: true,
      status: 'ACTIVE',
      passwordHash: hash,
      company: 'TradeExpress Global HQ',
    },
    create: {
      email: 'krajvanshi244@gmail.com',
      passwordHash: hash,
      name: 'Rajvanshi Kumar (Super Admin)',
      role: 'SUPER_ADMIN',
      adminRole: 'SUPER_ADMIN',
      isActive: true,
      status: 'ACTIVE',
      phone: '9608888888',
      isPhoneVerified: true,
      company: 'TradeExpress Global HQ',
    },
  });

  // Seed default platform settings if empty
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
      create: {
        key: s.key,
        value: s.value,
        category: s.category,
        description: s.description,
        updatedBy: user.email,
      },
    });
  }

  // Record initial bootstrap audit log
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorEmail: user.email,
      actorRole: 'SUPER_ADMIN',
      action: 'BOOTSTRAP',
      resource: 'SYSTEM',
      targetId: user.id,
      details: { note: 'Super Admin initialized successfully with full platform control' },
      result: 'SUCCESS',
    },
  });

  console.log('Successfully bootstrapped Super Admin:', {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
  });
}

bootstrapSuperAdmin()
  .catch((err) => {
    console.error('Error bootstrapping Super Admin:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
