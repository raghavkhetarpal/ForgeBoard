import { commentsRepository } from './comments.repository';
import { AppError } from '../../infrastructure/errors';
import { CommentDto } from '@forgeboard/types';
import prisma from '../../infrastructure/prisma';
import { extractMentions } from './mentions.util';
import { notificationsService } from '../notifications/notifications.service';
import { issuesRepository } from '../issues/issues.repository';

export class CommentsService {

  private async processMentions(projectId: string, commentId: string, authorId: string, content: string) {
    try {
      const emails = extractMentions(content);
      if (emails.length === 0) return;
      
      const users = await prisma.user.findMany({ where: { email: { in: emails } } });
      
      for (const user of users) {
        if (user.id === authorId) continue; // no self-mentions
        
        const isMember = await issuesRepository.isProjectMember(projectId, user.id);
        if (isMember) {
          try {
            await notificationsService.createNotification(user.id, 'MENTION', 'COMMENT', commentId, 'You were mentioned in a comment');
          } catch (notificationError) {
            console.error('Failed to create mention notification:', notificationError);
          }
        }
      }
    } catch (error) {
      console.error('Failed to process mentions:', error);
    }
  }

  async createComment(projectId: string, issueId: string, authorId: string, content: string): Promise<CommentDto> {
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue || issue.projectId !== projectId) {
      throw new AppError('Issue not found or belongs to a different project', 400, 'BAD_REQUEST');
    }
    
    const comment = await commentsRepository.create({
      issueId,
      authorId,
      content,
    });
    await this.processMentions(projectId, comment.id, authorId, content);
    return comment;

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

    const updated = await commentsRepository.update(commentId, { content, edited: true });
    await this.processMentions(projectId, commentId, authorId, content);
    return updated;
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
