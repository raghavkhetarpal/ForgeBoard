import { activityRepository } from './activity.repository';

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
      await activityRepository.createActivity(data);
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
