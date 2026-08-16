import { Request, Response, NextFunction } from 'express';
import { WorkspaceRole, ROLE_HIERARCHY, WorkspaceMembershipContext } from '@forgeboard/types';
import prisma from '../infrastructure/prisma';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      membership?: WorkspaceMembershipContext;
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
