import { Request, Response, NextFunction } from 'express';
import { labelsService } from './labels.service';
import { createLabelSchema, updateLabelSchema } from './labels.validation';
import { z } from 'zod';

export class LabelsController {
  createLabel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectId = req.params.projectId;
      const data = createLabelSchema.parse(req.body);
      const label = await labelsService.createLabel(projectId, data);
      res.status(201).json({ label });
    } catch (error) {
      next(error);
    }
  };

  listLabels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectId = req.params.projectId;
      const labels = await labelsService.listLabels(projectId);
      res.status(200).json({ labels });
    } catch (error) {
      next(error);
    }
  };

  updateLabel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, labelId } = req.params;
      const data = updateLabelSchema.parse(req.body);
      const label = await labelsService.updateLabel(projectId, labelId, data);
      res.status(200).json({ label });
    } catch (error) {
      next(error);
    }
  };

  deleteLabel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, labelId } = req.params;
      await labelsService.deleteLabel(projectId, labelId);
      res.status(200).json({ success: true, message: 'Label deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  attachLabel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, issueId } = req.params;
      const labelId = z.string().parse(req.body.labelId);
      await labelsService.attachToIssue(projectId, issueId, labelId);
      res.status(200).json({ success: true, message: 'Label attached successfully' });
    } catch (error) {
      next(error);
    }
  };

  removeLabel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, issueId, labelId } = req.params;
      await labelsService.removeFromIssue(projectId, issueId, labelId);
      res.status(200).json({ success: true, message: 'Label removed successfully' });
    } catch (error) {
      next(error);
    }
  };
}

export const labelsController = new LabelsController();
