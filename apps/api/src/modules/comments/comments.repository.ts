import prisma from '../../infrastructure/prisma';
import { Prisma } from '@prisma/client';
import { CommentDto } from '@forgeboard/types';

export class CommentsRepository {
  async create(data: Prisma.CommentUncheckedCreateInput): Promise<CommentDto> {
    return prisma.comment.create({
      data,
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true, updatedAt: true } }
      }
    });
  }

  async findByIssueId(issueId: string): Promise<CommentDto[]> {
    return prisma.comment.findMany({
      where: { issueId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true, updatedAt: true } }
      }
    });
  }

  async findById(id: string): Promise<CommentDto | null> {
    return prisma.comment.findUnique({ 
      where: { id },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true, updatedAt: true } }
      }
    });
  }

  async update(id: string, data: Prisma.CommentUncheckedUpdateInput): Promise<CommentDto> {
    return prisma.comment.update({
      where: { id },
      data,
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true, updatedAt: true } }
      }
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.comment.delete({ where: { id } });
  }
}

export const commentsRepository = new CommentsRepository();
