import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../apps/api/src/index';

describe('Phase 1 Foundation End-to-End Integration Flow', () => {
  const timestamp = Date.now();
  const ownerEmail = `owner_${timestamp}@example.com`;
  const memberEmail = `member_${timestamp}@example.com`;
  const viewerEmail = `viewer_${timestamp}@example.com`;
  const password = 'Password123!';

  let ownerCookie: string;
  let memberCookie: string;
  let viewerCookie: string;

  let workspaceId: string;
  let memberMembershipId: string;

  // Helper to extract forgeboard_session cookie header value from supertest response
  function extractCookie(res: request.Response): string {
    const cookies = res.headers['set-cookie'];
    if (!cookies) throw new Error('No set-cookie header in response');
    const sessionCookie = (Array.isArray(cookies) ? cookies : [cookies]).find((c: string) =>
      c.startsWith('forgeboard_session='),
    );
    if (!sessionCookie) throw new Error('forgeboard_session cookie not found in response');
    return sessionCookie.split(';')[0];
  }

  it('Step 1: Register and authenticate Owner user', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: ownerEmail,
        password,
        name: 'Workspace Owner',
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.data.user.email).toBe(ownerEmail);
    ownerCookie = extractCookie(regRes);
    expect(ownerCookie).toBeDefined();

    // Verify session by calling /api/auth/me
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', ownerCookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe(ownerEmail);
  });

  it('Step 2: Owner creates a new Workspace', async () => {
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({
        name: `Acme Corporation ${timestamp}`,
        slug: `acme-corp-${timestamp}`,
      });

    expect(wsRes.status).toBe(201);
    expect(wsRes.body.data.workspace).toBeDefined();
    expect(wsRes.body.data.member.role).toBe('OWNER');

    workspaceId = wsRes.body.data.workspace.id;
    expect(workspaceId).toBeDefined();
  });

  it('Step 3: Register and authenticate Member user', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: memberEmail,
        password,
        name: 'Workspace Member',
      });

    expect(regRes.status).toBe(201);
    memberCookie = extractCookie(regRes);

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', memberCookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe(memberEmail);
  });

  it('Step 4: Owner invites Member to the workspace', async () => {
    const inviteRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/invites`)
      .set('Cookie', ownerCookie)
      .send({
        email: memberEmail,
        role: 'MEMBER',
      });

    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.data.member.role).toBe('MEMBER');
    memberMembershipId = inviteRes.body.data.member.id;
    expect(memberMembershipId).toBeDefined();
  });

  it('Step 5: Owner promotes Member to ADMIN role', async () => {
    const updateRes = await request(app)
      .patch(`/api/workspaces/${workspaceId}/members/${memberMembershipId}`)
      .set('Cookie', ownerCookie)
      .send({
        role: 'ADMIN',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.member.role).toBe('ADMIN');
  });

  it('Step 6: Register Viewer and add to workspace', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: viewerEmail,
        password,
        name: 'Workspace Viewer',
      });

    expect(regRes.status).toBe(201);
    viewerCookie = extractCookie(regRes);

    const inviteRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/invites`)
      .set('Cookie', ownerCookie)
      .send({
        email: viewerEmail,
        role: 'VIEWER',
      });

    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.data.member.role).toBe('VIEWER');
  });

  it('Step 7: Unauthorized access attempt: VIEWER trying to remove a member is rejected with 403', async () => {
    const delRes = await request(app)
      .delete(`/api/workspaces/${workspaceId}/members/${memberMembershipId}`)
      .set('Cookie', viewerCookie);

    expect(delRes.status).toBe(403);
    expect(delRes.body.error.code).toBe('FORBIDDEN');
  });

  it('Step 8: Owner removes Member from workspace', async () => {
    const delRes = await request(app)
      .delete(`/api/workspaces/${workspaceId}/members/${memberMembershipId}`)
      .set('Cookie', ownerCookie);

    expect(delRes.status).toBe(200);
    expect(delRes.body.data.success).toBe(true);
  });

  it('Step 9: Confirm removed Member session is invalidated and rejected with 401', async () => {
    // The member's session should now be invalidated in Redis
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', memberCookie);

    expect(meRes.status).toBe(401);
    expect(meRes.body.error.code).toBe('UNAUTHORIZED');
  });
});
