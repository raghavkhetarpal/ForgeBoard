import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../index';
import prisma from '../../infrastructure/prisma';
import { createSession } from '../../infrastructure/session';
import { randomUUID } from 'crypto';

describe('Activity Module Integration Tests', () => {
  let memberToken: string;
  let workspaceId: string;
  let projectId: string;
  let actorId: string;

  beforeAll(async () => {
    // Setup user, workspace, project
    const user = await prisma.user.create({
      data: {
        email: `activity-test-${randomUUID()}@example.com`,
        name: 'Activity Test User',
        passwordHash: 'hash',
      },
    });
    actorId = user.id;

    const session = await createSession(user.id, user.email);
    memberToken = session.sessionId;

    const workspace = await prisma.workspace.create({
      data: {
        name: 'Activity Workspace',
        slug: `ws-act-${randomUUID()}`,
        members: {
          create: [{ userId: user.id, role: 'OWNER' }],
        },
      },
    });
    workspaceId = workspace.id;

    const project = await prisma.project.create({
      data: {
        name: 'Activity Project',
        workspaceId,
      },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.workspace.delete({ where: { id: workspaceId } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'activity-test' } } });
  });

  // Generic bounded polling helper
  const waitForCondition = async <T>(
    operation: () => Promise<T>,
    condition: (result: T) => boolean,
    errorMessage: string,
    maxRetries = 20,
    delayMs = 50
  ): Promise<T> => {
    for (let i = 0; i < maxRetries; i++) {
      const result = await operation();
      if (condition(result)) return result;
      await new Promise(r => setTimeout(r, delayMs));
    }
    throw new Error(`Timeout: ${errorMessage}`);
  };

  it('records a complete activity feed in correct order', async () => {
    // 1. Create issue
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ title: 'Activity Issue', description: 'Testing activity log' });
    expect(createRes.status).toBe(201);
    const issueId = createRes.body.issue.id;

    // 2. Change status
    const updateRes = await request(app)
      .patch(`/api/projects/${projectId}/issues/${issueId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: 'IN_PROGRESS' });
    expect(updateRes.status).toBe(200);

    // 3. Assign
    const assignRes = await request(app)
      .patch(`/api/projects/${projectId}/issues/${issueId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ assigneeId: actorId });
    expect(assignRes.status).toBe(200);

    // 4. Comment
    const commentRes = await request(app)
      .post(`/api/projects/${projectId}/issues/${issueId}/comments`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ content: 'Activity comment' });
    expect(commentRes.status).toBe(201);
    const commentId = commentRes.body.comment.id;

    // Wait deterministically for all 4 activities to be available via the API
    const activities = await waitForCondition(
      async () => {
        const feedRes = await request(app)
          .get(`/api/projects/${projectId}/activity`)
          .set('Authorization', `Bearer ${memberToken}`);
        return feedRes.body.filter((a: any) => a.targetId === issueId || a.targetId === commentId);
      },
      (acts) => acts.length >= 4,
      'Waiting for 4 activities to appear in the feed'
    );

    expect(activities).toHaveLength(4);

    // Sort by createdAt descending to ensure strict verification regardless of execution speed
    const myActivities = activities.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Assert correct metadata and types (newest first)
    expect(myActivities[0].action).toBe('COMMENT_CREATED');
    expect(myActivities[0].targetType).toBe('COMMENT');
    expect(myActivities[0].targetId).toBe(commentId);

    expect(myActivities[1].action).toBe('ISSUE_ASSIGNED');
    expect(myActivities[1].targetType).toBe('ISSUE');
    expect(myActivities[1].metadata.to).toBe(actorId);

    expect(myActivities[2].action).toBe('ISSUE_STATUS_CHANGED');
    expect(myActivities[2].targetType).toBe('ISSUE');
    expect(myActivities[2].metadata.from).toBe('TODO');
    expect(myActivities[2].metadata.to).toBe('IN_PROGRESS');

    expect(myActivities[3].action).toBe('ISSUE_CREATED');
    expect(myActivities[3].targetType).toBe('ISSUE');
  });

  it('moveIssue: creates activity on cross-column move but not on same-column reorder', async () => {
    // 1. Create an issue specifically for this test
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ title: 'Move Issue Test', description: 'Testing move logic' });
    expect(createRes.status).toBe(201);
    const issueId = createRes.body.issue.id;

    // 2. Perform same-column reorder
    const sameColumnRes = await request(app)
      .patch(`/api/projects/${projectId}/issues/${issueId}/move`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: 'TODO', position: 512 });
    expect(sameColumnRes.status).toBe(200);

    // 3. Verify no ISSUE_STATUS_CHANGED activity exists for that issue yet
    let statusActs = await prisma.activity.findMany({ where: { targetId: issueId, action: 'ISSUE_STATUS_CHANGED' } });
    expect(statusActs).toHaveLength(0);

    // 4. Perform cross-column move
    const crossColumnRes = await request(app)
      .patch(`/api/projects/${projectId}/issues/${issueId}/move`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: 'IN_PROGRESS', position: 1024 });
    expect(crossColumnRes.status).toBe(200);

    // 5. Deterministically wait for exactly the expected ISSUE_STATUS_CHANGED activity
    const acts = await waitForCondition(
      () => prisma.activity.findMany({ where: { targetId: issueId, action: 'ISSUE_STATUS_CHANGED' } }),
      (results) => results.some(a => (a.metadata as any)?.to === 'IN_PROGRESS'),
      'Waiting for cross-column move ISSUE_STATUS_CHANGED activity'
    );

    // 6. Verify exactly one status-change activity exists
    expect(acts).toHaveLength(1); 
    expect(acts[0].action).toBe('ISSUE_STATUS_CHANGED');
    expect((acts[0].metadata as any).from).toBe('TODO');
    expect((acts[0].metadata as any).to).toBe('IN_PROGRESS');
  });

});
