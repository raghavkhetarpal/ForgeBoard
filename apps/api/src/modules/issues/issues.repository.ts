import prisma from '../../infrastructure/prisma';
import { Prisma } from '@prisma/client';
import { IssueDto } from '@forgeboard/types';

export class IssuesRepository {
  async create(data: Prisma.IssueUncheckedCreateInput): Promise<IssueDto> {
    return prisma.issue.create({
      data,
      include: {
        creator: { select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true, updatedAt: true } },
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true, updatedAt: true } }
      }
    }) as Promise<IssueDto>;
  }

  async findById(id: string): Promise<IssueDto | null> {
    return prisma.issue.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true, updatedAt: true } },
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true, updatedAt: true } }
      }
    }) as Promise<IssueDto | null>;
  }

  async findMany(projectId: string, filters: { status?: string, priority?: string, assigneeId?: string }): Promise<IssueDto[]> {
    const where: Prisma.IssueWhereInput = { projectId };
    
    if (filters.status) where.status = filters.status as any;
    if (filters.priority) where.priority = filters.priority as any;
    if (filters.assigneeId) where.assigneeId = filters.assigneeId;

    return prisma.issue.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        creator: { select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true, updatedAt: true } },
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true, updatedAt: true } }
      }
    }) as Promise<IssueDto[]>;
  }

  async update(id: string, data: Prisma.IssueUncheckedUpdateInput): Promise<IssueDto> {
    return prisma.issue.update({
      where: { id },
      data,
      include: {
        creator: { select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true, updatedAt: true } },
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true, updatedAt: true } }
      }
    }) as Promise<IssueDto>;
  }

  async delete(id: string): Promise<void> {
    await prisma.issue.delete({ where: { id } });
  }

  async isProjectMember(projectId: string, userId: string): Promise<boolean> {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } }
    });
    if (member) return true;
    
    // Check if implicit admin (workspace OWNER)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true }
    });
    if (!project) return false;

    const wsMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } }
    });
    
    return wsMember?.role === 'OWNER';
  }
}

export const issuesRepository = new IssuesRepository();
