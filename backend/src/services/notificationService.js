import prisma from '../config/db.js';

/**
 * Create an in-app notification for a user
 */
export async function createNotification({
  userId,
  title,
  message,
  type = 'INFO',
  link = null,
}) {
  if (!userId) {
    console.warn('[NotificationService] Skipped notification with no userId:', title);
    return null;
  }

  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        link,
      },
    });
    return notification;
  } catch (error) {
    console.error('[NotificationService] Error creating notification:', error.message);
    return null;
  }
}

/**
 * List user notifications with unread count
 */
export async function getUserNotifications(userId, { limit = 30, unreadOnly = false } = {}) {
  const where = { userId };
  if (unreadOnly) {
    where.read = false;
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(limit) || 30,
    }),
    prisma.notification.count({
      where: { userId, read: false },
    }),
  ]);

  return {
    notifications,
    unreadCount,
  };
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(id, userId) {
  const notification = await prisma.notification.findFirst({
    where: { id, userId },
  });

  if (!notification) {
    const error = new Error('Notification not found.');
    error.statusCode = 404;
    throw error;
  }

  return prisma.notification.update({
    where: { id },
    data: { read: true },
  });
}

/**
 * Mark all user notifications as read
 */
export async function markAllNotificationsAsRead(userId) {
  return prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

/**
 * Broadcast notification to all users of a specific role (e.g. ADMIN)
 */
export async function notifyUsersByRole(role, { title, message, type = 'SYSTEM', link = null }) {
  try {
    const users = await prisma.user.findMany({
      where: { role },
      select: { id: true },
    });

    if (!users.length) return [];

    const data = users.map((u) => ({
      userId: u.id,
      title,
      message,
      type,
      link,
    }));

    await prisma.notification.createMany({
      data,
    });

    return users.length;
  } catch (err) {
    console.error('[NotificationService] Error in notifyUsersByRole:', err.message);
    return 0;
  }
}
