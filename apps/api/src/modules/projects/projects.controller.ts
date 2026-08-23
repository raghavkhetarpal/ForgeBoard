import { Request, Response, NextFunction } from 'express';
import { projectsService } from './projects.service';
import { createProjectSchema, updateProjectSchema, addProjectMemberSchema, updateProjectMemberSchema } from './projects.validation';
import { AppError } from '../../infrastructure/errors';

export class ProjectsController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.params.workspaceId;
      const data = createProjectSchema.parse(req.body);
      const project = await projectsService.createProject(workspaceId, data, req.user!.id);
      res.status(201).json({ project });
    } catch (error) {
      next(error);
    }
  }

  async listForWorkspace(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.params.workspaceId;
      const projects = await projectsService.listWorkspaceProjects(workspaceId);
      res.json({ projects });
    } catch (error) {
      next(error);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const project = await projectsService.getProject(req.params.projectId);
      res.json({ project });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateProjectSchema.parse(req.body);
      const project = await projectsService.updateProject(req.params.projectId, data);
      res.json({ project });
    } catch (error) {
      next(error);
    }
  }

  async archive(req: Request, res: Response, next: NextFunction) {
    try {
      const project = await projectsService.archiveProject(req.params.projectId);
      res.json({ project });
    } catch (error) {
      next(error);
    }
  }

  async addMember(req: Request, res: Response, next: NextFunction) {
    try {
      const data = addProjectMemberSchema.parse(req.body);
      // Note: requireProjectRole middleware guarantees req.projectMembership exists
      const workspaceId = req.projectMembership!.workspaceId;
      const member = await projectsService.addProjectMember(
        req.params.projectId,
        data.userId,
        data.role,
        workspaceId
      );
      res.status(201).json({ member });
    } catch (error) {
      next(error);
    }
  }

  async removeMember(req: Request, res: Response, next: NextFunction) {
    try {
      await projectsService.removeProjectMember(
        req.params.projectId,
        req.params.userId,
        req.projectMembership!.isImplicitAdmin
      );
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
}

export const projectsController = new ProjectsController();
