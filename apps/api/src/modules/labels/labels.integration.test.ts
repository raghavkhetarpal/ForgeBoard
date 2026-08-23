import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../index';
import prisma from '../../infrastructure/prisma';
import { createSession } from '../../infrastructure/session';

describe('Labels Module Integration Tests', () => {
  let ownerToken: string;
  let ownerId: string;
  let workspaceId: string;
  let projectId1: string;
  let projectId2: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `owner-labels-${Date.now()}@example.com`, name: 'Label Owner', passwordHash: 'hash' }
    });
    ownerId = user.id;
    ownerToken = (await createSession(user.id, user.email)).sessionId;

    const ws = await prisma.workspace.create({
      data: {
        name: 'Labels Workspace',
        slug: `ws-labels-${Date.now()}`,
        members: { create: { userId: user.id, role: 'OWNER' } }
      }
    });
    workspaceId = ws.id;

    const p1 = await prisma.project.create({
      data: { workspaceId, name: 'Project 1' }
    });
    projectId1 = p1.id;

    const p2 = await prisma.project.create({
      data: { workspaceId, name: 'Project 2' }
    });
    projectId2 = p2.id;
  });

  afterAll(async () => {
    await prisma.workspace.delete({ where: { id: workspaceId } });
    await prisma.user.delete({ where: { id: ownerId } });
  });

  it('labels E2E flow', async () => {
    // 1. Create 2 labels in Project 1
    const l1Res = await request(app).post(`/api/projects/${projectId1}/labels`).set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Bug', color: '#ff0000' });
    expect(l1Res.status).toBe(201);
    const label1Id = l1Res.body.label.id;

    const l2Res = await request(app).post(`/api/projects/${projectId1}/labels`).set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Feature', color: '#00ff00' });
    expect(l2Res.status).toBe(201);
    const label2Id = l2Res.body.label.id;

    // 2. Create issue in Project 1
    const issueRes = await request(app).post(`/api/projects/${projectId1}/issues`).set('Authorization', `Bearer ${ownerToken}`).send({ title: 'Issue 1' });
    expect(issueRes.status).toBe(201);
    const issueId = issueRes.body.issue.id;

    // 3. Attach both labels
    const a1Res = await request(app).post(`/api/projects/${projectId1}/issues/${issueId}/labels`).set('Authorization', `Bearer ${ownerToken}`).send({ labelId: label1Id });
    expect(a1Res.status).toBe(200);

    const a2Res = await request(app).post(`/api/projects/${projectId1}/issues/${issueId}/labels`).set('Authorization', `Bearer ${ownerToken}`).send({ labelId: label2Id });
    expect(a2Res.status).toBe(200);

    // 4. GET issue shows both labels
    const get1Res = await request(app).get(`/api/projects/${projectId1}/issues/${issueId}`).set('Authorization', `Bearer ${ownerToken}`);
    expect(get1Res.status).toBe(200);
    expect(get1Res.body.issue.labels).toBeDefined();
    
    // OUTPUT FOR VERIFICATION
    console.log('--- GET ISSUE LABELS ARRAY (BOTH ATTACHED) ---');
    console.log(JSON.stringify(get1Res.body.issue.labels, null, 2));
    console.log('----------------------------------------------');
    
    expect(get1Res.body.issue.labels.length).toBe(2);

    // 5. Remove one label
    const remRes = await request(app).delete(`/api/projects/${projectId1}/issues/${issueId}/labels/${label1Id}`).set('Authorization', `Bearer ${ownerToken}`);
    expect(remRes.status).toBe(200);

    // 6. GET issue shows only the remaining one
    const get2Res = await request(app).get(`/api/projects/${projectId1}/issues/${issueId}`).set('Authorization', `Bearer ${ownerToken}`);
    expect(get2Res.body.issue.labels.length).toBe(1);
    expect(get2Res.body.issue.labels[0].id).toBe(label2Id);

    // 7. Attempt to attach a label from a different project (rejected)
    // First create label in project 2
    const l3Res = await request(app).post(`/api/projects/${projectId2}/labels`).set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Cross', color: '#0000ff' });
    const crossLabelId = l3Res.body.label.id;

    // Attempt to attach to project 1 issue using project 1 endpoint
    const crossRes1 = await request(app).post(`/api/projects/${projectId1}/issues/${issueId}/labels`).set('Authorization', `Bearer ${ownerToken}`).send({ labelId: crossLabelId });
    expect(crossRes1.status).toBe(400);
    expect(crossRes1.body.error.message).toBe('Label not found or belongs to a different project');

    // Attempt to attach to project 1 issue using project 2 endpoint
    const crossRes2 = await request(app).post(`/api/projects/${projectId2}/issues/${issueId}/labels`).set('Authorization', `Bearer ${ownerToken}`).send({ labelId: crossLabelId });
    expect(crossRes2.status).toBe(400);
    expect(crossRes2.body.error.message).toBe('Issue not found or belongs to a different project');
  });
});
