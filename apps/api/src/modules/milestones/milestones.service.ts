import { milestonesRepository } from './milestones.repository';
import { AppError } from '../../infrastructure/errors';
import { MilestoneWithProgressDto, CreateMilestoneInput, UpdateMilestoneInput } from '@forgeboard/types';
import { activityService } from '../activity/activity.service';
import { getSocketServer } from '../../infrastructure/socket';

export class MilestonesService {
  async createMilestone(projectId: string, workspaceId: string, actorId: string, input: CreateMilestoneInput): Promise<MilestoneWithProgressDto> {
    const existing = await milestonesRepository.findByProjectAndName(projectId, input.name);
    if (existing) {
      throw new AppError('Milestone with this name already exists in the project', 400, 'BAD_REQUEST');
    }

    const milestone = await milestonesRepository.create({
      projectId,
      name: input.name,
      description: input.description,
      status: input.status,
      startDate: input.startDate ? new Date(input.startDate) : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    });

    void activityService.logActivity({
      projectId,
      workspaceId,
      actorId,
      action: 'MILESTONE_CREATED',
      targetType: 'MILESTONE',
      targetId: milestone.id,
      metadata: { name: milestone.name },
    });

    const result: MilestoneWithProgressDto = {
      ...milestone,
      totalIssues: 0,
      completedIssues: 0,
      openIssues: 0,
      progress: 0,
    };

    try {
      getSocketServer().to(`project:${projectId}`).emit('milestone:created', { milestone: result });
    } catch {
      // Socket emission is best-effort
    }

    return result;
  }

  async listMilestones(projectId: string): Promise<MilestoneWithProgressDto[]> {
    return milestonesRepository.findManyWithProgress(projectId);
  }

  async getMilestone(projectId: string, milestoneId: string): Promise<MilestoneWithProgressDto> {
    const milestone = await milestonesRepository.findByIdWithProgress(milestoneId);
    if (!milestone || milestone.projectId !== projectId) {
      throw new AppError('Milestone not found', 404, 'NOT_FOUND');
    }
    return milestone;
  }

  async updateMilestone(projectId: string, workspaceId: string, milestoneId: string, actorId: string, input: UpdateMilestoneInput): Promise<MilestoneWithProgressDto> {
    const existing = await milestonesRepository.findById(milestoneId);
    if (!existing || existing.projectId !== projectId) {
      throw new AppError('Milestone not found', 404, 'NOT_FOUND');
    }

    if (input.name && input.name !== existing.name) {
      const duplicate = await milestonesRepository.findByProjectAndName(projectId, input.name);
      if (duplicate) {
        throw new AppError('Milestone with this name already exists in the project', 400, 'BAD_REQUEST');
      }
    }

    await milestonesRepository.update(milestoneId, {
      name: input.name,
      description: input.description,
      status: input.status,
      startDate: input.startDate !== undefined ? (input.startDate ? new Date(input.startDate) : null) : undefined,
      dueDate: input.dueDate !== undefined ? (input.dueDate ? new Date(input.dueDate) : null) : undefined,
    });

    const updated = await milestonesRepository.findByIdWithProgress(milestoneId);
    if (!updated) {
      throw new AppError('Milestone not found after update', 404, 'NOT_FOUND');
    }

    void activityService.logActivity({
      projectId,
      workspaceId,
      actorId,
      action: input.status && input.status !== existing.status ? (input.status === 'CLOSED' ? 'MILESTONE_CLOSED' : 'MILESTONE_UPDATED') : 'MILESTONE_UPDATED',
      targetType: 'MILESTONE',
      targetId: milestoneId,
      metadata: { name: updated.name, status: updated.status },
    });

    try {
      getSocketServer().to(`project:${projectId}`).emit('milestone:updated', { milestone: updated });
    } catch {
      // Socket emission is best-effort
    }

    return updated;
  }

  async deleteMilestone(projectId: string, workspaceId: string, milestoneId: string, actorId: string): Promise<void> {
    const existing = await milestonesRepository.findById(milestoneId);
    if (!existing || existing.projectId !== projectId) {
      throw new AppError('Milestone not found', 404, 'NOT_FOUND');
    }

    await milestonesRepository.delete(milestoneId);

    void activityService.logActivity({
      projectId,
      workspaceId,
      actorId,
      action: 'MILESTONE_DELETED',
      targetType: 'MILESTONE',
      targetId: milestoneId,
      metadata: { name: existing.name },
    });

    try {
      getSocketServer().to(`project:${projectId}`).emit('milestone:deleted', { milestoneId, projectId });
    } catch {
      // Socket emission is best-effort
    }
  }
}

export const milestonesService = new MilestonesService();
