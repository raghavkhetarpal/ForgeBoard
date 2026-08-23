import { describe, it, expect, vi, beforeEach } from 'vitest';
import { commentsService } from './comments.service';
import { commentsRepository } from './comments.repository';
import prisma from '../../infrastructure/prisma';
import { AppError } from '../../infrastructure/errors';

vi.mock('./comments.repository');
vi.mock('../../infrastructure/prisma', () => ({
  default: {
    issue: { findUnique: vi.fn() }
  }
}));

describe('CommentsService Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateComment', () => {
    it('rejects if non-author tries to edit', async () => {
      vi.mocked(commentsRepository.findById).mockResolvedValue({ id: 'c1', issueId: 'i1', authorId: 'a1', content: 'test', edited: false, createdAt: new Date(), updatedAt: new Date() });
      
      await expect(commentsService.updateComment('p1', 'i1', 'c1', 'a2', 'new content'))
        .rejects.toThrowError(new AppError('Only the author can edit this comment', 403, 'FORBIDDEN'));
    });
  });

  describe('deleteComment', () => {
    it('rejects if non-author and non-admin tries to delete', async () => {
      vi.mocked(commentsRepository.findById).mockResolvedValue({ id: 'c1', issueId: 'i1', authorId: 'a1', content: 'test', edited: false, createdAt: new Date(), updatedAt: new Date() });
      
      await expect(commentsService.deleteComment('p1', 'i1', 'c1', 'a2', false))
        .rejects.toThrowError(new AppError('Only the author or a project admin can delete this comment', 403, 'FORBIDDEN'));
    });

    it('allows if non-author but is project admin', async () => {
      vi.mocked(commentsRepository.findById).mockResolvedValue({ id: 'c1', issueId: 'i1', authorId: 'a1', content: 'test', edited: false, createdAt: new Date(), updatedAt: new Date() });
      vi.mocked(prisma.issue.findUnique).mockResolvedValue({ id: 'i1', projectId: 'p1' } as never);
      vi.mocked(commentsRepository.delete).mockResolvedValue(undefined);
      
      await expect(commentsService.deleteComment('p1', 'i1', 'c1', 'a2', true)).resolves.toBeUndefined();
    });
  });
});
