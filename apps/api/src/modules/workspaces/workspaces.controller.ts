import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { WorkspacesService, workspacesService } from './workspaces.service';
import {
  createWorkspaceSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
} from './workspaces.validation';
import { AppError } from '../../infrastructure/errors';

export class WorkspacesController {
  constructor(private service: WorkspacesService = workspacesService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        return;
      }

      const parsed = createWorkspaceSchema.parse(req.body);
      const result = await this.service.createWorkspace(req.user.id, parsed);

      res.status(201).json({ data: result });
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: error.errors } });
        return;
      }
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        return;
      }

      const workspaces = await this.service.getUserWorkspaces(req.user.id);
      res.status(200).json({ data: { workspaces } });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        return;
      }

      const workspaceId = req.params.workspaceId || req.params.id;
      const result = await this.service.getWorkspace(workspaceId, req.user.id);

      res.status(200).json({ data: result });
    } catch (error: unknown) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      next(error);
    }
  };

  inviteMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        return;
      }

      const workspaceId = req.params.workspaceId || req.params.id;
      const parsed = inviteMemberSchema.parse(req.body);
      const result = await this.service.inviteMember(
        workspaceId,
        req.user.id,
        req.user.name,
        parsed,
      );

      res.status(201).json({ data: result });
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: error.errors } });
        return;
      }
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      next(error);
    }
  };

  updateRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        return;
      }

      const workspaceId = req.params.workspaceId;
      const memberId = req.params.memberId;
      const parsed = updateMemberRoleSchema.parse(req.body);

      const result = await this.service.updateMemberRole(
        workspaceId,
        memberId,
        req.user.id,
        parsed,
      );

      res.status(200).json({ data: result });
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: error.errors } });
        return;
      }
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      next(error);
    }
  };

  removeMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        return;
      }

      const workspaceId = req.params.workspaceId;
      const memberId = req.params.memberId;

      const result = await this.service.removeMember(workspaceId, memberId, req.user.id);
      res.status(200).json({ data: result });
    } catch (error: unknown) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      next(error);
    }
  };

  leave = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        return;
      }

      const workspaceId = req.params.workspaceId || req.params.id;
      const result = await this.service.leaveWorkspace(workspaceId, req.user.id);

      res.status(200).json({ data: result });
    } catch (error: unknown) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      next(error);
    }
  };
}

export const workspacesController = new WorkspacesController();
