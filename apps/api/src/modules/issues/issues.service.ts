import { issuesRepository } from './issues.repository';
import { AppError } from '../../infrastructure/errors';
import { IssueDto } from '@forgeboard/types';

export class IssuesService {
  async createIssue(projectId: string, workspaceId: string, creatorId: string, data: any): Promise<IssueDto> {
    if (data.assigneeId) {
      const isValidAssignee = await issuesRepository.isProjectMember(projectId, data.assigneeId);
      if (!isValidAssignee) {
        throw new AppError('Assignee must be a member of the project.', 400, 'BAD_REQUEST');
      }
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

  async updateIssue(projectId: string, issueId: string, data: any): Promise<IssueDto> {
    const issue = await issuesRepository.findById(issueId);
    if (!issue || issue.projectId !== projectId) {
      throw new AppError('Issue not found', 404, 'NOT_FOUND');
    }

    if (data.assigneeId && data.assigneeId !== issue.assigneeId) {
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
}

export const issuesService = new IssuesService();
