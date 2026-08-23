import { notificationsRepository } from './notifications.repository';
import { AppError } from '../../infrastructure/errors';
import { NotificationDto, NotificationType } from '@forgeboard/types';

export class NotificationsService {
  async createNotification(userId: string, type: NotificationType, sourceType: string, sourceId: string, message: string): Promise<NotificationDto> {
    return notificationsRepository.create({
      userId,
      type,
      sourceType,
      sourceId,
      message
    });
  }

  async listNotifications(userId: string, read?: boolean, limit?: number, offset?: number): Promise<NotificationDto[]> {
    return notificationsRepository.findByUserId(userId, read, limit, offset);
  }

  async markAsRead(userId: string, notificationId: string): Promise<NotificationDto> {
    const notification = await notificationsRepository.findById(notificationId);
    if (!notification || notification.userId !== userId) {
      throw new AppError('Notification not found', 404, 'NOT_FOUND');
    }
    return notificationsRepository.markAsRead(notificationId);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await notificationsRepository.markAllAsRead(userId);
  }
}

export const notificationsService = new NotificationsService();
