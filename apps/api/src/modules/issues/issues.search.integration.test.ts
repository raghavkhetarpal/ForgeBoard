import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../index';
import prisma from '../../infrastructure/prisma';
import { createSession } from '../../infrastructure/session';
import { randomUUID } from 'crypto';

describe('Issues Search, Filtering & Pagination Integration Tests', () => {
  let ownerToken: string;
  let ownerId: string;
  let memberToken: string;
  let memberId: string;
  let viewerToken: string;
  let viewerId: string;
  let nonMemberToken: string;
  let nonMemberId: string;

  let workspaceId: string;
  let projectId: string;
  let project2Id: string;

  let labelFrontendId: string;
  let labelBackendId: string;
  let milestoneId: string;

  const issueIds: string[] = [];

  beforeAll(async () => {
    // 1. Create test users
    const owner = await prisma.user.create({
      data: { email: `search-owner-${randomUUID()}@fb.com`, name: 'Search Owner', passwordHash: 'hash' },
    });
    ownerId = owner.id;
    ownerToken = (await createSession(owner.id, owner.email)).sessionId;

    const member = await prisma.user.create({
      data: { email: `search-member-${randomUUID()}@fb.com`, name: 'Search Member', passwordHash: 'hash' },
    });
    memberId = member.id;
    memberToken = (await createSession(member.id, member.email)).sessionId;

    const viewer = await prisma.user.create({
      data: { email: `search-viewer-${randomUUID()}@fb.com`, name: 'Search Viewer', passwordHash: 'hash' },
    });
    viewerId = viewer.id;
    viewerToken = (await createSession(viewer.id, viewer.email)).sessionId;

    const nonMember = await prisma.user.create({
      data: { email: `search-non-${randomUUID()}@fb.com`, name: 'Search NonMember', passwordHash: 'hash' },
    });
    nonMemberId = nonMember.id;
    nonMemberToken = (await createSession(nonMember.id, nonMember.email)).sessionId;

    // 2. Create Workspace and Projects
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Search WS', slug: `search-ws-${randomUUID()}` });
    workspaceId = wsRes.body.data.workspace.id;

    const projRes1 = await request(app)
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Search Project 1' });
    projectId = projRes1.body.project.id;

    const projRes2 = await request(app)
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Search Project 2' });
    project2Id = projRes2.body.project.id;

    // Add members to project 1
    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: memberId, role: 'MEMBER' });

    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: viewerId, role: 'VIEWER' });

    // 3. Create Labels in Project 1
    const l1 = await prisma.label.create({
      data: { projectId, name: 'Frontend', color: '#3b82f6' },
    });
    labelFrontendId = l1.id;

    const l2 = await prisma.label.create({
      data: { projectId, name: 'Backend', color: '#10b981' },
    });
    labelBackendId = l2.id;

    // 4. Create Milestone in Project 1
    const m1 = await prisma.milestone.create({
      data: { projectId, name: 'Release v1.0', status: 'OPEN' },
    });
    milestoneId = m1.id;

    // 5. Seed diverse issues in Project 1
    const seedData = [
      {
        title: 'Authentication bug with OAuth2',
        description: 'Need to fix token refresh rotation',
        status: 'TODO',
        priority: 'HIGH',
        assigneeId: memberId,
        milestoneId,
        labelIds: [labelFrontendId],
      },
      {
        title: 'Database index optimization',
        description: 'Slow queries in analytics aggregation',
        status: 'IN_PROGRESS',
        priority: 'URGENT',
        assigneeId: ownerId,
        milestoneId: null,
        labelIds: [labelBackendId],
      },
      {
        title: 'Documentation update',
        description: 'Write API documentation for Authentication endpoints',
        status: 'DONE',
        priority: 'LOW',
        assigneeId: null,
        milestoneId,
        labelIds: [labelFrontendId, labelBackendId],
      },
      {
        title: 'Frontend design revamp',
        description: 'Update navigation bar and theme tokens',
        status: 'BACKLOG',
        priority: 'MEDIUM',
        assigneeId: memberId,
        milestoneId: null,
        labelIds: [labelFrontendId],
      },
      {
        title: 'Refactor session store cluster',
        description: 'Redis replication and failover handling',
        status: 'IN_REVIEW',
        priority: 'HIGH',
        assigneeId: null,
        milestoneId: null,
        labelIds: [],
      },
      {
        title: 'Performance audit',
        description: 'Lighthouse vitals optimization',
        status: 'TODO',
        priority: 'MEDIUM',
        assigneeId: memberId,
        milestoneId,
        labelIds: [],
      },
    ];

    for (let i = 0; i < seedData.length; i++) {
      const item = seedData[i];
      const issue = await prisma.issue.create({
        data: {
          projectId,
          workspaceId,
          creatorId: ownerId,
          title: item.title,
          description: item.description,
          status: item.status as any,
          priority: item.priority as any,
          assigneeId: item.assigneeId,
          milestoneId: item.milestoneId,
          position: (i + 1) * 1000,
          // delay slightly for distinct created dates
          createdAt: new Date(Date.now() + i * 1000),
          labels: {
            create: item.labelIds.map((lId) => ({ labelId: lId })),
          },
        },
      });
      issueIds.push(issue.id);
    }

    // 6. Seed issue in Project 2 (Isolation test)
    await prisma.issue.create({
      data: {
        projectId: project2Id,
        workspaceId,
        creatorId: ownerId,
        title: 'Authentication bug in Project 2',
        description: 'Should never appear in project 1 queries',
        status: 'TODO',
        priority: 'HIGH',
        position: 1000,
      },
    });
  });

  afterAll(async () => {
    if (workspaceId) {
      await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
    }
    await prisma.user
      .deleteMany({
        where: { id: { in: [ownerId, memberId, viewerId, nonMemberId].filter(Boolean) } },
      })
      .catch(() => {});
  });

  describe('Global Project Search', () => {
    it('searches issues by title (case-insensitive)', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/issues?q=database`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.issues).toHaveLength(1);
      expect(res.body.issues[0].title).toBe('Database index optimization');
    });

    it('searches issues across both title and description', async () => {
      // "Authentication" appears in Issue 1 title and Issue 3 description
      const res = await request(app)
        .get(`/api/projects/${projectId}/issues?q=authentication`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.issues).toHaveLength(2);
      const titles = res.body.issues.map((i: any) => i.title);
      expect(titles).toContain('Authentication bug with OAuth2');
      expect(titles).toContain('Documentation update');
    });

    it('returns empty results when query matches nothing', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/issues?q=nonexistentpatternxyz123`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.issues).toHaveLength(0);
      expect(res.body.pagination.total).toBe(0);
    });
  });

  describe('Server-side Filtering', () => {
    it('filters by status', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/issues?status=TODO`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.issues).toHaveLength(2);
      expect(res.body.issues.every((i: any) => i.status === 'TODO')).toBe(true);
    });

    it('filters by priority', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/issues?priority=HIGH`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.issues).toHaveLength(2);
      expect(res.body.issues.every((i: any) => i.priority === 'HIGH')).toBe(true);
    });

    it('filters by specific assignee', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/issues?assigneeId=${memberId}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.issues).toHaveLength(3);
      expect(res.body.issues.every((i: any) => i.assigneeId === memberId)).toBe(true);
    });

    it('filters by unassigned issues', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/issues?assigneeId=UNASSIGNED`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.issues).toHaveLength(2);
      expect(res.body.issues.every((i: any) => i.assigneeId === null)).toBe(true);
    });

    it('filters by label relation', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/issues?labelId=${labelFrontendId}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.issues).toHaveLength(3);
      for (const issue of res.body.issues) {
        expect(issue.labels.some((l: any) => l.id === labelFrontendId)).toBe(true);
      }
    });

    it('filters by milestone', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/issues?milestoneId=${milestoneId}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.issues).toHaveLength(3);
      expect(res.body.issues.every((i: any) => i.milestoneId === milestoneId)).toBe(true);
    });

    it('filters by NO_MILESTONE', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/issues?milestoneId=NO_MILESTONE`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.issues).toHaveLength(3);
      expect(res.body.issues.every((i: any) => i.milestoneId === null)).toBe(true);
    });

    it('combines text search with multiple filters', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/issues?q=OAuth2&status=TODO&priority=HIGH&labelId=${labelFrontendId}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.issues).toHaveLength(1);
      expect(res.body.issues[0].title).toBe('Authentication bug with OAuth2');
    });
  });

  describe('Deterministic Cursor Pagination', () => {
    it('paginates deterministically across multiple pages without duplicates', async () => {
      // Page 1: limit 2
      const page1Res = await request(app)
        .get(`/api/projects/${projectId}/issues?limit=2&sortBy=createdAt&sortOrder=asc`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(page1Res.status).toBe(200);
      expect(page1Res.body.issues).toHaveLength(2);
      expect(page1Res.body.pagination.total).toBe(6);
      expect(page1Res.body.pagination.hasNextPage).toBe(true);
      expect(page1Res.body.pagination.nextCursor).toBeTruthy();

      const page1Ids = page1Res.body.issues.map((i: any) => i.id);
      const cursor1 = page1Res.body.pagination.nextCursor;

      // Page 2: limit 2 using cursor1
      const page2Res = await request(app)
        .get(`/api/projects/${projectId}/issues?limit=2&cursor=${cursor1}&sortBy=createdAt&sortOrder=asc`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(page2Res.status).toBe(200);
      expect(page2Res.body.issues).toHaveLength(2);
      expect(page2Res.body.pagination.total).toBe(6);
      expect(page2Res.body.pagination.hasNextPage).toBe(true);
      expect(page2Res.body.pagination.nextCursor).toBeTruthy();

      const page2Ids = page2Res.body.issues.map((i: any) => i.id);
      const cursor2 = page2Res.body.pagination.nextCursor;

      // Ensure no overlap between page 1 and page 2
      for (const id of page2Ids) {
        expect(page1Ids).not.toContain(id);
      }

      // Page 3: limit 2 using cursor2
      const page3Res = await request(app)
        .get(`/api/projects/${projectId}/issues?limit=2&cursor=${cursor2}&sortBy=createdAt&sortOrder=asc`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(page3Res.status).toBe(200);
      expect(page3Res.body.issues).toHaveLength(2);
      expect(page3Res.body.pagination.total).toBe(6);
      expect(page3Res.body.pagination.hasNextPage).toBe(false);
      expect(page3Res.body.pagination.nextCursor).toBeNull();

      const page3Ids = page3Res.body.issues.map((i: any) => i.id);

      // Verify complete coverage of all 6 issues
      const allFetchedIds = [...page1Ids, ...page2Ids, ...page3Ids];
      expect(allFetchedIds).toHaveLength(6);
      const uniqueIds = new Set(allFetchedIds);
      expect(uniqueIds.size).toBe(6);
    });

    it('returns all results without truncation when all=true', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/issues?all=true`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.issues).toHaveLength(6);
      expect(res.body.pagination.total).toBe(6);
      expect(res.body.pagination.hasNextPage).toBe(false);
    });
  });

  describe('Project Tenancy Isolation & RBAC', () => {
    it('strictly isolates search results between projects', async () => {
      // Both project 1 and 2 have an issue matching "Authentication"
      const res1 = await request(app)
        .get(`/api/projects/${projectId}/issues?q=Authentication`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res1.status).toBe(200);
      expect(res1.body.issues.every((i: any) => i.projectId === projectId)).toBe(true);

      const res2 = await request(app)
        .get(`/api/projects/${project2Id}/issues?q=Authentication`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res2.status).toBe(200);
      expect(res2.body.issues.every((i: any) => i.projectId === project2Id)).toBe(true);
    });

    it('allows VIEWER to search and paginate issues', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/issues?limit=5&q=OAuth2`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.issues).toHaveLength(1);
    });

    it('forbids NON_MEMBER from searching or listing issues', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/issues?q=OAuth2`)
        .set('Authorization', `Bearer ${nonMemberToken}`);

      expect(res.status).toBe(403);
    });
  });
});
