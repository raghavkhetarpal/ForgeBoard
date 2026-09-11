import { issuesRepository, IssueFilters, PaginatedIssuesResult } from './issues.repository';
import { AppError } from '../../infrastructure/errors';
import { activityService } from '../activity/activity.service';
import { IssueDto } from '@forgeboard/types';
import { Prisma } from '@prisma/client';
import { getSocketServer } from '../../infrastructure/socket';
import prisma from '../../infrastructure/prisma';

export class IssuesService {
  async createIssue(projectId: string, workspaceId: string, creatorId: string, data: Omit<Prisma.IssueUncheckedCreateInput, 'workspaceId' | 'projectId' | 'creatorId'>): Promise<IssueDto> {
    if (data.assigneeId) {
      const isValidAssignee = await issuesRepository.isProjectMember(projectId, data.assigneeId);
      if (!isValidAssignee) {
        throw new AppError('Assignee must be a member of the project.', 400, 'BAD_REQUEST');
      }
    }

    if (data.milestoneId) {
      const milestone = await prisma.milestone.findUnique({ where: { id: data.milestoneId } });
      if (!milestone || milestone.projectId !== projectId) {
        throw new AppError('Milestone not found or belongs to another project', 400, 'BAD_REQUEST');
      }
    }

    if (data.position === undefined) {
      const maxPos = await issuesRepository.getMaxPosition(projectId, data.status ?? 'TODO');
      data.position = maxPos + 1024;
    }

    const created = await issuesRepository.create({
      workspaceId,
      projectId,
      creatorId,
      ...data
    });
    void activityService.logActivity({
      projectId,
      workspaceId,
      actorId: creatorId,
      action: 'ISSUE_CREATED',
      targetType: 'ISSUE',
      targetId: created.id
    });

    try {
      getSocketServer().to(`project:${projectId}`).emit('issue:created', { issue: created });
    } catch (e) {
      console.error('Failed to emit issue:created event', e);
    }

    return created;
  }

  async getIssue(projectId: string, issueId: string): Promise<IssueDto> {
    const issue = await issuesRepository.findById(issueId);
    if (!issue || issue.projectId !== projectId) {
      throw new AppError('Issue not found', 404, 'NOT_FOUND');
    }
    return issue;
  }

  async listIssues(projectId: string, filters: IssueFilters = {}): Promise<PaginatedIssuesResult> {
    return issuesRepository.findMany(projectId, filters);
  }

  async updateIssue(projectId: string, issueId: string, data: Prisma.IssueUncheckedUpdateInput, actorId: string): Promise<IssueDto> {
    const issue = await issuesRepository.findById(issueId);
    if (!issue || issue.projectId !== projectId) {
      throw new AppError('Issue not found', 404, 'NOT_FOUND');
    }

    if (data.assigneeId && typeof data.assigneeId === 'string' && data.assigneeId !== issue.assigneeId) {
      const isValidAssignee = await issuesRepository.isProjectMember(projectId, data.assigneeId);
      if (!isValidAssignee) {
        throw new AppError('Assignee must be a member of the project.', 400, 'BAD_REQUEST');
      }
    }

    if (data.milestoneId && typeof data.milestoneId === 'string' && data.milestoneId !== issue.milestoneId) {
      const milestone = await prisma.milestone.findUnique({ where: { id: data.milestoneId } });
      if (!milestone || milestone.projectId !== projectId) {
        throw new AppError('Milestone not found or belongs to another project', 400, 'BAD_REQUEST');
      }
    }

    const updated = await issuesRepository.update(issueId, data);
    
    if (data.status && data.status !== issue.status) {
      void activityService.logActivity({ projectId, workspaceId: issue.workspaceId, actorId, action: 'ISSUE_STATUS_CHANGED', targetType: 'ISSUE', targetId: issue.id, metadata: { from: issue.status, to: updated.status } });
    }
    if (data.assigneeId !== undefined && data.assigneeId !== issue.assigneeId) {
      void activityService.logActivity({ projectId, workspaceId: issue.workspaceId, actorId, action: data.assigneeId === null ? 'ISSUE_UNASSIGNED' : 'ISSUE_ASSIGNED', targetType: 'ISSUE', targetId: issue.id, metadata: { from: issue.assigneeId, to: updated.assigneeId } });
    }
    if (data.priority && data.priority !== issue.priority) {
      void activityService.logActivity({ projectId, workspaceId: issue.workspaceId, actorId, action: 'ISSUE_PRIORITY_CHANGED', targetType: 'ISSUE', targetId: issue.id, metadata: { from: issue.priority, to: updated.priority } });
    }
    
    try {
      getSocketServer().to(`project:${projectId}`).emit('issue:updated', { issue: updated });
    } catch (e) {
      console.error('Failed to emit issue:updated event', e);
    }

    return updated;
  }

  async deleteIssue(projectId: string, issueId: string): Promise<void> {
    const issue = await issuesRepository.findById(issueId);
    if (!issue || issue.projectId !== projectId) {
      throw new AppError('Issue not found', 404, 'NOT_FOUND');
    }
    await issuesRepository.delete(issueId);

    try {
      getSocketServer().to(`project:${projectId}`).emit('issue:deleted', { issueId, projectId });
    } catch (e) {
      console.error('Failed to emit issue:deleted event', e);
    }
  }

  async moveIssue(projectId: string, issueId: string, status: string, targetIndex: number, actorId: string): Promise<IssueDto> {
    const issue = await issuesRepository.findById(issueId);
    if (!issue || issue.projectId !== projectId) {
      throw new AppError('Issue not found', 404, 'NOT_FOUND');
    }

    const columnIssues = await issuesRepository.findIssuesByStatusOrdered(projectId, status);
    
    // Remove the current issue from the column if it's already there (moving within same column)
    const filteredIssues = columnIssues.filter(i => i.id !== issueId);
    
    let newPosition: number;
    if (filteredIssues.length === 0) {
      // Empty column
      newPosition = 1024;
    } else if (targetIndex <= 0) {
      // Move to top
      newPosition = filteredIssues[0].position / 2;
    } else if (targetIndex >= filteredIssues.length) {
      // Move to bottom
      newPosition = filteredIssues[filteredIssues.length - 1].position + 1024;
    } else {
      // Insert between two existing issues
      const prev = filteredIssues[targetIndex - 1];
      const next = filteredIssues[targetIndex];
      newPosition = (prev.position + next.position) / 2;
    }

    const updatedIssue = await issuesRepository.update(issueId, { status: status as Prisma.EnumIssueStatusFieldUpdateOperationsInput, position: newPosition });

    if (status && status !== issue.status) {
      void activityService.logActivity({
        projectId,
        workspaceId: issue.workspaceId,
        actorId,
        action: 'ISSUE_STATUS_CHANGED',
        targetType: 'ISSUE',
        targetId: issue.id,
        metadata: { from: issue.status, to: updatedIssue.status }
      });
    }
    
    // Broadcast the update to all clients in the project room
    try {
      getSocketServer().to(`project:${projectId}`).emit('issue:updated', { issue: updatedIssue });
    } catch (e) {
      console.error('Failed to emit issue:updated event', e);
    }
    
    return updatedIssue;
  }

}

export const issuesService = new IssuesService();