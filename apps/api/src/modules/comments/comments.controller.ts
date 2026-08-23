import { Request, Response, NextFunction } from 'express';
import { commentsService } from './comments.service';
import { createCommentSchema, updateCommentSchema } from './comments.validation';

export class CommentsController {
  createComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, issueId } = req.params;
      const authorId = req.user!.id;
      const { content } = createCommentSchema.parse(req.body);
      const comment = await commentsService.createComment(projectId, issueId, authorId, content);
      res.status(201).json({ comment });
    } catch (error) {
      next(error);
    }
  };

  listComments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, issueId } = req.params;
      const comments = await commentsService.listComments(projectId, issueId);
      res.status(200).json({ comments });
    } catch (error) {
      next(error);
    }
  };

  updateComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, issueId, commentId } = req.params;
      const authorId = req.user!.id;
      const { content } = updateCommentSchema.parse(req.body);
      const comment = await commentsService.updateComment(projectId, issueId, commentId, authorId, content);
      res.status(200).json({ comment });
    } catch (error) {
      next(error);
    }
  };

  deleteComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, issueId, commentId } = req.params;
      const userId = req.user!.id;
      const isProjectAdmin = req.projectMembership?.role === 'ADMIN';
      
      await commentsService.deleteComment(projectId, issueId, commentId, userId, isProjectAdmin);
      res.status(200).json({ success: true, message: 'Comment deleted successfully' });
    } catch (error) {
      next(error);
    }
  };
}

export const commentsController = new CommentsController();
