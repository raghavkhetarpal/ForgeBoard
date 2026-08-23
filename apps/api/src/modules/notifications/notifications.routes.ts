import { Router } from 'express';
import { notificationsController } from './notifications.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', notificationsController.listNotifications);
router.post('/read-all', notificationsController.markAllAsRead);
router.patch('/:notificationId/read', notificationsController.markAsRead);

export default router;
