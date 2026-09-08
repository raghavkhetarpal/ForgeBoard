import { Request, Response, NextFunction } from 'express';
import { activityService } from './activity.service';

export class ActivityController {
  getActivities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const cursor = req.query.cursor as string | undefined;

      const activities = await activityService.getActivities(projectId, limit, cursor);
      res.json(activities);
    } catch (error) {
      next(error);
    }
  };
}

export const activityController = new ActivityController();
