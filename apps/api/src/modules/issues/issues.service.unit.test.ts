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
      vi.mocked(issuesRepository.getMaxPosition).mockResolvedValue(0);
      vi.mocked(issuesRepository.create).mockResolvedValue({ id: 'issue1' } as unknown as import('@forgeboard/types').IssueDto);
      
      const result = await issuesService.createIssue('proj1', 'ws1', 'user1', { title: 'Test', assigneeId: 'member1' });
      
      expect(result.id).toBe('issue1');
      expect(issuesRepository.create).toHaveBeenCalledWith({
        position: 1024,
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
      vi.mocked(issuesRepository.findById).mockResolvedValue({ id: 'issue1', projectId: 'proj1', assigneeId: 'user1' } as unknown as import('@forgeboard/types').IssueDto);
      vi.mocked(issuesRepository.isProjectMember).mockResolvedValue(false);
      
      await expect(
        issuesService.updateIssue('proj1', 'issue1', { assigneeId: 'non_member' }, 'user1')
      ).rejects.toThrow(AppError);
    });

    it('allows updating if assignee is not changing, without calling isProjectMember', async () => {
      vi.mocked(issuesRepository.findById).mockResolvedValue({ id: 'issue1', projectId: 'proj1', assigneeId: 'user1' } as unknown as import('@forgeboard/types').IssueDto);
      vi.mocked(issuesRepository.update).mockResolvedValue({ id: 'issue1' } as unknown as import('@forgeboard/types').IssueDto);
      
      await issuesService.updateIssue('proj1', 'issue1', { assigneeId: 'user1', title: 'New title' }, 'user1');
      
      expect(issuesRepository.isProjectMember).not.toHaveBeenCalled();
      expect(issuesRepository.update).toHaveBeenCalledWith('issue1', { assigneeId: 'user1', title: 'New title' });
    });
  });
});

  describe('moveIssue', () => {
    it('moves to empty column (1024)', async () => {
      vi.mocked(issuesRepository.findById).mockResolvedValue({ id: 'issue1', projectId: 'proj1' } as unknown as import('@forgeboard/types').IssueDto);
      vi.mocked(issuesRepository.findIssuesByStatusOrdered).mockResolvedValue([]);
      vi.mocked(issuesRepository.update).mockResolvedValue({ id: 'issue1' } as unknown as import('@forgeboard/types').IssueDto);
      
      await issuesService.moveIssue('proj1', 'issue1', 'IN_PROGRESS', 0, 'user1');
      
      expect(issuesRepository.update).toHaveBeenCalledWith('issue1', { status: 'IN_PROGRESS', position: 1024 });
    });

    it('moves to top of non-empty column', async () => {
      vi.mocked(issuesRepository.findById).mockResolvedValue({ id: 'issue1', projectId: 'proj1' } as unknown as import('@forgeboard/types').IssueDto);
      vi.mocked(issuesRepository.findIssuesByStatusOrdered).mockResolvedValue([{ id: 'issue2', position: 1000 }]);
      vi.mocked(issuesRepository.update).mockResolvedValue({ id: 'issue1' } as unknown as import('@forgeboard/types').IssueDto);
      
      await issuesService.moveIssue('proj1', 'issue1', 'IN_PROGRESS', 0, 'user1');
      
      expect(issuesRepository.update).toHaveBeenCalledWith('issue1', { status: 'IN_PROGRESS', position: 500 });
    });

    it('moves to bottom of column', async () => {
      vi.mocked(issuesRepository.findById).mockResolvedValue({ id: 'issue1', projectId: 'proj1' } as unknown as import('@forgeboard/types').IssueDto);
      vi.mocked(issuesRepository.findIssuesByStatusOrdered).mockResolvedValue([{ id: 'issue2', position: 1000 }]);
      vi.mocked(issuesRepository.update).mockResolvedValue({ id: 'issue1' } as unknown as import('@forgeboard/types').IssueDto);
      
      await issuesService.moveIssue('proj1', 'issue1', 'IN_PROGRESS', 1, 'user1');
      
      expect(issuesRepository.update).toHaveBeenCalledWith('issue1', { status: 'IN_PROGRESS', position: 2024 });
    });

    it('moves between two existing issues', async () => {
      vi.mocked(issuesRepository.findById).mockResolvedValue({ id: 'issue1', projectId: 'proj1' } as unknown as import('@forgeboard/types').IssueDto);
      vi.mocked(issuesRepository.findIssuesByStatusOrdered).mockResolvedValue([
        { id: 'issue2', position: 1000 },
        { id: 'issue3', position: 2000 }
      ]);
      vi.mocked(issuesRepository.update).mockResolvedValue({ id: 'issue1' } as unknown as import('@forgeboard/types').IssueDto);
      
      await issuesService.moveIssue('proj1', 'issue1', 'IN_PROGRESS', 1, 'user1');
      
      expect(issuesRepository.update).toHaveBeenCalledWith('issue1', { status: 'IN_PROGRESS', position: 1500 });
    });
  });
