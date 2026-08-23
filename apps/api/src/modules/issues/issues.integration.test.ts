import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../index';
import prisma from '../../infrastructure/prisma';
import { createSession } from '../../infrastructure/session';
import { randomUUID } from 'crypto';

describe('Issues Module Integration Tests', () => {
  let ownerToken: string;
  let ownerId: string;
  let memberToken: string;
  let viewerToken: string;
  let nonMemberToken: string;
  let workspaceId: string;
  let projectId: string;
  let memberId: string;
  let viewerId: string;
  let nonMemberId: string;
  let issueId: string;

  beforeAll(async () => {
    

    const owner = await prisma.user.create({ data: { email: `owner-${randomUUID()}@i.com`, name: 'O', passwordHash: 'hash' } });
    ownerId = owner.id;
    ownerToken = (await createSession(owner.id, owner.email)).sessionId;

    const member = await prisma.user.create({ data: { email: `member-${randomUUID()}@i.com`, name: 'M', passwordHash: 'hash' } });
    memberId = member.id;
    memberToken = (await createSession(member.id, member.email)).sessionId;

    const viewer = await prisma.user.create({ data: { email: `viewer-${randomUUID()}@i.com`, name: 'V', passwordHash: 'hash' } });
    viewerId = viewer.id;
    viewerToken = (await createSession(viewer.id, viewer.email)).sessionId;

    const nonMember = await prisma.user.create({ data: { email: `non-${randomUUID()}@i.com`, name: 'N', passwordHash: 'hash' } });
    nonMemberId = nonMember.id;
    nonMemberToken = (await createSession(nonMember.id, nonMember.email)).sessionId;

    const wsRes = await request(app).post('/api/workspaces').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'W', slug: `w-${randomUUID()}` });
    workspaceId = wsRes.body.data.workspace.id;

    const projRes = await request(app).post(`/api/workspaces/${workspaceId}/projects`).set('Authorization', `Bearer ${ownerToken}`).send({ name: 'P' });
    projectId = projRes.body.project.id;

    await request(app).post(`/api/projects/${projectId}/members`).set('Authorization', `Bearer ${ownerToken}`).send({ userId: memberId, role: 'MEMBER' });
    await request(app).post(`/api/projects/${projectId}/members`).set('Authorization', `Bearer ${ownerToken}`).send({ userId: viewerId, role: 'VIEWER' });
  });

  afterAll(async () => {
    if (workspaceId) await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, memberId, viewerId, nonMemberId].filter(Boolean) } } });
  });

  it('create issue (MEMBER)', async () => {
    const res = await request(app).post(`/api/projects/${projectId}/issues`).set('Authorization', `Bearer ${memberToken}`).send({ title: 'Task 1' });
    expect(res.status).toBe(201);
    expect(res.body.issue.title).toBe('Task 1');
    expect(res.body.issue.status).toBe('TODO');
    expect(res.body.issue.priority).toBe('MEDIUM');
    issueId = res.body.issue.id;
  });

  it('assign issue to project member (MEMBER)', async () => {
    const res = await request(app).patch(`/api/projects/${projectId}/issues/${issueId}`).set('Authorization', `Bearer ${memberToken}`).send({ assigneeId: memberId });
    expect(res.status).toBe(200);
    expect(res.body.issue.assigneeId).toBe(memberId);
  });

  it('non-member attempts to view issue (rejected)', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/issues/${issueId}`).set('Authorization', `Bearer ${nonMemberToken}`);
    expect(res.status).toBe(403);
  });

  it('member views issue (allowed)', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/issues/${issueId}`).set('Authorization', `Bearer ${memberToken}`);
    if (res.status !== 200) console.log(res.body);
    expect(res.status).toBe(200);
    expect(res.body.issue.id).toBe(issueId);
  });

  it('change status and priority (MEMBER)', async () => {
    const res = await request(app).patch(`/api/projects/${projectId}/issues/${issueId}`).set('Authorization', `Bearer ${memberToken}`).send({ status: 'IN_PROGRESS', priority: 'HIGH' });
    expect(res.status).toBe(200);
    expect(res.body.issue.status).toBe('IN_PROGRESS');
    expect(res.body.issue.priority).toBe('HIGH');
  });

  it('attempt to assign issue to non-project-member (rejected)', async () => {
    const res = await request(app).patch(`/api/projects/${projectId}/issues/${issueId}`).set('Authorization', `Bearer ${memberToken}`).send({ assigneeId: nonMemberId });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Assignee must be a member of the project.');
  });

  it('VIEWER attempts to edit issue (rejected)', async () => {
    const res = await request(app).patch(`/api/projects/${projectId}/issues/${issueId}`).set('Authorization', `Bearer ${viewerToken}`).send({ title: 'Hacked' });
    expect(res.status).toBe(403);
  });
});
