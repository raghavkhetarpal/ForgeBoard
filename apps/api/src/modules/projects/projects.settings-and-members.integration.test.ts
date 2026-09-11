import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../index';
import prisma from '../../infrastructure/prisma';
import { createSession } from '../../infrastructure/session';
import { randomUUID } from 'crypto';

describe('Project Settings, Role Management & Team Administration Integration Tests', () => {
  let ownerToken: string;
  let ownerId: string;
  let adminToken: string;
  let adminId: string;
  let memberToken: string;
  let memberId: string;
  let outsiderToken: string;
  let outsiderId: string;
  let workspaceId: string;
  let projectId: string;

  beforeAll(async () => {
    // 1. Create test users
    const owner = await prisma.user.create({
      data: { email: `owner-${randomUUID()}@example.com`, name: 'Workspace Owner', passwordHash: 'hash' },
    });
    ownerId = owner.id;
    ownerToken = (await createSession(owner.id, owner.email)).sessionId;

    const admin = await prisma.user.create({
      data: { email: `admin-${randomUUID()}@example.com`, name: 'Workspace Admin', passwordHash: 'hash' },
    });
    adminId = admin.id;
    adminToken = (await createSession(admin.id, admin.email)).sessionId;

    const member = await prisma.user.create({
      data: { email: `member-${randomUUID()}@example.com`, name: 'Workspace Member', passwordHash: 'hash' },
    });
    memberId = member.id;
    memberToken = (await createSession(member.id, member.email)).sessionId;

    const outsider = await prisma.user.create({
      data: { email: `outsider-${randomUUID()}@example.com`, name: 'Outsider', passwordHash: 'hash' },
    });
    outsiderId = outsider.id;
    outsiderToken = (await createSession(outsider.id, outsider.email)).sessionId;

    // 2. Create Workspace
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Admin Test WS', slug: `ws-admin-${randomUUID()}` });
    workspaceId = wsRes.body.data.workspace.id;

    // 3. Add admin and member to workspace
    await prisma.workspaceMember.createMany({
      data: [
        { workspaceId, userId: adminId, role: 'ADMIN' },
        { workspaceId, userId: memberId, role: 'MEMBER' },
      ],
    });

    // 4. Create Project by owner
    const projRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Admin Test Project', description: 'Initial description', status: 'ACTIVE' });
    projectId = projRes.body.project.id;
  });

  afterAll(async () => {
    if (workspaceId) {
      await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
    }
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, adminId, memberId, outsiderId].filter(Boolean) } },
    }).catch(() => {});
  });

  describe('Workspace Settings & Member Administration', () => {
    it('allows workspace ADMIN or OWNER to update workspace name', async () => {
      const res = await request(app)
        .patch(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Workspace Name' });

      expect(res.status).toBe(200);
      expect(res.body.data.workspace.name).toBe('Updated Workspace Name');
    });

    it('rejects workspace name update by regular MEMBER (403)', async () => {
      const res = await request(app)
        .patch(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Hacked Workspace Name' });

      expect(res.status).toBe(403);
    });

    it('prevents demoting the last workspace OWNER (400)', async () => {
      const ownerMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: ownerId } },
      });

      const res = await request(app)
        .patch(`/api/workspaces/${workspaceId}/members/${ownerMember!.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: 'ADMIN' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Cannot downgrade the only workspace owner');
    });

    it('allows OWNER to promote MEMBER to ADMIN', async () => {
      const targetMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: memberId } },
      });

      const res = await request(app)
        .patch(`/api/workspaces/${workspaceId}/members/${targetMember!.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: 'ADMIN' });

      expect(res.status).toBe(200);
      expect(res.body.data.member.role).toBe('ADMIN');

      // Revert back to MEMBER
      await prisma.workspaceMember.update({
        where: { id: targetMember!.id },
        data: { role: 'MEMBER' },
      });
    });
  });

  describe('Project Members & Role Management', () => {
    it('lists project members with user profiles', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.members)).toBe(true);
      expect(res.body.members.length).toBeGreaterThanOrEqual(1);
      const first = res.body.members[0];
      expect(first.user).toBeDefined();
      expect(first.user.name).toBe('Workspace Owner');
    });

    it('rejects adding a non-existent user to a project (404)', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ userId: 'c000000000000000000000000', role: 'MEMBER' });

      expect(res.status).toBe(404);
    });

    it('allows adding a user to the project and automatically provisions workspace membership', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ userId: outsiderId, role: 'VIEWER' });

      expect(res.status).toBe(201);
      expect(res.body.member.role).toBe('VIEWER');
      expect(res.body.member.userId).toBe(outsiderId);

      // Verify workspace membership was provisioned
      const wsCheck = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: outsiderId } },
      });
      expect(wsCheck).not.toBeNull();
    });

    it('allows updating project member role', async () => {
      const res = await request(app)
        .patch(`/api/projects/${projectId}/members/${outsiderId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: 'MEMBER' });

      expect(res.status).toBe(200);
      expect(res.body.member.role).toBe('MEMBER');
    });

    it('removes a member from the project', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}/members/${outsiderId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(204);

      const check = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: outsiderId } },
      });
      expect(check).toBeNull();
    });
  });

  describe('Project Settings, Archival & Permanent Deletion', () => {
    it('updates project metadata (name, description, status, deadline)', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const res = await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Renamed Project',
          description: 'New Description',
          status: 'ON_HOLD',
          deadline: futureDate,
        });

      expect(res.status).toBe(200);
      expect(res.body.project.name).toBe('Renamed Project');
      expect(res.body.project.status).toBe('ON_HOLD');
    });

    it('archives and unarchives a project', async () => {
      // Archive
      const archiveRes = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body.project.status).toBe('ARCHIVED');

      // Unarchive
      const unarchiveRes = await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'ACTIVE' });

      expect(unarchiveRes.status).toBe(200);
      expect(unarchiveRes.body.project.status).toBe('ACTIVE');
    });

    it('permanently deletes a project', async () => {
      const delRes = await request(app)
        .delete(`/api/projects/${projectId}/permanent`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      const check = await prisma.project.findUnique({ where: { id: projectId } });
      expect(check).toBeNull();
    });
  });

  describe('Workspace Deletion', () => {
    it('rejects workspace deletion by non-owner (403)', async () => {
      const res = await request(app)
        .delete(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });

    it('allows workspace OWNER to delete workspace', async () => {
      const res = await request(app)
        .delete(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);

      const check = await prisma.workspace.findUnique({ where: { id: workspaceId } });
      expect(check).toBeNull();
      workspaceId = '';
    });
  });
});
