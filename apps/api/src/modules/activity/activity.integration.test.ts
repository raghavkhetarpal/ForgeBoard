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

  it('moveIssue: creates activity on cross-column move but not on same-column reorder', async () => {
    // Helper to poll for an expected activity deterministically
    const waitForActivity = async (targetId: string, expectedToStatus: string) => {
      for (let i = 0; i < 20; i++) {
        const acts = await prisma.activity.findMany({ where: { targetId, action: 'ISSUE_STATUS_CHANGED' } });
        if (acts.some(a => (a.metadata as any)?.to === expectedToStatus)) {
          return acts;
        }
        await new Promise(r => setTimeout(r, 50));
      }
      throw new Error('Timeout waiting for expected activity');
    };

    // Create an issue specifically for this test
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/issues`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        title: 'Move Issue Test',
        description: 'Testing move logic'
      });
    expect(createRes.status).toBe(201);
    const issueId = createRes.body.issue.id;

    // Await the initial ISSUE_CREATED activity to settle so we can safely delete it
    for (let i = 0; i < 20; i++) {
      const createdActs = await prisma.activity.findMany({ where: { targetId: issueId, action: 'ISSUE_CREATED' } });
      if (createdActs.length > 0) break;
      await new Promise(r => setTimeout(r, 50));
    }

    // Clear previous activities for this issue (to isolate the count)
    await prisma.activity.deleteMany({ where: { targetId: issueId } });

    // CASE A: Same-column reorder
    const sameColumnRes = await request(app)
      .patch(`/api/projects/${projectId}/issues/${issueId}/move`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: 'TODO', position: 512 });
    expect(sameColumnRes.status).toBe(200);

    // CASE B: Cross-column move
    const crossColumnRes = await request(app)
      .patch(`/api/projects/${projectId}/issues/${issueId}/move`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: 'IN_PROGRESS', position: 1024 });
    expect(crossColumnRes.status).toBe(200);

    // Wait deterministically for the cross-column activity to be written
    const acts = await waitForActivity(issueId, 'IN_PROGRESS');

    // Since we waited for the cross-column move to write its activity, 
    // any activity from the same-column move (if incorrectly implemented) 
    // would also be present in the database by now.
    
    // Assert exactly ONE activity exists, proving the same-column move did not emit one.
    expect(acts).toHaveLength(1); 
    expect(acts[0].action).toBe('ISSUE_STATUS_CHANGED');
    expect((acts[0].metadata as any).from).toBe('TODO');
    expect((acts[0].metadata as any).to).toBe('IN_PROGRESS');
  });

});
