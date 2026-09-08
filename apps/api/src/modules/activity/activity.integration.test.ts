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

    const session = await createSession(user.id);
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

  it('records a complete activity feed in correct order', async () => {
    // Wait slightly between actions to ensure chronological ordering if precision is low
    const wait = () => new Promise(r => setTimeout(r, 10));

    // 1. Create issue
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        title: 'Activity Issue',
        description: 'Testing activity log'
      });
    expect(createRes.status).toBe(201);
    const issueId = createRes.body.issue.id;
    await wait();

    // 2. Change status via updateIssue
    const updateRes = await request(app)
      .patch(`/api/projects/${projectId}/issues/${issueId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: 'IN_PROGRESS' });
    expect(updateRes.status).toBe(200);
    await wait();

    // 3. Assign
    const assignRes = await request(app)
      .patch(`/api/projects/${projectId}/issues/${issueId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ assigneeId: actorId });
    expect(assignRes.status).toBe(200);
    await wait();

    // 4. Comment
    const commentRes = await request(app)
      .post(`/api/projects/${projectId}/issues/${issueId}/comments`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ content: 'Activity comment' });
    expect(commentRes.status).toBe(201);
    await wait();

    // GET activity feed
    const feedRes = await request(app)
      .get(`/api/projects/${projectId}/activity`)
      .set('Authorization', `Bearer ${memberToken}`);
      
    expect(feedRes.status).toBe(200);
    
    const activities = feedRes.body;
    expect(Array.isArray(activities)).toBe(true);
    
    // Ordered by createdAt desc, so comment is first (index 0)
    // Filter to only our issue/comment to avoid test cross-pollution if db is shared
    const myActivities = activities.filter((a: any) => 
      a.targetId === issueId || a.targetId === commentRes.body.comment.id
    );

    
    expect(myActivities).toHaveLength(4);

    // Assert correct metadata and types
    expect(myActivities[0].action).toBe('COMMENT_CREATED');
    expect(myActivities[0].targetType).toBe('COMMENT');
    expect(myActivities[0].targetId).toBe(commentRes.body.comment.id);

    expect(myActivities[1].action).toBe('ISSUE_ASSIGNED');
    expect(myActivities[1].targetType).toBe('ISSUE');
    expect(myActivities[1].metadata.from).toBeNull();
    expect(myActivities[1].metadata.to).toBe(actorId);

    expect(myActivities[2].action).toBe('ISSUE_STATUS_CHANGED');
    expect(myActivities[2].targetType).toBe('ISSUE');
    expect(myActivities[2].metadata.from).toBe('TODO');
    expect(myActivities[2].metadata.to).toBe('IN_PROGRESS');

    expect(myActivities[3].action).toBe('ISSUE_CREATED');
    expect(myActivities[3].targetType).toBe('ISSUE');
    
    // Print the output for the prompt requirement
    console.log('--- ACTIVITY FEED OUTPUT ---');
    console.log(JSON.stringify(myActivities, null, 2));
    console.log('----------------------------');
  });
});
