import prisma from '../../infrastructure/prisma';
import { Prisma } from '@prisma/client';
import { NotificationDto } from '@forgeboard/types';

export class NotificationsRepository {
  async create(data: Prisma.NotificationUncheckedCreateInput): Promise<NotificationDto> {
    return prisma.notification.create({ data });
  }

  async findByUserId(userId: string, read?: boolean, limit: number = 50, offset: number = 0): Promise<NotificationDto[]> {
    const where: Prisma.NotificationWhereInput = { userId };
    if (read !== undefined) {
      where.read = read;
    }
    
    return prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async findById(id: string): Promise<NotificationDto | null> {
    return prisma.notification.findUnique({ where: { id } });
  }

  async markAsRead(id: string): Promise<NotificationDto> {
    return prisma.notification.update({
      where: { id },
      data: { read: true }
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true }
    });
  }
}

export const notificationsRepository = new NotificationsRepository();
