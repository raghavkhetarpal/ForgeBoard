import { describe, it, expect, vi, beforeEach } from 'vitest';
import { issuesService } from './issues.service';
import { issuesRepository } from './issues.repository';
import { AppError } from '../../infrastructure/errors';

vi.mock('./issues.repository');

describe('IssuesService Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createIssue', () => {
    it('throws error if assignee is not a project member', async () => {
      vi.mocked(issuesRepository.isProjectMember).mockResolvedValue(false);
      
      await expect(
        issuesService.createIssue('proj1', 'ws1', 'user1', { title: 'Test', assigneeId: 'non_member' })
      ).rejects.toThrow(AppError);
    });

    it('creates issue if assignee is a project member', async () => {
      vi.mocked(issuesRepository.isProjectMember).mockResolvedValue(true);
      vi.mocked(issuesRepository.create).mockResolvedValue({ id: 'issue1' } as any);
      
      const result = await issuesService.createIssue('proj1', 'ws1', 'user1', { title: 'Test', assigneeId: 'member1' });
      
      expect(result.id).toBe('issue1');
      expect(issuesRepository.create).toHaveBeenCalledWith({
        workspaceId: 'ws1',
        projectId: 'proj1',
        creatorId: 'user1',
        title: 'Test',
        assigneeId: 'member1'
      });
    });
  });

  describe('updateIssue', () => {
    it('throws error if new assignee is not a project member', async () => {
      vi.mocked(issuesRepository.findById).mockResolvedValue({ id: 'issue1', projectId: 'proj1', assigneeId: 'user1' } as any);
      vi.mocked(issuesRepository.isProjectMember).mockResolvedValue(false);
      
      await expect(
        issuesService.updateIssue('proj1', 'issue1', { assigneeId: 'non_member' })
      ).rejects.toThrow(AppError);
    });

    it('allows updating if assignee is not changing, without calling isProjectMember', async () => {
      vi.mocked(issuesRepository.findById).mockResolvedValue({ id: 'issue1', projectId: 'proj1', assigneeId: 'user1' } as any);
      vi.mocked(issuesRepository.update).mockResolvedValue({ id: 'issue1' } as any);
      
      await issuesService.updateIssue('proj1', 'issue1', { assigneeId: 'user1', title: 'New title' });
      
      expect(issuesRepository.isProjectMember).not.toHaveBeenCalled();
      expect(issuesRepository.update).toHaveBeenCalledWith('issue1', { assigneeId: 'user1', title: 'New title' });
    });
  });
});
