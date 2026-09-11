import { Request, Response, NextFunction } from 'express';
import { milestonesService } from './milestones.service';
import { createMilestoneSchema, updateMilestoneSchema } from './milestones.validation';
import { AppError } from '../../infrastructure/errors';

export class MilestonesController {
  createMilestone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectId = req.params.projectId;
      const workspaceId = req.projectMembership?.workspaceId;
      if (!workspaceId) throw new AppError('Workspace context missing', 500, 'INTERNAL_ERROR');

      const data = createMilestoneSchema.parse(req.body);
      const milestone = await milestonesService.createMilestone(projectId, workspaceId, req.user!.id, data);
      res.status(201).json({ milestone });
    } catch (error) {
      next(error);
    }
  };

  listMilestones = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectId = req.params.projectId;
      const milestones = await milestonesService.listMilestones(projectId);
      res.status(200).json({ milestones });
    } catch (error) {
      next(error);
    }
  };

  getMilestone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, milestoneId } = req.params;
      const milestone = await milestonesService.getMilestone(projectId, milestoneId);
      res.status(200).json({ milestone });
    } catch (error) {
      next(error);
    }
  };

  updateMilestone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, milestoneId } = req.params;
      const workspaceId = req.projectMembership?.workspaceId;
      if (!workspaceId) throw new AppError('Workspace context missing', 500, 'INTERNAL_ERROR');

      const data = updateMilestoneSchema.parse(req.body);
      const milestone = await milestonesService.updateMilestone(projectId, workspaceId, milestoneId, req.user!.id, data);
      res.status(200).json({ milestone });
    } catch (error) {
      next(error);
    }
  };

  deleteMilestone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, milestoneId } = req.params;
      const workspaceId = req.projectMembership?.workspaceId;
      if (!workspaceId) throw new AppError('Workspace context missing', 500, 'INTERNAL_ERROR');

      await milestonesService.deleteMilestone(projectId, workspaceId, milestoneId, req.user!.id);
      res.status(200).json({ success: true, message: 'Milestone deleted successfully' });
    } catch (error) {
      next(error);
    }
  };
}

export const milestonesController = new MilestonesController();
