/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireWorkspaceRole, requireProjectRole } from './rbac.middleware';
import prisma from '../infrastructure/prisma';
import { WorkspaceRole, ProjectRole } from '@forgeboard/types';

describe('RBAC Middleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      user: { id: 'user_1', email: 'user@example.com', name: 'User 1', avatarUrl: null },
      params: { workspaceId: 'ws_1', projectId: 'proj_1' },
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

  describe('requireWorkspaceRole', () => {
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

  describe('requireProjectRole', () => {
    beforeEach(() => {
      vi.spyOn(prisma.project, 'findUnique').mockResolvedValue({
        id: 'proj_1',
        workspaceId: 'ws_1',
        name: 'Project 1',
        description: null,
        status: 'PLANNING',
        deadline: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
    });

    it('ALLOWS workspace VIEWER who is a project ADMIN to pass ADMIN check', async () => {
      // Workspace membership (VIEWER)
      vi.spyOn(prisma.workspaceMember, 'findUnique').mockResolvedValue({
        id: 'mem_1', workspaceId: 'ws_1', userId: 'user_1', role: 'VIEWER', createdAt: new Date(), updatedAt: new Date(),
      } as any);
      
      // Project membership (ADMIN)
      vi.spyOn(prisma.projectMember, 'findUnique').mockResolvedValue({
        id: 'pmem_1', projectId: 'proj_1', workspaceId: 'ws_1', userId: 'user_1', role: 'ADMIN', createdAt: new Date(), updatedAt: new Date(),
      } as any);

      const middleware = requireProjectRole('ADMIN');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.projectMembership).toMatchObject({
        role: 'ADMIN',
        isImplicitAdmin: false,
      });
    });

    it('ALLOWS workspace OWNER to access project with ADMIN rights implicitly', async () => {
      // Workspace membership (OWNER)
      vi.spyOn(prisma.workspaceMember, 'findUnique').mockResolvedValue({
        id: 'mem_1', workspaceId: 'ws_1', userId: 'user_1', role: 'OWNER', createdAt: new Date(), updatedAt: new Date(),
      } as any);
      
      // No explicit project membership
      vi.spyOn(prisma.projectMember, 'findUnique').mockResolvedValue(null);

      const middleware = requireProjectRole('ADMIN');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.projectMembership).toMatchObject({
        role: 'ADMIN',
        isImplicitAdmin: true,
      });
    });

    it('DENIES workspace ADMIN accessing project implicitly (no longer granted)', async () => {
      // Workspace membership (ADMIN)
      vi.spyOn(prisma.workspaceMember, 'findUnique').mockResolvedValue({
        id: 'mem_1', workspaceId: 'ws_1', userId: 'user_1', role: 'ADMIN', createdAt: new Date(), updatedAt: new Date(),
      } as any);
      
      // No explicit project membership
      vi.spyOn(prisma.projectMember, 'findUnique').mockResolvedValue(null);

      const middleware = requireProjectRole('ADMIN');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('ALLOWS workspace ADMIN to access project with explicit ADMIN project record', async () => {
      // Workspace membership (ADMIN)
      vi.spyOn(prisma.workspaceMember, 'findUnique').mockResolvedValue({
        id: 'mem_1', workspaceId: 'ws_1', userId: 'user_1', role: 'ADMIN', createdAt: new Date(), updatedAt: new Date(),
      } as any);
      
      // Explicit project membership (ADMIN)
      vi.spyOn(prisma.projectMember, 'findUnique').mockResolvedValue({
        id: 'pmem_1', projectId: 'proj_1', workspaceId: 'ws_1', userId: 'user_1', role: 'ADMIN', createdAt: new Date(), updatedAt: new Date(),
      } as any);

      const middleware = requireProjectRole('ADMIN');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.projectMembership).toMatchObject({
        role: 'ADMIN',
        isImplicitAdmin: false,
      });
    });

    it('DENIES workspace MEMBER accessing project requiring ADMIN implicitly', async () => {
      // Workspace membership (MEMBER)
      vi.spyOn(prisma.workspaceMember, 'findUnique').mockResolvedValue({
        id: 'mem_1', workspaceId: 'ws_1', userId: 'user_1', role: 'MEMBER', createdAt: new Date(), updatedAt: new Date(),
      } as any);
      
      // Explicit project membership (MEMBER)
      vi.spyOn(prisma.projectMember, 'findUnique').mockResolvedValue({
        id: 'pmem_1', projectId: 'proj_1', workspaceId: 'ws_1', userId: 'user_1', role: 'MEMBER', createdAt: new Date(), updatedAt: new Date(),
      } as any);

      const middleware = requireProjectRole('ADMIN');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
