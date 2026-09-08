import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../index';
import prisma from '../../infrastructure/prisma';
import { createSession } from '../../infrastructure/session';
import crypto, { randomUUID } from 'crypto';
import { encryptString } from '../../infrastructure/encryption';
import { getSocketServer } from '../../infrastructure/socket';

describe('Webhooks Module Integration Tests', () => {
  let memberToken: string;
  let workspaceId: string;
  let projectId: string;
  let issueId: string;
  let repoId: string;
  let integrationId: string;

  const WEBHOOK_SECRET = 'test_secret_for_webhooks';
  
  beforeAll(async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      // Mock GitHub API PR response
      return {
        ok: true,
        json: async () => ({
          number: 42,
          title: "Test PR",
          state: "open",
          html_url: "https://github.com/testorg/testrepo/pull/42",
          user: { login: "testuser" },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      } as Response;
    });

    process.env.GITHUB_WEBHOOK_SECRET = WEBHOOK_SECRET;

    // Create a test user, workspace, project, issue, and github repo
    const user = await prisma.user.create({
      data: {
        email: `webhook-test-${randomUUID()}@example.com`,
        name: 'Webhook Test User',
        passwordHash: 'hash',
      },
    });

    const session = await createSession(user.id);
    memberToken = session.sessionId;

    const workspace = await prisma.workspace.create({
      data: {
        name: 'Webhook Workspace',
        slug: `ws-wh-${randomUUID()}`,
        members: {
          create: [{ userId: user.id, role: 'OWNER' }],
        },
      },
    });
    workspaceId = workspace.id;

    const project = await prisma.project.create({
      data: {
        name: 'Webhook Project',
        workspaceId,
      },
    });
    projectId = project.id;

    const issue = await prisma.issue.create({
      data: {
        projectId,
        workspaceId,
        title: 'Test Issue for PR',
        description: 'Should be updated by webhook',
        creatorId: user.id,
        status: 'TODO',
        position: 1024,
      },
    });
    issueId = issue.id;

    // Create integration & repo directly since we don't have OAuth in this test
    const integration = await prisma.githubIntegration.create({
      data: {
        projectId,
        workspaceId,
        installedByUserId: user.id,
        accessToken: encryptString('fake_token'),
        githubAccountLogin: 'testuser',
      }
    });
    integrationId = integration.id;

    const repo = await prisma.githubRepository.create({
      data: {
        integrationId,
        projectId,
        githubRepoId: 999999, // Our mock github repository ID
        owner: 'testorg',
        name: 'testrepo',
        fullName: 'testorg/testrepo',
      }
    });
    repoId = repo.id;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.workspace.delete({ where: { id: workspaceId } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'webhook-test' } } });
  });

  function signPayload(payload: any, secret: string) {
    const rawBody = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    return `sha256=${hmac.digest('hex')}`;
  }

  it('manually links an issue to a PR', async () => {
    // Manually link the PR using the endpoint we created
    const res = await request(app)
      .post(`/api/projects/${projectId}/issues/${issueId}/link-pr`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        repoId: repoId,
        prNumber: 42
      });

    expect(res.status).toBe(201);
    
    const link = await prisma.issuePullRequest.findFirst({
      where: { issueId, prNumber: 42 }
    });
    expect(link).toBeTruthy();
    expect(link?.prStatus).toBe('open'); // from mock fetch
  });

  it('rejects webhook with missing signature', async () => {
    const payload = { action: 'closed' };
    const res = await request(app)
      .post('/api/webhooks/github')
      .send(payload);
    
    expect(res.status).toBe(401);
    expect(res.text).toBe('Missing signature');
  });

  it('rejects webhook with invalid signature', async () => {
    const payload = { action: 'closed' };
    const res = await request(app)
      .post('/api/webhooks/github')
      .set('x-hub-signature-256', 'sha256=invalidhash')
      .send(payload);
    
    expect(res.status).toBe(401);
    expect(res.text).toBe('Invalid signature');
  });

  it('rejects tampered payload with a signature that does not match', async () => {
    const payload = { action: 'closed' };
    const validSignature = signPayload(payload, WEBHOOK_SECRET);
    
    const tamperedPayload = { action: 'opened' }; // Different payload, but using signature for the first one
    const res = await request(app)
      .post('/api/webhooks/github')
      .set('x-hub-signature-256', validSignature)
      .send(tamperedPayload);
    
    expect(res.status).toBe(401);
    expect(res.text).toBe('Invalid signature');
  });

  it('processes valid webhook, updates issue, and is idempotent', async () => {
    const payload = {
      action: 'closed',
      pull_request: {
        number: 42,
        merged: true
      },
      repository: {
        id: 999999
      }
    };
    
    const signature = signPayload(payload, WEBHOOK_SECRET);
    const deliveryId = randomUUID();

    // Setup spy on prisma.issue.update to verify it's only called once
    // const issueUpdateSpy = vi.spyOn(prisma.issue, 'update');

    // First delivery
    const res1 = await request(app)
      .post('/api/webhooks/github')
      .set('x-hub-signature-256', signature)
      .set('x-github-delivery', deliveryId)
      .set('x-github-event', 'pull_request')
      .set('Content-Type', 'application/json')
      .send(payload);
    
    expect(res1.status).toBe(200);
    expect(res1.text).toBe('Processed');

    // Verify issue status
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    const firstUpdatedAt = issue!.updatedAt.getTime();
    expect(issue?.status).toBe('DONE');
    
    // Verify PR link status
    const link = await prisma.issuePullRequest.findFirst({ where: { issueId, prNumber: 42 } });
    expect(link?.prStatus).toBe('merged');

    // // // removed spy check

    // Second delivery (duplicate)
    const res2 = await request(app)
      .post('/api/webhooks/github')
      .set('x-hub-signature-256', signature)
      .set('x-github-delivery', deliveryId)
      .set('x-github-event', 'pull_request')
      .set('Content-Type', 'application/json')
      .send(payload);
    
    expect(res2.status).toBe(200);
    expect(res2.text).toBe('Already processed');

    // Verify it wasn't processed again by checking that updatedAt didn't change
    const issueAfterDuplicate = await prisma.issue.findUnique({ where: { id: issueId } });
    expect(issueAfterDuplicate!.updatedAt.getTime()).toBe(firstUpdatedAt);
  });
});
