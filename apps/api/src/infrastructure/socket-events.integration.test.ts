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

  it('broadcasts issue:created when creating an issue', () => {
    return new Promise<void>((resolve, reject) => {
      const listenerSocket = Client(`http://localhost:${port}`, {
        auth: { token: listenerToken },
        transports: ['websocket'],
      });

      listenerSocket.on('connect', () => {
        listenerSocket.emit('join:project', { projectId }, async (res: { success?: boolean }) => {
          if (!res.success) return reject(new Error('Failed to join room'));

          listenerSocket.on('issue:created', (payload) => {
            try {
              expect(payload.issue).toBeDefined();
              expect(payload.issue.title).toBe('New Real-Time Issue');
              expect(payload.issue.projectId).toBe(projectId);
              listenerSocket.close();
              resolve();
            } catch (e) {
              reject(e);
            }
          });

          const response = await request(app)
            .post(`/api/projects/${projectId}/issues`)
            .set('Authorization', `Bearer ${actorToken}`)
            .send({ title: 'New Real-Time Issue', status: 'TODO', priority: 'HIGH' });

          if (response.status !== 201) {
            reject(new Error(`API failed: ${response.body.error?.message}`));
          }
        });
      });
    });
  });

  it('broadcasts issue:updated when updating an issue via PATCH', () => {
    return new Promise<void>((resolve, reject) => {
      const listenerSocket = Client(`http://localhost:${port}`, {
        auth: { token: listenerToken },
        transports: ['websocket'],
      });

      listenerSocket.on('connect', () => {
        listenerSocket.emit('join:project', { projectId }, async (res: { success?: boolean }) => {
          if (!res.success) return reject(new Error('Failed to join room'));

          listenerSocket.on('issue:updated', (payload) => {
            try {
              expect(payload.issue).toBeDefined();
              expect(payload.issue.id).toBe(issueId);
              expect(payload.issue.title).toBe('Updated Title Live');
              listenerSocket.close();
              resolve();
            } catch (e) {
              reject(e);
            }
          });

          const response = await request(app)
            .patch(`/api/projects/${projectId}/issues/${issueId}`)
            .set('Authorization', `Bearer ${actorToken}`)
            .send({ title: 'Updated Title Live' });

          if (response.status !== 200) {
            reject(new Error(`API failed: ${response.body.error?.message}`));
          }
        });
      });
    });
  });

  it('broadcasts issue:deleted when deleting an issue', () => {
    return new Promise<void>((resolve, reject) => {
      const listenerSocket = Client(`http://localhost:${port}`, {
        auth: { token: listenerToken },
        transports: ['websocket'],
      });

      listenerSocket.on('connect', () => {
        listenerSocket.emit('join:project', { projectId }, async (res: { success?: boolean }) => {
          if (!res.success) return reject(new Error('Failed to join room'));

          // Create a temp issue to delete
          const tempIssue = await prisma.issue.create({
            data: { projectId, workspaceId, title: 'To Delete', creatorId: actorId }
          });

          listenerSocket.on('issue:deleted', (payload) => {
            try {
              expect(payload.issueId).toBe(tempIssue.id);
              expect(payload.projectId).toBe(projectId);
              listenerSocket.close();
              resolve();
            } catch (e) {
              reject(e);
            }
          });

          const response = await request(app)
            .delete(`/api/projects/${projectId}/issues/${tempIssue.id}`)
            .set('Authorization', `Bearer ${actorToken}`);

          if (response.status !== 204) {
            reject(new Error(`API failed: ${response.status}`));
          }
        });
      });
    });
  });

  it('broadcasts comment:updated and comment:deleted when modifying comments', () => {
    return new Promise<void>((resolve, reject) => {
      const listenerSocket = Client(`http://localhost:${port}`, {
        auth: { token: listenerToken },
        transports: ['websocket'],
      });

      listenerSocket.on('connect', () => {
        listenerSocket.emit('join:project', { projectId }, async (res: { success?: boolean }) => {
          if (!res.success) return reject(new Error('Failed to join room'));

          // Create a comment first
          const createRes = await request(app)
            .post(`/api/projects/${projectId}/issues/${issueId}/comments`)
            .set('Authorization', `Bearer ${actorToken}`)
            .send({ content: 'Initial comment' });

          const createdCommentId = createRes.body.comment.id;

          listenerSocket.on('comment:updated', (payload) => {
            try {
              expect(payload.comment).toBeDefined();
              expect(payload.comment.id).toBe(createdCommentId);
              expect(payload.comment.content).toBe('Edited comment text');

              // Now delete the comment
              listenerSocket.on('comment:deleted', (delPayload) => {
                try {
                  expect(delPayload.commentId).toBe(createdCommentId);
                  expect(delPayload.issueId).toBe(issueId);
                  listenerSocket.close();
                  resolve();
                } catch (delErr) {
                  reject(delErr);
                }
              });

              request(app)
                .delete(`/api/projects/${projectId}/issues/${issueId}/comments/${createdCommentId}`)
                .set('Authorization', `Bearer ${actorToken}`)
                .then((delRes) => {
                  if (delRes.status !== 200) {
                    reject(new Error(`Delete failed: ${delRes.status}`));
                  }
                });
            } catch (e) {
              reject(e);
            }
          });

          // Trigger edit
          const editRes = await request(app)
            .patch(`/api/projects/${projectId}/issues/${issueId}/comments/${createdCommentId}`)
            .set('Authorization', `Bearer ${actorToken}`)
            .send({ content: 'Edited comment text' });

          if (editRes.status !== 200) {
            reject(new Error(`Edit failed: ${editRes.body.error?.message}`));
          }
        });
      });
    });
  });

  it('broadcasts activity:created when activity is logged', () => {
    return new Promise<void>((resolve, reject) => {
      const listenerSocket = Client(`http://localhost:${port}`, {
        auth: { token: listenerToken },
        transports: ['websocket'],
      });

      listenerSocket.on('connect', () => {
        listenerSocket.emit('join:project', { projectId }, async (res: { success?: boolean }) => {
          if (!res.success) return reject(new Error('Failed to join room'));

          listenerSocket.on('activity:created', (payload) => {
            try {
              expect(payload.activity).toBeDefined();
              expect(payload.activity.projectId).toBe(projectId);
              expect(payload.activity.action).toBe('ISSUE_CREATED');
              listenerSocket.close();
              resolve();
            } catch (e) {
              reject(e);
            }
          });

          // Trigger an issue creation which logs activity
          await request(app)
            .post(`/api/projects/${projectId}/issues`)
            .set('Authorization', `Bearer ${actorToken}`)
            .send({ title: 'Activity Trigger Issue', status: 'TODO' });
        });
      });
    });
  });

  it('broadcasts label:created, label:updated, and label:deleted to project room', () => {
    return new Promise<void>((resolve, reject) => {
      const listenerSocket = Client(`http://localhost:${port}`, {
        auth: { token: listenerToken },
        transports: ['websocket'],
      });

      listenerSocket.on('connect', () => {
        listenerSocket.emit('join:project', { projectId }, async (res: { success?: boolean }) => {
          if (!res.success) return reject(new Error('Failed to join room'));

          let createdLabelId = '';

          listenerSocket.on('label:created', (payload) => {
            try {
              expect(payload.label).toBeDefined();
              expect(payload.label.name).toBe('Realtime Bug');
              expect(payload.label.color).toBe('#ef4444');
              createdLabelId = payload.label.id;

              // Setup updated listener
              listenerSocket.on('label:updated', (upPayload) => {
                try {
                  expect(upPayload.label.id).toBe(createdLabelId);
                  expect(upPayload.label.name).toBe('Realtime Critical Bug');

                  // Setup deleted listener
                  listenerSocket.on('label:deleted', (delPayload) => {
                    try {
                      expect(delPayload.labelId).toBe(createdLabelId);
                      expect(delPayload.projectId).toBe(projectId);
                      listenerSocket.close();
                      resolve();
                    } catch (delErr) {
                      reject(delErr);
                    }
                  });

                  // Trigger DELETE label
                  request(app)
                    .delete(`/api/projects/${projectId}/labels/${createdLabelId}`)
                    .set('Authorization', `Bearer ${actorToken}`)
                    .then((delRes) => {
                      if (delRes.status !== 200) reject(new Error('Delete label failed'));
                    });
                } catch (upErr) {
                  reject(upErr);
                }
              });

              // Trigger PATCH label
              request(app)
                .patch(`/api/projects/${projectId}/labels/${createdLabelId}`)
                .set('Authorization', `Bearer ${actorToken}`)
                .send({ name: 'Realtime Critical Bug' })
                .then((upRes) => {
                  if (upRes.status !== 200) reject(new Error('Update label failed'));
                });
            } catch (err) {
              reject(err);
            }
          });

          // Trigger POST label
          const createRes = await request(app)
            .post(`/api/projects/${projectId}/labels`)
            .set('Authorization', `Bearer ${actorToken}`)
            .send({ name: 'Realtime Bug', color: '#ef4444' });

          if (createRes.status !== 201) {
            reject(new Error(`Failed to create label: ${createRes.status}`));
          }
        });
      });
    });
  });

  it('broadcasts issue:updated when attaching and removing labels', () => {
    return new Promise<void>((resolve, reject) => {
      const listenerSocket = Client(`http://localhost:${port}`, {
        auth: { token: listenerToken },
        transports: ['websocket'],
      });

      listenerSocket.on('connect', () => {
        listenerSocket.emit('join:project', { projectId }, async (res: { success?: boolean }) => {
          if (!res.success) return reject(new Error('Failed to join room'));

          // Create a label first
          const labelRes = await request(app)
            .post(`/api/projects/${projectId}/labels`)
            .set('Authorization', `Bearer ${actorToken}`)
            .send({ name: 'Label Attach Test', color: '#3b82f6' });
          const testLabelId = labelRes.body.label.id;

          let attached = false;

          listenerSocket.on('issue:updated', (payload) => {
            try {
              if (payload.issue.id === issueId) {
                if (!attached) {
                  expect(payload.issue.labels.some((l: any) => l.id === testLabelId)).toBe(true);
                  attached = true;

                  // Trigger detach
                  request(app)
                    .delete(`/api/projects/${projectId}/issues/${issueId}/labels/${testLabelId}`)
                    .set('Authorization', `Bearer ${actorToken}`)
                    .then((detachRes) => {
                      if (detachRes.status !== 200) reject(new Error('Detach label failed'));
                    });
                } else {
                  // Received update after detach
                  expect(payload.issue.labels.some((l: any) => l.id === testLabelId)).toBe(false);
                  listenerSocket.close();
                  resolve();
                }
              }
            } catch (err) {
              reject(err);
            }
          });

          // Trigger attach
          const attachRes = await request(app)
            .post(`/api/projects/${projectId}/issues/${issueId}/labels`)
            .set('Authorization', `Bearer ${actorToken}`)
            .send({ labelId: testLabelId });

          if (attachRes.status !== 200) {
            reject(new Error(`Attach label failed: ${attachRes.status}`));
          }
        });
      });
    });
  });

  it('broadcasts milestone:created, milestone:updated, and recalculates milestone progress on issue status change', () => {
    return new Promise<void>((resolve, reject) => {
      const listenerSocket = Client(`http://localhost:${port}`, {
        auth: { token: listenerToken },
        transports: ['websocket'],
      });

      listenerSocket.on('connect', () => {
        listenerSocket.emit('join:project', { projectId }, async (res: { success?: boolean }) => {
          if (!res.success) return reject(new Error('Failed to join room'));

          let milestoneId = '';

          listenerSocket.on('milestone:created', (payload) => {
            try {
              expect(payload.milestone.name).toBe('Realtime Sprint 1');
              expect(payload.milestone.progress).toBe(0);
              milestoneId = payload.milestone.id;

              // Once milestone is created, create an issue attached to it
              listenerSocket.on('milestone:updated', (mUpdatePayload) => {
                try {
                  if (mUpdatePayload.milestone.id === milestoneId) {
                    if (mUpdatePayload.milestone.completedIssues === 1) {
                      expect(mUpdatePayload.milestone.progress).toBe(100);
                      listenerSocket.close();
                      resolve();
                    }
                  }
                } catch (err) {
                  reject(err);
                }
              });

              // Create issue assigned to milestone, then move to DONE
              request(app)
                .post(`/api/projects/${projectId}/issues`)
                .set('Authorization', `Bearer ${actorToken}`)
                .send({ title: 'Milestone Task', status: 'TODO', milestoneId })
                .then((issueRes) => {
                  if (issueRes.status !== 201) {
                    return reject(new Error(`Failed to create issue for milestone: ${JSON.stringify(issueRes.body)}`));
                  }
                  const mIssueId = issueRes.body.issue.id;
                  // Move issue to DONE to trigger milestone progress update
                  request(app)
                    .patch(`/api/projects/${projectId}/issues/${mIssueId}/move`)
                    .set('Authorization', `Bearer ${actorToken}`)
                    .send({ status: 'DONE', position: 0 })
                    .then((moveRes) => {
                      if (moveRes.status !== 200) {
                        reject(new Error(`Failed to move issue: ${JSON.stringify(moveRes.body)}`));
                      }
                    })
                    .catch(reject);
                })
                .catch(reject);
            } catch (err) {
              reject(err);
            }
          });

          // Trigger milestone creation
          const mRes = await request(app)
            .post(`/api/projects/${projectId}/milestones`)
            .set('Authorization', `Bearer ${actorToken}`)
            .send({ name: 'Realtime Sprint 1' });

          if (mRes.status !== 201) {
            reject(new Error(`Failed to create milestone: ${mRes.status}`));
          }
        });
      });
    });
  });

  it('enforces multi-tenant project room isolation (client in Project 2 does not receive Project 1 events)', () => {
    return new Promise<void>((resolve, reject) => {
      // Create Project 2 in same workspace and add listener
      prisma.project.create({
        data: { workspaceId, name: 'Project 2 Isolation' }
      }).then(async (p2) => {
        await prisma.projectMember.create({
          data: { projectId: p2.id, workspaceId, userId: listenerId, role: 'MEMBER' }
        });

        const p2Socket = Client(`http://localhost:${port}`, {
          auth: { token: listenerToken },
          transports: ['websocket'],
        });

        p2Socket.on('connect', () => {
          // p2Socket joins Project 2 room ONLY
          p2Socket.emit('join:project', { projectId: p2.id }, async (joinRes: { success?: boolean }) => {
            if (!joinRes.success) return reject(new Error('Failed to join Project 2'));

            let receivedEventForP1 = false;

            p2Socket.on('issue:created', (payload) => {
              if (payload?.issue?.projectId === projectId) {
                receivedEventForP1 = true;
              }
            });

            // Trigger an issue creation in Project 1
            await request(app)
              .post(`/api/projects/${projectId}/issues`)
              .set('Authorization', `Bearer ${actorToken}`)
              .send({ title: 'Isolation Test Issue' });

            // Wait 400ms to verify no leakage
            setTimeout(() => {
              p2Socket.close();
              if (receivedEventForP1) {
                reject(new Error('Cross-project room leakage detected!'));
              } else {
                resolve();
              }
            }, 400);
          });
        });
      }).catch(reject);
    });
  });
});

