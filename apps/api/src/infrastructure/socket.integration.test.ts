import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { httpServer } from '../index';
import { io as Client } from 'socket.io-client';
import prisma from './prisma';
import { createSession } from './session';
import { randomUUID } from 'crypto';
import { getSocketServer } from './socket';

describe('Socket.IO Connection and Room Authorization', () => {
  let memberToken: string;
  let nonMemberToken: string;
  let adminToken: string;
  let projectId: string;
  let workspaceId: string;
  let memberId: string;
  let nonMemberId: string;
  let adminId: string;
  let port: number;

  beforeAll(async () => {
    const member = await prisma.user.create({
      data: { email: `member-${randomUUID()}@example.com`, name: 'Member', passwordHash: 'hash' }
    });
    memberId = member.id;
    memberToken = (await createSession(member.id, member.email)).sessionId;

    const nonMember = await prisma.user.create({
      data: { email: `nonmember-${randomUUID()}@example.com`, name: 'Non Member', passwordHash: 'hash' }
    });
    nonMemberId = nonMember.id;
    nonMemberToken = (await createSession(nonMember.id, nonMember.email)).sessionId;

    const admin = await prisma.user.create({
      data: { email: `admin-${randomUUID()}@example.com`, name: 'Admin', passwordHash: 'hash' }
    });
    adminId = admin.id;
    adminToken = (await createSession(admin.id, admin.email)).sessionId;

    const ws = await prisma.workspace.create({
      data: {
        name: 'Socket Workspace',
        slug: `ws-socket-${randomUUID()}`,
        members: { create: [{ userId: member.id, role: 'MEMBER' }, { userId: admin.id, role: 'ADMIN' }] }
      }
    });
    workspaceId = ws.id;

    const p = await prisma.project.create({
      data: { workspaceId, name: 'Socket Project' }
    });
    projectId = p.id;
    
    await prisma.projectMember.create({
      data: { projectId, workspaceId, userId: member.id, role: 'VIEWER' }
    });

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
    await prisma.user.delete({ where: { id: memberId } });
    await prisma.user.delete({ where: { id: nonMemberId } });
    await prisma.user.delete({ where: { id: adminId } });
  });

  it('rejects connection without valid session', () => {
    return new Promise<void>((resolve) => {
      const clientSocket = Client(`http://localhost:${port}`, {
        auth: { token: 'invalid-token' },
        transports: ['websocket'],
      });

      clientSocket.on('connect_error', (err) => {
        expect(err.message).toBe('Session has expired or is invalid.');
        clientSocket.close();
        resolve();
      });
    });
  });

  it('connects with valid session and succeeds join:project if authorized', () => {
    return new Promise<void>((resolve) => {
      const clientSocket = Client(`http://localhost:${port}`, {
        auth: { token: memberToken },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('join:project', { projectId }, (res: { success?: boolean; error?: string; room?: string }) => {
          expect(res.success).toBe(true);
          expect(res.room).toBe(`project:${projectId}`);
          clientSocket.close();
          resolve();
        });
      });
    });
  });

  it('connects with valid session but rejects join:project if not authorized, verifying server room state', () => {
    return new Promise<void>((resolve) => {
      const clientSocket = Client(`http://localhost:${port}`, {
        auth: { token: nonMemberToken },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        // Find the server-side socket instance
        const serverSocket = Array.from(getSocketServer().sockets.sockets.values()).find(s => s.data.user.id === nonMemberId);
        
        clientSocket.emit('join:project', { projectId }, (res: { success?: boolean; error?: string; room?: string }) => {
          expect(res.error).toBe('Forbidden');
          
          // Output for verification
          console.log('--- REJECTED JOIN ATTEMPT ---');
          console.log('Client Received Error:', res.error);
          console.log('Server Socket Rooms (should only contain socket ID, not project ID):', Array.from(serverSocket!.rooms));
          console.log('-----------------------------');

          // Assert strictly via server state
          expect(serverSocket!.rooms.has(`project:${projectId}`)).toBe(false);

          clientSocket.close();
          resolve();
        });
      });
    });
  });

  it('rejects join:project for workspace ADMIN who is not an explicit project member', () => {
    return new Promise<void>((resolve) => {
      const clientSocket = Client(`http://localhost:${port}`, {
        auth: { token: adminToken },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        const serverSocket = Array.from(getSocketServer().sockets.sockets.values()).find(s => s.data.user.id === adminId);
        
        clientSocket.emit('join:project', { projectId }, (res: { success?: boolean; error?: string; room?: string }) => {
          expect(res.error).toBe('Forbidden');
          expect(serverSocket!.rooms.has(`project:${projectId}`)).toBe(false);

          clientSocket.close();
          resolve();
        });
      });
    });
  });
});
