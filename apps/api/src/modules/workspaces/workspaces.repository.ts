import prisma from '../../infrastructure/prisma';
import { invalidateUserSessions as invalidateUserRedisSessions } from '../../infrastructure/session';
import { WorkspaceRole } from '@forgeboard/types';

export class WorkspacesRepository {
  async findWorkspaceById(id: string) {
    return prisma.workspace.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async findWorkspaceBySlug(slug: string) {
    return prisma.workspace.findUnique({
      where: { slug },
    });
  }

  async listUserWorkspaces(userId: string) {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return memberships.map((m) => ({
      ...m.workspace,
      role: m.role as WorkspaceRole,
      joinedAt: m.createdAt,
    }));
  }

  async createWorkspaceWithOwner(data: { name: string; slug: string; ownerUserId: string }) {
    return prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: data.name,
          slug: data.slug,
        },
      });

      const member = await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: data.ownerUserId,
          role: 'OWNER',
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatarUrl: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      return { workspace, member };
    });
  }

  async findMember(workspaceId: string, userId: string) {
    return prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async findMemberById(memberId: string) {
    return prisma.workspaceMember.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        workspace: true,
      },
    });
  }

  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async addMember(workspaceId: string, userId: string, role: WorkspaceRole) {
    return prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async updateMemberRole(memberId: string, role: WorkspaceRole) {
    return prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async deleteMember(memberId: string) {
    return prisma.workspaceMember.delete({
      where: { id: memberId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async countWorkspaceOwners(workspaceId: string): Promise<number> {
    return prisma.workspaceMember.count({
      where: {
        workspaceId,
        role: 'OWNER',
      },
    });
  }

  async invalidateUserSessions(userId: string): Promise<void> {
    await invalidateUserRedisSessions(userId);
  }
}

export const workspacesRepository = new WorkspacesRepository();
