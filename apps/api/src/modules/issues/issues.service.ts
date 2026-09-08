import { issuesRepository } from './issues.repository';
import { AppError } from '../../infrastructure/errors';
import { IssueDto } from '@forgeboard/types';
import { Prisma } from '@prisma/client';
import { getSocketServer } from '../../infrastructure/socket';

export class IssuesService {
  async createIssue(projectId: string, workspaceId: string, creatorId: string, data: Omit<Prisma.IssueUncheckedCreateInput, 'workspaceId' | 'projectId' | 'creatorId'>): Promise<IssueDto> {
    if (data.assigneeId) {
      const isValidAssignee = await issuesRepository.isProjectMember(projectId, data.assigneeId);
      if (!isValidAssignee) {
        throw new AppError('Assignee must be a member of the project.', 400, 'BAD_REQUEST');
      }
    }

    if (data.position === undefined) {
      const maxPos = await issuesRepository.getMaxPosition(projectId, data.status ?? 'TODO');
      data.position = maxPos + 1024;
    }

    return issuesRepository.create({
      workspaceId,
      projectId,
      creatorId,
      ...data
    });
  }

  async getIssue(projectId: string, issueId: string): Promise<IssueDto> {
    const issue = await issuesRepository.findById(issueId);
    if (!issue || issue.projectId !== projectId) {
      throw new AppError('Issue not found', 404, 'NOT_FOUND');
    }
    return issue;
  }

  async listIssues(projectId: string, filters: { status?: string, priority?: string, assigneeId?: string }): Promise<IssueDto[]> {
    return issuesRepository.findMany(projectId, filters);
  }

  async updateIssue(projectId: string, issueId: string, data: Prisma.IssueUncheckedUpdateInput): Promise<IssueDto> {
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

    return issuesRepository.update(issueId, data);
  }

  async deleteIssue(projectId: string, issueId: string): Promise<void> {
    const issue = await issuesRepository.findById(issueId);
    if (!issue || issue.projectId !== projectId) {
      throw new AppError('Issue not found', 404, 'NOT_FOUND');
    }
    await issuesRepository.delete(issueId);
  }

  async moveIssue(projectId: string, issueId: string, status: string, targetIndex: number): Promise<IssueDto> {
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