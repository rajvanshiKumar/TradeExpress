import * as notificationService from '../services/notificationService.js';

export async function getNotifications(req, res, next) {
  try {
    const userId = req.user?.id || req.query.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required.' });
    }

    const { limit, unreadOnly } = req.query;
    const result = await notificationService.getUserNotifications(userId, {
      limit,
      unreadOnly: unreadOnly === 'true',
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function createNotification(req, res, next) {
  try {
    const { userId, title, message, type, link } = req.body;
    const targetUserId = userId || req.user?.id;

    if (!targetUserId || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'userId, title, and message are required.',
      });
    }

    const notification = await notificationService.createNotification({
      userId: targetUserId,
      title,
      message,
      type: type || 'INFO',
      link,
    });

    res.status(201).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
}

export async function markAsRead(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.body.userId;

    const updated = await notificationService.markNotificationAsRead(id, userId);
    res.json({
      success: true,
      message: 'Notification marked as read.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function markAllAsRead(req, res, next) {
  try {
    const userId = req.user?.id || req.body.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required.' });
    }

    await notificationService.markAllNotificationsAsRead(userId);
    res.json({
      success: true,
      message: 'All notifications marked as read.',
    });
  } catch (error) {
    next(error);
  }
}
