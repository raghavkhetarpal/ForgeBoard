import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireWorkspaceRole } from './rbac.middleware';
import prisma from '../infrastructure/prisma';
import { WorkspaceRole } from '@forgeboard/types';

describe('RBAC Middleware - requireWorkspaceRole', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      user: { id: 'user_1', email: 'user@example.com', name: 'User 1', avatarUrl: null },
      params: { workspaceId: 'ws_1' },
      body: {},
      headers: {},
      query: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    req.user = undefined;
    const middleware = requireWorkspaceRole('VIEWER');
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'UNAUTHORIZED' }) }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when workspaceId is missing with 400', async () => {
    req.params = {};
    const middleware = requireWorkspaceRole('VIEWER');
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'BAD_REQUEST' }) }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when user is not a member of the workspace with 403', async () => {
    vi.spyOn(prisma.workspaceMember, 'findUnique').mockResolvedValue(null);

    const middleware = requireWorkspaceRole('VIEWER');
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'FORBIDDEN' }) }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  describe('Role Hierarchy Permissions Matrix', () => {
    const roles: WorkspaceRole[] = ['VIEWER', 'MEMBER', 'ADMIN', 'OWNER'];
    const roleRanks: Record<WorkspaceRole, number> = {
      VIEWER: 1,
      MEMBER: 2,
      ADMIN: 3,
      OWNER: 4,
    };

    roles.forEach((userRole) => {
      roles.forEach((requiredRole) => {
        const expectedToPass = roleRanks[userRole] >= roleRanks[requiredRole];

        it(`user with role "${userRole}" accessing endpoint requiring "${requiredRole}" -> ${expectedToPass ? 'ALLOWS' : 'DENIES'}`, async () => {
          vi.spyOn(prisma.workspaceMember, 'findUnique').mockResolvedValue({
            id: 'mem_1',
            workspaceId: 'ws_1',
            userId: 'user_1',
            role: userRole,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any);

          const middleware = requireWorkspaceRole(requiredRole);
          await middleware(req, res, next);

          if (expectedToPass) {
            expect(next).toHaveBeenCalled();
            expect(req.membership).toEqual({
              workspaceId: 'ws_1',
              userId: 'user_1',
              role: userRole,
            });
            expect(res.status).not.toHaveBeenCalled();
          } else {
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({
                error: expect.objectContaining({ code: 'FORBIDDEN' }),
              }),
            );
            expect(next).not.toHaveBeenCalled();
          }
        });
      });
    });
  });
});
