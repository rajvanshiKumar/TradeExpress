import prisma from '../config/db.js';

/**
 * Log an administrative action to the immutable AuditLog table.
 */
export async function logAuditAction({
  req,
  actorId,
  actorEmail,
  actorRole = 'SUPER_ADMIN',
  action,
  resource,
  targetId,
  details = {},
  result = 'SUCCESS',
}) {
  try {
    const ipAddress =
      req?.headers?.['x-forwarded-for']?.split(',')?.[0]?.trim() ||
      req?.socket?.remoteAddress ||
      req?.ip ||
      '127.0.0.1';

    const userAgent = req?.headers?.['user-agent'] || 'TradeExpress-Client';

    const finalActorId = actorId || req?.user?.id;
    const finalActorEmail = actorEmail || req?.user?.email || 'system';
    const finalActorRole = actorRole || req?.user?.role || 'SUPER_ADMIN';

    return await prisma.auditLog.create({
      data: {
        actorId: finalActorId,
        actorEmail: finalActorEmail,
        actorRole: finalActorRole,
        action,
        resource,
        targetId: targetId ? String(targetId) : null,
        details: typeof details === 'object' ? details : { raw: details },
        ipAddress: String(ipAddress),
        userAgent: String(userAgent).substring(0, 500),
        result,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
    // Non-blocking for primary transaction, but logged to stderr
    return null;
  }
}

/**
 * Query audit logs with pagination and filters
 */
export async function getAuditLogs({
  page = 1,
  limit = 25,
  resource,
  action,
  actorEmail,
  search,
  startDate,
  endDate,
}) {
  const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, Math.max(1, parseInt(limit, 10)));
  const take = Math.min(100, Math.max(1, parseInt(limit, 10)));

  const where = {};

  if (resource && resource !== 'ALL') {
    where.resource = resource;
  }
  if (action && action !== 'ALL') {
    where.action = action;
  }
  if (actorEmail) {
    where.actorEmail = { contains: actorEmail.toLowerCase() };
  }
  if (search) {
    where.OR = [
      { actorEmail: { contains: search } },
      { action: { contains: search } },
      { resource: { contains: search } },
      { targetId: { contains: search } },
    ];
  }
  const parseValidDate = (val) => {
    if (!val || val === 'undefined' || val === 'null' || typeof val !== 'string') return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };
  const parsedStart = parseValidDate(startDate);
  const parsedEnd = parseValidDate(endDate);
  if (parsedStart || parsedEnd) {
    where.createdAt = {};
    if (parsedStart) where.createdAt.gte = parsedStart;
    if (parsedEnd) {
      parsedEnd.setHours(23, 59, 59, 999);
      where.createdAt.lte = parsedEnd;
    }
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    }),
  ]);

  return {
    logs,
    pagination: {
      page: parseInt(page, 10),
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  };
}
