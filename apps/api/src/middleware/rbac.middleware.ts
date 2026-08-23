import { Request, Response, NextFunction } from 'express';
import { WorkspaceRole, ROLE_HIERARCHY, WorkspaceMembershipContext, ProjectRole, PROJECT_ROLE_HIERARCHY, ProjectMembershipContext } from '@forgeboard/types';
import prisma from '../infrastructure/prisma';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      membership?: WorkspaceMembershipContext;
      projectMembership?: ProjectMembershipContext;
    }
  }
}

/**
 * Higher-order middleware that enforces a minimum WorkspaceRole for a given workspace.
 * Re-derives the requester's membership and role from the database on every invocation.
 *
 * @param minRole Minimum role required ('OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER')
 */
export function requireWorkspaceRole(minRole: WorkspaceRole) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required before checking workspace permissions.',
        },
      });
      return;
    }

    // Resolve workspaceId from request params, headers, or body
    const workspaceId =
      req.params.workspaceId ||
      req.params.id ||
      (req.headers['x-workspace-id'] as string) ||
      req.body?.workspaceId ||
      (req.query?.workspaceId as string);

    if (!workspaceId) {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Workspace identifier is required for this action.',
        },
      });
      return;
    }

    try {
      // Re-derive role directly from DB (never trust client claim)
      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: req.user.id,
          },
        },
      });

      if (!membership) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'You are not a member of this workspace.',
          },
        });
        return;
      }

      const userRoleRank = ROLE_HIERARCHY[membership.role as WorkspaceRole];
      const requiredRoleRank = ROLE_HIERARCHY[minRole];

      if (!userRoleRank || userRoleRank < requiredRoleRank) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: `Insufficient permissions. Required minimum role: ${minRole}, your role: ${membership.role}.`,
          },
        });
        return;
      }

      req.membership = {
        workspaceId: membership.workspaceId,
        userId: membership.userId,
        role: membership.role as WorkspaceRole,
      };

      next();
    } catch (error) {
      console.error('Error verifying workspace role:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to verify workspace permissions.',
        },
      });
    }
  };
}

/**
 * Higher-order middleware that enforces a minimum ProjectRole for a given project.
 * Checks ProjectMember, but falls back to WorkspaceMember because Workspace OWNER/ADMIN
 * have implicit Project ADMIN access.
 *
 * @param minRole Minimum role required ('ADMIN' | 'MEMBER' | 'VIEWER')
 */
export function requireProjectRole(minRole: ProjectRole) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required before checking project permissions.',
        },
      });
      return;
    }

    const projectId = req.params.projectId || req.params.id;
    if (!projectId) {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Project identifier is required for this action.',
        },
      });
      return;
    }

    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { workspaceId: true },
      });

      if (!project) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Project not found.' },
        });
        return;
      }

      // 1. Check if user is a workspace OWNER or ADMIN.
      // If so, they have implicit full project access (equivalent to Project ADMIN).
      const workspaceMembership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: project.workspaceId,
            userId: req.user.id,
          },
        },
      });

      let effectiveRole: ProjectRole | null = null;
      let isImplicitAdmin = false;

      if (workspaceMembership && workspaceMembership.role === 'OWNER') {
        effectiveRole = 'ADMIN';
        isImplicitAdmin = true;
      } else {
        // 2. Check explicit project membership
        const projectMembership = await prisma.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId,
              userId: req.user.id,
            },
          },
        });

        if (projectMembership) {
          effectiveRole = projectMembership.role as ProjectRole;
        } else if (!workspaceMembership) {
           res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'You are not a member of this workspace.',
            },
          });
          return;
        }
      }

      if (!effectiveRole) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have access to this project.',
          },
        });
        return;
      }

      const userRoleRank = PROJECT_ROLE_HIERARCHY[effectiveRole];
      const requiredRoleRank = PROJECT_ROLE_HIERARCHY[minRole];

      if (userRoleRank < requiredRoleRank) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: `Insufficient project permissions. Required: ${minRole}, your role: ${effectiveRole}.`,
          },
        });
        return;
      }

      req.projectMembership = {
        projectId,
        workspaceId: project.workspaceId,
        userId: req.user.id,
        role: effectiveRole,
        isImplicitAdmin,
      };

      next();
    } catch (error) {
      console.error('Error verifying project role:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to verify project permissions.',
        },
      });
    }
  };
}
