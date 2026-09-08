import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app, { httpServer } from '../index';
import { io as Client } from 'socket.io-client';
import prisma from './prisma';
import { createSession } from './session';
import { randomUUID } from 'crypto';
import { getSocketServer } from './socket';

describe('Socket.IO Real-Time Events', () => {
  let actorToken: string;
  let listenerToken: string;
  let projectId: string;
  let workspaceId: string;
  let actorId: string;
  let listenerId: string;
  let issueId: string;
  let port: number;

  beforeAll(async () => {
    // Setup test users
    const actor = await prisma.user.create({
      data: { email: `actor-${randomUUID()}@example.com`, name: 'Actor', passwordHash: 'hash' }
    });
    actorId = actor.id;
    actorToken = (await createSession(actor.id, actor.email)).sessionId;

    const listener = await prisma.user.create({
      data: { email: `listener-${randomUUID()}@example.com`, name: 'Listener', passwordHash: 'hash' }
    });
    listenerId = listener.id;
    listenerToken = (await createSession(listener.id, listener.email)).sessionId;

    // Setup workspace and project
    const ws = await prisma.workspace.create({
      data: {
        name: 'Events Workspace',
        slug: `ws-events-${randomUUID()}`,
        members: { create: [{ userId: actor.id, role: 'OWNER' }, { userId: listener.id, role: 'MEMBER' }] }
      }
    });
    workspaceId = ws.id;

    const p = await prisma.project.create({
      data: { workspaceId, name: 'Events Project' }
    });
    projectId = p.id;
    
    // Add listener explicitly to project so they can join socket room
    await prisma.projectMember.create({
      data: { projectId, workspaceId, userId: listener.id, role: 'MEMBER' }
    });

    // Create an issue to interact with
    const issue = await prisma.issue.create({
      data: { projectId, workspaceId, title: 'Event Issue', creatorId: actor.id, status: 'TODO', position: 1024 }
    });
    issueId = issue.id;

    // Start HTTP server on a random port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as { port: number }).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    httpServer.close();
    getSocketServer().close();
    await prisma.workspace.delete({ where: { id: workspaceId } });
    await prisma.user.delete({ where: { id: actorId } });
    await prisma.user.delete({ where: { id: listenerId } });
  });

  it('broadcasts issue:updated when moving an issue', () => {
    return new Promise<void>((resolve, reject) => {
      const listenerSocket = Client(`http://localhost:${port}`, {
        auth: { token: listenerToken },
        transports: ['websocket'],
      });

      listenerSocket.on('connect', () => {
        listenerSocket.emit('join:project', { projectId }, async (res: { success?: boolean }) => {
          if (!res.success) return reject(new Error('Failed to join room'));

          // Listen for the event
          listenerSocket.on('issue:updated', (payload) => {
            try {
              expect(payload.issue).toBeDefined();
              expect(payload.issue.id).toBe(issueId);
              expect(payload.issue.status).toBe('IN_PROGRESS');
              
              console.log('--- RECEIVED EVENT: issue:updated ---');
              console.log(JSON.stringify(payload, null, 2));
              console.log('-------------------------------------');
              
              listenerSocket.close();
              resolve();
            } catch (e) {
              reject(e);
            }
          });

          // Trigger the REST API as the actor
          const response = await request(app)
            .patch(`/api/projects/${projectId}/issues/${issueId}/move`)
            .set('Authorization', `Bearer ${actorToken}`)
            .send({ status: 'IN_PROGRESS', position: 0 });
            
          if (response.status !== 200) {
            reject(new Error(`API failed: ${response.body.error?.message}`));
          }
        });
      });
    });
  });

  it('broadcasts comment:created when creating a comment', () => {
    return new Promise<void>((resolve, reject) => {
      const listenerSocket = Client(`http://localhost:${port}`, {
        auth: { token: listenerToken },
        transports: ['websocket'],
      });

      listenerSocket.on('connect', () => {
        listenerSocket.emit('join:project', { projectId }, async (res: { success?: boolean }) => {
          if (!res.success) return reject(new Error('Failed to join room'));

          listenerSocket.on('comment:created', (payload) => {
            try {
              expect(payload.comment).toBeDefined();
              expect(payload.comment.issueId).toBe(issueId);
              expect(payload.comment.content).toBe('Real-time comment test');
              
              console.log('--- RECEIVED EVENT: comment:created ---');
              console.log(JSON.stringify(payload, null, 2));
              console.log('---------------------------------------');
              
              listenerSocket.close();
              resolve();
            } catch (e) {
              reject(e);
            }
          });

          const response = await request(app)
            .post(`/api/projects/${projectId}/issues/${issueId}/comments`)
            .set('Authorization', `Bearer ${actorToken}`)
            .send({ content: 'Real-time comment test' });
            
          if (response.status !== 201) {
            reject(new Error(`API failed: ${response.body.error?.message}`));
          }
        });
      });
    });
  });

  it('broadcasts notification:created to personal room', () => {
    return new Promise<void>((resolve, reject) => {
      const listenerSocket = Client(`http://localhost:${port}`, {
        auth: { token: listenerToken },
        transports: ['websocket'],
      });

      // We need to wait for connection so it joins the user room
      listenerSocket.on('connect', async () => {
        listenerSocket.on('notification:created', (payload) => {
          try {
            expect(payload.notification).toBeDefined();
            expect(payload.notification.userId).toBe(listenerId);
            expect(payload.notification.type).toBe('MENTION');
            
            console.log('--- RECEIVED EVENT: notification:created ---');
            console.log(JSON.stringify(payload, null, 2));
            console.log('--------------------------------------------');
            
            listenerSocket.close();
            resolve();
          } catch (e) {
            reject(e);
          }
        });

        // Trigger notification creation via a comment mention
        // Listener email is listener-{uuid}@example.com
        const listenerUser = await prisma.user.findUnique({ where: { id: listenerId } });
        const mentionContent = `Hey @${listenerUser!.email} check this out`;

        const response = await request(app)
          .post(`/api/projects/${projectId}/issues/${issueId}/comments`)
          .set('Authorization', `Bearer ${actorToken}`)
          .send({ content: mentionContent });
          
        if (response.status !== 201) {
          reject(new Error(`API failed: ${response.body.error?.message}`));
        }
      });
    });
  });
});
