import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../index';
import prisma from '../../infrastructure/prisma';
import { createSession } from '../../infrastructure/session';
import { randomUUID } from 'crypto';

describe('Comments Module Integration Tests', () => {
  let authorToken: string;
  let authorId: string;
  let nonAuthorToken: string;
  let nonAuthorId: string;
  let workspaceId: string;
  let projectId: string;
  let issueId: string;
  let nonMemberId: string;

  beforeAll(async () => {
    const author = await prisma.user.create({
      data: { email: `author-${randomUUID()}@example.com`, name: 'Author', passwordHash: 'hash' }
    });
    authorId = author.id;
    authorToken = (await createSession(author.id, author.email)).sessionId;

    const nonAuthor = await prisma.user.create({
      data: { email: `nonauthor-${randomUUID()}@example.com`, name: 'Non Author', passwordHash: 'hash' }
    });
    nonAuthorId = nonAuthor.id;
    nonAuthorToken = (await createSession(nonAuthor.id, nonAuthor.email)).sessionId;

    const ws = await prisma.workspace.create({
      data: {
        name: 'Comments Workspace',
        slug: `ws-comments-${randomUUID()}`,
        members: { create: [{ userId: author.id, role: 'OWNER' }, { userId: nonAuthor.id, role: 'MEMBER' }] }
      }
    });
    workspaceId = ws.id;

    const p = await prisma.project.create({
      data: { workspaceId, name: 'Project 1' }
    });
    projectId = p.id;
    
    // Add nonAuthor to project explicitly as MEMBER so they can try to comment
    await prisma.projectMember.create({
      data: { projectId, workspaceId, userId: nonAuthor.id, role: 'MEMBER' }
    });


    const nonMember = await prisma.user.create({
      data: { email: `nonmember-${randomUUID()}@example.com`, name: 'Non Member', passwordHash: 'hash' }
    });
    nonMemberId = nonMember.id;
    // no project membership for nonMember

    const issue = await prisma.issue.create({
      data: { projectId, workspaceId, title: 'Comment Issue', creatorId: author.id }
    });
    issueId = issue.id;
  });

  afterAll(async () => {
    await prisma.workspace.delete({ where: { id: workspaceId } });
    await prisma.user.delete({ where: { id: authorId } });
    await prisma.user.delete({ where: { id: nonAuthorId } });
    await prisma.user.delete({ where: { id: nonMemberId } });
  });

  it('comments E2E flow', async () => {
    // 1. Author comments
    const createRes = await request(app).post(`/api/projects/${projectId}/issues/${issueId}/comments`).set('Authorization', `Bearer ${authorToken}`).send({ content: 'Initial comment' });
    expect(createRes.status).toBe(201);
    const commentId = createRes.body.comment.id;
    
    // 2. Non-author attempts to edit (rejected)
    const editRej = await request(app).patch(`/api/projects/${projectId}/issues/${issueId}/comments/${commentId}`).set('Authorization', `Bearer ${nonAuthorToken}`).send({ content: 'Hacked' });
    expect(editRej.status).toBe(403);
    
    // 3. Non-author attempts to delete (rejected because MEMBER role)
    const delRej = await request(app).delete(`/api/projects/${projectId}/issues/${issueId}/comments/${commentId}`).set('Authorization', `Bearer ${nonAuthorToken}`);
    expect(delRej.status).toBe(403);
    
    // 4. Author edits own comment
    const editRes = await request(app).patch(`/api/projects/${projectId}/issues/${issueId}/comments/${commentId}`).set('Authorization', `Bearer ${authorToken}`).send({ content: 'Edited comment' });
    expect(editRes.status).toBe(200);
    expect(editRes.body.comment.content).toBe('Edited comment');
    expect(editRes.body.comment.edited).toBe(true);
    
    // OUTPUT FOR VERIFICATION
    console.log('--- EDITED COMMENT ---');
    console.log(JSON.stringify(editRes.body.comment, null, 2));
    console.log('----------------------');
    
    // 5. GET issue comments reflects the change
    const getRes = await request(app).get(`/api/projects/${projectId}/issues/${issueId}/comments`).set('Authorization', `Bearer ${nonAuthorToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.comments.length).toBe(1);
    expect(getRes.body.comments[0].content).toBe('Edited comment');
    expect(getRes.body.comments[0].edited).toBe(true);
    
    // 6. Author deletes own comment
    const delRes = await request(app).delete(`/api/projects/${projectId}/issues/${issueId}/comments/${commentId}`).set('Authorization', `Bearer ${authorToken}`);
    expect(delRes.status).toBe(200);
    
    // 7. GET issue comments is empty
    const getRes2 = await request(app).get(`/api/projects/${projectId}/issues/${issueId}/comments`).set('Authorization', `Bearer ${authorToken}`);
    expect(getRes2.body.comments.length).toBe(0);
  });

  it('mentions flow', async () => {
    // We need the emails of B and the nonMember
    const userB = await prisma.user.findUnique({ where: { id: nonAuthorId } });
    const nonMember = await prisma.user.findFirst({ where: { name: 'Non Member' } });

    // A comments mentioning B, A, and nonMember
     // Actually we know author's email starts with author-
    
    // We'll just fetch A to get their exact email
    const userA = await prisma.user.findUnique({ where: { id: authorId } });
    const realContent = `Hey @${userB!.email}, @${nonMember!.email} and @${userA!.email}`;

    const createRes = await request(app).post(`/api/projects/${projectId}/issues/${issueId}/comments`).set('Authorization', `Bearer ${authorToken}`).send({ content: realContent });
    expect(createRes.status).toBe(201);
    
    // Wait a brief moment since processMentions is fire-and-forget

    // B should have a notification
    const getB = await request(app).get('/api/notifications').set('Authorization', `Bearer ${nonAuthorToken}`);
    expect(getB.status).toBe(200);
    expect(getB.body.notifications.length).toBeGreaterThan(0);
    expect(getB.body.notifications[0].type).toBe('MENTION');
    
    // OUTPUT FOR VERIFICATION
    console.log('--- EXTRACTED MENTIONS TEST STRING ---');
    console.log(realContent);
    console.log('--- GENERATED NOTIFICATION FOR B ---');
    console.log(JSON.stringify(getB.body.notifications[0], null, 2));
    console.log('------------------------------------');

    // A should not have a self notification
    const getA = await request(app).get('/api/notifications').set('Authorization', `Bearer ${authorToken}`);
    expect(getA.body.notifications.length).toBe(0);

    // nonMember should not have a notification
    const nonMemberToken = (await createSession(nonMember!.id, nonMember!.email)).sessionId;
    const getNon = await request(app).get('/api/notifications').set('Authorization', `Bearer ${nonMemberToken}`);
    expect(getNon.body.notifications.length).toBe(0);
  });

});
