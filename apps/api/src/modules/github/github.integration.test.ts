import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../index';
import prisma from '../../infrastructure/prisma';
import { createSession } from '../../infrastructure/session';
import { randomUUID } from 'crypto';
import { signOAuthState } from './github.utils';


describe('GitHub Integration Module', () => {
  let adminToken: string;
  let viewerToken: string;
  let projectId: string;
  let workspaceId: string;
  let adminId: string;
  let viewerId: string;
  
  // Save original env
  const originalEnv = process.env;

  beforeAll(async () => {
    process.env = { 
      ...originalEnv, 
      GITHUB_CLIENT_ID: 'test_client_id', 
      GITHUB_CLIENT_SECRET: 'test_client_secret',
      ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('hex') 
    };

    const admin = await prisma.user.create({
      data: { email: `admin-${randomUUID()}@example.com`, name: 'Admin', passwordHash: 'hash' }
    });
    adminId = admin.id;
    adminToken = (await createSession(admin.id, admin.email)).sessionId;

    const viewer = await prisma.user.create({
      data: { email: `viewer-${randomUUID()}@example.com`, name: 'Viewer', passwordHash: 'hash' }
    });
    viewerId = viewer.id;
    viewerToken = (await createSession(viewer.id, viewer.email)).sessionId;

    const ws = await prisma.workspace.create({
      data: {
        name: 'Github Workspace',
        slug: `ws-github-${randomUUID()}`,
        members: { create: [{ userId: admin.id, role: 'ADMIN' }, { userId: viewer.id, role: 'VIEWER' }] }
      }
    });
    workspaceId = ws.id;

    const p = await prisma.project.create({
      data: { workspaceId, name: 'Github Project' }
    });
    projectId = p.id;
    
    await prisma.projectMember.createMany({
      data: [
        { projectId, workspaceId, userId: admin.id, role: 'ADMIN' },
        { projectId, workspaceId, userId: viewer.id, role: 'VIEWER' }
      ]
    });
    
    // Mock global fetch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(global, 'fetch').mockImplementation(async (input: any, _init?: any) => {
      const url = input.toString();
      
      if (url.includes('/login/oauth/access_token')) {
        return {
          ok: true,
          json: async () => ({ access_token: 'mock_access_token' })
        } as Response;
      }
      
      if (url.includes('/user/repos')) {
        return {
          ok: true,
          json: async () => ([{ id: 101, owner: { login: 'testorg' }, name: 'testrepo', full_name: 'testorg/testrepo' }])
        } as Response;
      }
      
      if (url.includes('/repos/testorg/testrepo/pulls')) {
        return {
          ok: true,
          json: async () => ([{
            number: 1,
            title: 'Fix typo',
            state: 'open',
            html_url: 'https://github.com/testorg/testrepo/pull/1',
            user: { login: 'dev1' },
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z'
          }])
        } as Response;
      }
      
      if (url.includes('/repos/testorg/testrepo')) {
        return {
          ok: true,
          json: async () => ({ id: 101, owner: { login: 'testorg' }, name: 'testrepo', full_name: 'testorg/testrepo' })
        } as Response;
      }
      
      if (url.includes('/user')) {
        return {
          ok: true,
          json: async () => ({ login: 'mockuser', id: 1 })
        } as Response;
      }
      
      throw new Error(`Unhandled mock fetch: ${url}`);
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    process.env = originalEnv;
    await prisma.workspace.delete({ where: { id: workspaceId } });
    await prisma.user.delete({ where: { id: adminId } });
    await prisma.user.delete({ where: { id: viewerId } });
  });

  it('rejects github connect flow for non-admin', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/github/connect`)
      .set('Authorization', `Bearer ${viewerToken}`);
      
    expect(res.status).toBe(403);
  });

  it('generates github connect url for admin', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/github/connect`)
      .set('Authorization', `Bearer ${adminToken}`);
      
    expect(res.status).toBe(200);
    expect(res.body.url).toContain('https://github.com/login/oauth/authorize');
    expect(res.body.url).toContain('state=');
  });

  it('handles successful oauth callback and saves integration', async () => {
    const state = signOAuthState(projectId, adminId, workspaceId);
    const code = 'mock_auth_code';
    
    const res = await request(app)
      .get(`/api/github/callback?code=${code}&state=${state}`);
      
    // It should redirect to frontend
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('github=success');
    
    // Verify DB
    const integration = await prisma.githubIntegration.findUnique({ where: { projectId } });
    expect(integration).not.toBeNull();
    expect(integration!.githubAccountLogin).toBe('mockuser');
  });

  it('allows admin to list available repositories from github', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/github/repos/available`)
      .set('Authorization', `Bearer ${adminToken}`);
      
    expect(res.status).toBe(200);
    expect(res.body[0].full_name).toBe('testorg/testrepo');
  });

  it('allows admin to connect a repository', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/github/repos`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ owner: 'testorg', repo: 'testrepo' });
      
    expect(res.status).toBe(201);
    expect(res.body.fullName).toBe('testorg/testrepo');
  });
  
  it('allows viewer to list connected repositories', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/github/repos`)
      .set('Authorization', `Bearer ${viewerToken}`);
      
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].fullName).toBe('testorg/testrepo');
  });

  let repoId: string;
  
  it('allows viewer to list pull requests for a connected repository', async () => {
    const repos = await request(app)
      .get(`/api/projects/${projectId}/github/repos`)
      .set('Authorization', `Bearer ${viewerToken}`);
      
    repoId = repos.body[0].id;
    
    const res = await request(app)
      .get(`/api/projects/${projectId}/github/repos/${repoId}/pulls`)
      .set('Authorization', `Bearer ${viewerToken}`);
      
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('Fix typo');
    
    console.log('--- MOCKED PULL REQUEST RESPONSE ---');
    console.log(JSON.stringify(res.body, null, 2));
    console.log('------------------------------------');
  });
});
