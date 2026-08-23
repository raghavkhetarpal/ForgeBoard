import { Request, Response, NextFunction } from 'express';
import { notificationsService } from './notifications.service';

export class NotificationsController {
  listNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const readQuery = req.query.read;
      
      let read: boolean | undefined = undefined;
      if (readQuery === 'true') read = true;
      if (readQuery === 'false') read = false;
      
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const notifications = await notificationsService.listNotifications(userId, read, limit, offset);
      res.status(200).json({ notifications });
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const notificationId = req.params.notificationId;
      const notification = await notificationsService.markAsRead(userId, notificationId);
      res.status(200).json({ notification });
    } catch (error) {
      next(error);
    }
  };

  markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      await notificationsService.markAllAsRead(userId);
      res.status(200).json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
      next(error);
    }
  };
}

export const notificationsController = new NotificationsController();
