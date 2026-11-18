import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../../src/config/db.js';
import { getUserNotifications, markNotificationAsUnread } from '../../src/services/notificationService.js';

// All database access goes through this stub; nothing reaches a real database.
let stub;
prisma.$use(async (params) => (stub ? stub(params) : null));

describe('Notifications: mark as unread and list limits', () => {
  it('marks only the user’s own notification as unread', async (t) => {
    const calls = [];
    stub = async (q) => {
      calls.push(q);
      if (q.action === 'findFirst') return q.args.where.userId === 'sup-1' ? { id: 'n-1', userId: 'sup-1', read: true } : null;
      if (q.action === 'update') return { id: 'n-1', read: q.args.data.read };
      return null;
    };
    t.after(() => { stub = null; });
    const updated = await markNotificationAsUnread('n-1', 'sup-1');
    assert.equal(updated.read, false);
    await assert.rejects(markNotificationAsUnread('n-1', 'other-user'), (e) => e.statusCode === 404);
    assert.equal(calls.filter((q) => q.action === 'update').length, 1, 'another user cannot change it');
  });

  it('caps the page size at 100 and returns the total count', async (t) => {
    let take;
    stub = async (q) => {
      if (q.action === 'findMany') { take = q.args.take; return []; }
      if (q.action === 'count') return q.args.where.read === false ? 3 : 140;
      return null;
    };
    t.after(() => { stub = null; });
    const result = await getUserNotifications('sup-1', { limit: '5000' });
    assert.equal(take, 100);
    assert.equal(result.unreadCount, 3);
    assert.equal(result.totalCount, 140);
  });
});
