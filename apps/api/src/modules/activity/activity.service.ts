import { activityRepository } from './activity.repository';
import { getSocketServer } from '../../infrastructure/socket';

export class ActivityService {
  /**
   * Internal reusable function for logging activity.
   * Fail-safe: Wrapped in try/catch so it never throws and never blocks the primary action.
   */
  async logActivity(data: {
    projectId: string;
    workspaceId: string;
    actorId?: string | null;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: any;
  }): Promise<void> {
    try {
      const activity = await activityRepository.createActivity(data);
      try {
        getSocketServer().to(`project:${data.projectId}`).emit('activity:created', { activity });
      } catch (e) {
        console.error('[ActivityService] Failed to emit activity:created:', e);
      }
    } catch (error) {
      // Log the error silently, do not rethrow to prevent breaking core flows
      console.error('[ActivityService] Failed to log activity:', error);
    }
  }

  async getActivities(projectId: string, limit?: number, cursor?: string) {
    return activityRepository.getActivities(projectId, limit, cursor);
  }
}

export const activityService = new ActivityService();
