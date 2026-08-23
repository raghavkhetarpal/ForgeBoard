import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../index';
import prisma from '../../infrastructure/prisma';
import { createSession } from '../../infrastructure/session';
import { randomUUID } from 'crypto';
import { notificationsService } from './notifications.service';

describe('Notifications Module Integration Tests', () => {
  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let userBId: string;

  beforeAll(async () => {
    const userA = await prisma.user.create({
      data: { email: `usera-${randomUUID()}@example.com`, name: 'User A', passwordHash: 'hash' }
    });
    userAId = userA.id;
    userAToken = (await createSession(userA.id, userA.email)).sessionId;

    const userB = await prisma.user.create({
      data: { email: `userb-${randomUUID()}@example.com`, name: 'User B', passwordHash: 'hash' }
    });
    userBId = userB.id;
    userBToken = (await createSession(userB.id, userB.email)).sessionId;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userAId } });
    await prisma.user.delete({ where: { id: userBId } });
  });

  it('notifications E2E flow', async () => {
    // 1. Create two notifications for user A via internal service
    const n1 = await notificationsService.createNotification(userAId, 'MENTION', 'COMMENT', 'c1', 'You were mentioned');
    const n2 = await notificationsService.createNotification(userAId, 'ASSIGNMENT', 'ISSUE', 'i1', 'You were assigned');

    // 2. User A lists notifications, sees both unread
    const getRes = await request(app).get('/api/notifications').set('Authorization', `Bearer ${userAToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.notifications.length).toBe(2);
    expect(getRes.body.notifications[0].read).toBe(false);
    expect(getRes.body.notifications[1].read).toBe(false);
    
    // OUTPUT FOR VERIFICATION
    console.log('--- NOTIFICATIONS ---');
    console.log(JSON.stringify(getRes.body.notifications, null, 2));
    console.log('---------------------');

    // 3. User A marks one read
    const markRes = await request(app).patch(`/api/notifications/${n1.id}/read`).set('Authorization', `Bearer ${userAToken}`);
    expect(markRes.status).toBe(200);
    expect(markRes.body.notification.read).toBe(true);

    // 4. List reflects one read, one unread
    const getRes2 = await request(app).get('/api/notifications').set('Authorization', `Bearer ${userAToken}`);
    expect(getRes2.body.notifications.find((n: { id: string, read: boolean }) => n.id === n1.id).read).toBe(true);
    expect(getRes2.body.notifications.find((n: { id: string, read: boolean }) => n.id === n2.id).read).toBe(false);

    // 5. User B cannot see or mark user A's notifications
    const getResB = await request(app).get('/api/notifications').set('Authorization', `Bearer ${userBToken}`);
    expect(getResB.body.notifications.length).toBe(0);

    const markResB = await request(app).patch(`/api/notifications/${n2.id}/read`).set('Authorization', `Bearer ${userBToken}`);
    expect(markResB.status).toBe(404);
  });
});
