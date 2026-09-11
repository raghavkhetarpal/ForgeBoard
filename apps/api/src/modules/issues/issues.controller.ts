import { Request, Response, NextFunction } from 'express';
import { issuesService } from './issues.service';
import { createIssueSchema, updateIssueSchema, listIssuesSchema, moveIssueSchema } from './issues.validation';
import { AppError } from '../../infrastructure/errors';

export class IssuesController {
  createIssue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectId = req.params.projectId;
      const workspaceId = req.projectMembership?.workspaceId;
      if (!workspaceId) throw new AppError('Workspace context missing', 500, 'INTERNAL_ERROR');

      const data = createIssueSchema.parse(req.body);
      const issue = await issuesService.createIssue(projectId, workspaceId, req.user!.id, data);
      res.status(201).json({ issue });
    } catch (error) {
      next(error);
    }
  };

  getIssue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, issueId } = req.params;
      const issue = await issuesService.getIssue(projectId, issueId);
      res.status(200).json({ issue });
    } catch (error) {
      next(error);
    }
  };

  listIssues = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectId = req.params.projectId;
      const filters = listIssuesSchema.parse(req.query);
      const result = await issuesService.listIssues(projectId, filters);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  updateIssue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, issueId } = req.params;
      const data = updateIssueSchema.parse(req.body);
      const issue = await issuesService.updateIssue(projectId, issueId, data, req.user!.id);
      res.status(200).json({ issue });
    } catch (error) {
      next(error);
    }
  };

  deleteIssue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, issueId } = req.params;
      await issuesService.deleteIssue(projectId, issueId);
      res.status(200).json({ success: true, message: 'Issue deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  moveIssue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, issueId } = req.params;
      const { status, position } = moveIssueSchema.parse(req.body);
      const issue = await issuesService.moveIssue(projectId, issueId, status, position, req.user!.id);
      res.status(200).json({ issue });
    } catch (error) {
      next(error);
    }
  };
}

export const issuesController = new IssuesController();
