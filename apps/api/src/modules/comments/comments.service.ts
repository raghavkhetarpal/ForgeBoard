import { commentsRepository } from './comments.repository';
import { AppError } from '../../infrastructure/errors';
import { CommentDto } from '@forgeboard/types';
import prisma from '../../infrastructure/prisma';

export class CommentsService {
  async createComment(projectId: string, issueId: string, authorId: string, content: string): Promise<CommentDto> {
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue || issue.projectId !== projectId) {
      throw new AppError('Issue not found or belongs to a different project', 400, 'BAD_REQUEST');
    }
    
    return commentsRepository.create({
      issueId,
      authorId,
      content,
    });
  }

  async listComments(projectId: string, issueId: string): Promise<CommentDto[]> {
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue || issue.projectId !== projectId) {
      throw new AppError('Issue not found or belongs to a different project', 400, 'BAD_REQUEST');
    }
    return commentsRepository.findByIssueId(issueId);
  }

  async updateComment(projectId: string, issueId: string, commentId: string, authorId: string, content: string): Promise<CommentDto> {
    const comment = await commentsRepository.findById(commentId);
    if (!comment || comment.issueId !== issueId) {
      throw new AppError('Comment not found on this issue', 404, 'NOT_FOUND');
    }

    if (comment.authorId !== authorId) {
      throw new AppError('Only the author can edit this comment', 403, 'FORBIDDEN');
    }

    // Verify issue project
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue || issue.projectId !== projectId) {
      throw new AppError('Issue not found or belongs to a different project', 400, 'BAD_REQUEST');
    }

    return commentsRepository.update(commentId, { content, edited: true });
  }

  async deleteComment(projectId: string, issueId: string, commentId: string, userId: string, isProjectAdmin: boolean): Promise<void> {
    const comment = await commentsRepository.findById(commentId);
    if (!comment || comment.issueId !== issueId) {
      throw new AppError('Comment not found on this issue', 404, 'NOT_FOUND');
    }

    if (comment.authorId !== userId && !isProjectAdmin) {
      throw new AppError('Only the author or a project admin can delete this comment', 403, 'FORBIDDEN');
    }

    // Verify issue project
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue || issue.projectId !== projectId) {
      throw new AppError('Issue not found or belongs to a different project', 400, 'BAD_REQUEST');
    }

    await commentsRepository.delete(commentId);
  }
}

export const commentsService = new CommentsService();
