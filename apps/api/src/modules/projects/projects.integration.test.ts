import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../index';
import prisma from '../../infrastructure/prisma';
import { createSession } from '../../infrastructure/session';
import { randomUUID } from 'crypto';

describe('Projects Module Integration Tests', () => {
  let ownerToken: string;
  let memberToken: string;
  let memberId: string;
  let nonMemberToken: string;
  let workspaceId: string;
  let projectId: string;

  beforeAll(async () => {
    // Clean up
    await prisma.workspaceMember.deleteMany();
    await prisma.project.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();

    // Create 3 users
    const owner = await prisma.user.create({
      data: { email: 'owner@example.com', name: 'Owner', passwordHash: 'hash' }
    });
    ownerToken = (await createSession(owner.id, owner.email)).sessionId;

    const member = await prisma.user.create({
      data: { email: 'member@example.com', name: 'Member', passwordHash: 'hash' }
    });
    memberId = member.id;
    memberToken = (await createSession(member.id, member.email)).sessionId;

    const nonMember = await prisma.user.create({
      data: { email: 'non@example.com', name: 'Non', passwordHash: 'hash' }
    });
    nonMemberToken = (await createSession(nonMember.id, nonMember.email)).sessionId;
  });

  afterAll(async () => {
    await prisma.projectMember.deleteMany();
    await prisma.project.deleteMany();
    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();
  });

  it('create workspace', async () => {
    const slug = `ws-${randomUUID()}`;
    const res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Test Workspace', slug });

    console.log('CREATE WORKSPACE BODY:', JSON.stringify(res.body, null, 2));
    expect(res.status).toBe(201);
    workspaceId = res.body.data.workspace.id;

    // Add member as VIEWER to workspace
    await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: memberId,
        role: 'VIEWER'
      }
    });

    // Add non-member to another workspace just so they exist, or just leave them with no workspace
  });

  it('create project', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Test Project', description: 'Test description' });

    expect(res.status).toBe(201);
    expect(res.body.project.name).toBe('Test Project');
    projectId = res.body.project.id;
  });

  it('add project member', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: memberId, role: 'MEMBER' });

    expect(res.status).toBe(201);
    expect(res.body.member.userId).toBe(memberId);
  });

  it('non-member attempts to view project (rejected)', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${nonMemberToken}`);

    expect(res.status).toBe(403);
  });

  it('member views project (allowed)', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(200);
    expect(res.body.project.id).toBe(projectId);
  });

  it('edit project (by owner)', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Updated Project' });

    expect(res.status).toBe(200);
    expect(res.body.project.name).toBe('Updated Project');
  });

  it('archive project', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.project.status).toBe('ARCHIVED');
  });

  it('attempt to edit archived project (blocked)', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Trying to edit archived' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Cannot modify an archived project');
  });
});
