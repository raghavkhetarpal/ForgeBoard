import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../index';
import prisma from '../../infrastructure/prisma';
import { createSession } from '../../infrastructure/session';

describe('Milestones Module Integration Tests', () => {
  let ownerToken: string;
  let ownerId: string;
  let viewerToken: string;
  let viewerId: string;
  let workspaceId: string;
  let projectId1: string;
  let projectId2: string;

  beforeAll(async () => {
    // 1. Create owner user
    const owner = await prisma.user.create({
      data: {
        email: `milestones-owner-${Date.now()}@example.com`,
        name: 'Milestone Owner',
        passwordHash: 'hash',
      },
    });
    ownerId = owner.id;
    ownerToken = (await createSession(owner.id, owner.email)).sessionId;

    // 2. Create viewer user
    const viewer = await prisma.user.create({
      data: {
        email: `milestones-viewer-${Date.now()}@example.com`,
        name: 'Milestone Viewer',
        passwordHash: 'hash',
      },
    });
    viewerId = viewer.id;
    viewerToken = (await createSession(viewer.id, viewer.email)).sessionId;

    // 3. Create workspace
    const ws = await prisma.workspace.create({
      data: {
        name: 'Milestones Workspace',
        slug: `ws-milestones-${Date.now()}`,
        members: {
          create: [
            { userId: owner.id, role: 'OWNER' },
            { userId: viewer.id, role: 'MEMBER' },
          ],
        },
      },
    });
    workspaceId = ws.id;

    // 4. Create projects
    const p1 = await prisma.project.create({
      data: {
        workspaceId,
        name: 'Milestones Project 1',
        members: {
          create: [
            { userId: owner.id, workspaceId, role: 'ADMIN' },
            { userId: viewer.id, workspaceId, role: 'VIEWER' },
          ],
        },
      },
    });
    projectId1 = p1.id;

    const p2 = await prisma.project.create({
      data: {
        workspaceId,
        name: 'Milestones Project 2',
        members: {
          create: [{ userId: owner.id, workspaceId, role: 'ADMIN' }],
        },
      },
    });
    projectId2 = p2.id;
  });

  afterAll(async () => {
    await prisma.workspace.delete({ where: { id: workspaceId } });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, viewerId] } },
    });
  });

  it('enforces RBAC permissions for milestone operations', async () => {
    // VIEWER cannot create milestone (403)
    const createRes = await request(app)
      .post(`/api/projects/${projectId1}/milestones`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'Unauthorized Sprint' });
    expect(createRes.status).toBe(403);

    // ADMIN/MEMBER can create milestone
    const validCreate = await request(app)
      .post(`/api/projects/${projectId1}/milestones`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Sprint 1',
        description: 'First iteration',
        startDate: new Date('2026-10-01T00:00:00.000Z').toISOString(),
        dueDate: new Date('2026-10-14T23:59:59.000Z').toISOString(),
      });
    expect(validCreate.status).toBe(201);
    const milestoneId = validCreate.body.milestone.id;

    // VIEWER can view milestone list (200)
    const listRes = await request(app)
      .get(`/api/projects/${projectId1}/milestones`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.milestones).toHaveLength(1);
    expect(listRes.body.milestones[0].id).toBe(milestoneId);

    // VIEWER can view milestone detail (200)
    const getRes = await request(app)
      .get(`/api/projects/${projectId1}/milestones/${milestoneId}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.milestone.name).toBe('Sprint 1');

    // VIEWER cannot update milestone (403)
    const updateRes = await request(app)
      .patch(`/api/projects/${projectId1}/milestones/${milestoneId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'Hacked Name' });
    expect(updateRes.status).toBe(403);

    // VIEWER cannot delete milestone (403)
    const deleteRes = await request(app)
      .delete(`/api/projects/${projectId1}/milestones/${milestoneId}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(deleteRes.status).toBe(403);
  });

  it('validates unique milestone names per project', async () => {
    // Duplicate name in project 1 should fail (400)
    const duplicateRes = await request(app)
      .post(`/api/projects/${projectId1}/milestones`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Sprint 1' });
    expect(duplicateRes.status).toBe(400);

    // Same name in project 2 should succeed (201)
    const p2Res = await request(app)
      .post(`/api/projects/${projectId2}/milestones`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Sprint 1' });
    expect(p2Res.status).toBe(201);
  });

  it('tracks progress based on assigned issues and status transitions', async () => {
    // Fetch existing Sprint 1 in project 1
    const listRes = await request(app)
      .get(`/api/projects/${projectId1}/milestones`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const sprint1 = listRes.body.milestones.find((m: { name: string }) => m.name === 'Sprint 1');
    expect(sprint1).toBeDefined();
    const milestoneId = sprint1.id;

    expect(sprint1.totalIssues).toBe(0);
    expect(sprint1.completedIssues).toBe(0);
    expect(sprint1.progress).toBe(0);

    // Create Issue 1 assigned to Sprint 1
    const issue1Res = await request(app)
      .post(`/api/projects/${projectId1}/issues`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Milestone Issue 1',
        milestoneId,
        status: 'TODO',
      });
    expect(issue1Res.status).toBe(201);
    const issue1Id = issue1Res.body.issue.id;
    expect(issue1Res.body.issue.milestoneId).toBe(milestoneId);
    expect(issue1Res.body.issue.milestone).toBeDefined();
    expect(issue1Res.body.issue.milestone.name).toBe('Sprint 1');

    // Create Issue 2 without milestone, then link it via update
    const issue2Res = await request(app)
      .post(`/api/projects/${projectId1}/issues`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Milestone Issue 2',
        status: 'IN_PROGRESS',
      });
    expect(issue2Res.status).toBe(201);
    const issue2Id = issue2Res.body.issue.id;

    const linkRes = await request(app)
      .patch(`/api/projects/${projectId1}/issues/${issue2Id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ milestoneId });
    expect(linkRes.status).toBe(200);
    expect(linkRes.body.issue.milestoneId).toBe(milestoneId);

    // Verify progress: 2 total, 0 completed => 0%
    const progress1Res = await request(app)
      .get(`/api/projects/${projectId1}/milestones/${milestoneId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(progress1Res.body.milestone.totalIssues).toBe(2);
    expect(progress1Res.body.milestone.completedIssues).toBe(0);
    expect(progress1Res.body.milestone.openIssues).toBe(2);
    expect(progress1Res.body.milestone.progress).toBe(0);

    // Complete Issue 1 -> status: DONE
    const complete1 = await request(app)
      .patch(`/api/projects/${projectId1}/issues/${issue1Id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'DONE' });
    expect(complete1.status).toBe(200);

    // Verify progress: 2 total, 1 completed => 50%
    const progress2Res = await request(app)
      .get(`/api/projects/${projectId1}/milestones/${milestoneId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(progress2Res.body.milestone.totalIssues).toBe(2);
    expect(progress2Res.body.milestone.completedIssues).toBe(1);
    expect(progress2Res.body.milestone.openIssues).toBe(1);
    expect(progress2Res.body.milestone.progress).toBe(50);

    // Complete Issue 2 -> status: DONE
    const complete2 = await request(app)
      .patch(`/api/projects/${projectId1}/issues/${issue2Id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'DONE' });
    expect(complete2.status).toBe(200);

    // Verify progress: 2 total, 2 completed => 100%
    const progress3Res = await request(app)
      .get(`/api/projects/${projectId1}/milestones/${milestoneId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(progress3Res.body.milestone.totalIssues).toBe(2);
    expect(progress3Res.body.milestone.completedIssues).toBe(2);
    expect(progress3Res.body.milestone.openIssues).toBe(0);
    expect(progress3Res.body.milestone.progress).toBe(100);

    // Prevent cross-project milestone assignment
    const p2List = await request(app)
      .get(`/api/projects/${projectId2}/milestones`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const p2MilestoneId = p2List.body.milestones[0].id;

    const crossProjectRes = await request(app)
      .patch(`/api/projects/${projectId1}/issues/${issue1Id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ milestoneId: p2MilestoneId });
    expect(crossProjectRes.status).toBe(400);
  });

  it('updates status and unlinks issues cleanly upon deletion', async () => {
    // 1. Create a milestone to delete
    const createRes = await request(app)
      .post(`/api/projects/${projectId1}/milestones`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Temporary Sprint' });
    expect(createRes.status).toBe(201);
    const tempMilestoneId = createRes.body.milestone.id;

    // 2. Create issue linked to this milestone
    const issueRes = await request(app)
      .post(`/api/projects/${projectId1}/issues`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Temp Issue', milestoneId: tempMilestoneId });
    expect(issueRes.status).toBe(201);
    const tempIssueId = issueRes.body.issue.id;

    // 3. Update milestone status to CLOSED
    const closeRes = await request(app)
      .patch(`/api/projects/${projectId1}/milestones/${tempMilestoneId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'CLOSED' });
    expect(closeRes.status).toBe(200);
    expect(closeRes.body.milestone.status).toBe('CLOSED');

    // 4. Delete milestone
    const deleteRes = await request(app)
      .delete(`/api/projects/${projectId1}/milestones/${tempMilestoneId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(deleteRes.status).toBe(200);

    // 5. Verify issue still exists but milestoneId is null
    const checkIssueRes = await request(app)
      .get(`/api/projects/${projectId1}/issues/${tempIssueId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(checkIssueRes.status).toBe(200);
    expect(checkIssueRes.body.issue.milestoneId).toBeNull();
    expect(checkIssueRes.body.issue.milestone).toBeUndefined();
  });
});
