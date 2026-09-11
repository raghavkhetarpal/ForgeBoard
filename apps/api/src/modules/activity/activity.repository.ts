import prisma from '../../infrastructure/prisma';
import { Prisma } from '@prisma/client';

export class ActivityRepository {
  // STRICTLY APPEND-ONLY: No update or delete methods exist in this repository.
  
  async createActivity(data: {
    projectId: string;
    workspaceId: string;
    actorId?: string | null;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: any;
  }) {
    return prisma.activity.create({
      data: {
        projectId: data.projectId,
        workspaceId: data.workspaceId,
        actorId: data.actorId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      include: {
        actor: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        }
      }
    });
  }

  async getActivities(projectId: string, limit: number = 50, cursor?: string) {
    const args: Prisma.ActivityFindManyArgs = {
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        }
      }
    };

    if (cursor) {
      args.cursor = { id: cursor };
      args.skip = 1;
    }

    return prisma.activity.findMany(args);
  }
}

export const activityRepository = new ActivityRepository();
