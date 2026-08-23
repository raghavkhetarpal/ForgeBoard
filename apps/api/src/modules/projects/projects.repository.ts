import prisma from '../../infrastructure/prisma';
import { Prisma } from '@prisma/client';
import { ProjectStatus, ProjectRole } from '@forgeboard/types';

export class ProjectsRepository {
  async create(data: {
    workspaceId: string;
    name: string;
    description?: string | null;
    status?: ProjectStatus;
    deadline?: Date | null;
  }) {
    return prisma.project.create({
      data,
    });
  }

  async findById(projectId: string) {
    return prisma.project.findUnique({
      where: { id: projectId },
    });
  }

  async findByWorkspaceId(workspaceId: string) {
    return prisma.project.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(projectId: string, data: Prisma.ProjectUpdateInput) {
    return prisma.project.update({
      where: { id: projectId },
      data,
    });
  }

  async addMember(data: {
    projectId: string;
    workspaceId: string;
    userId: string;
    role: ProjectRole;
  }) {
    return prisma.projectMember.create({
      data,
    });
  }

  async removeMember(projectId: string, userId: string) {
    return prisma.projectMember.delete({
      where: {
        projectId_userId: { projectId, userId },
      },
    });
  }

  async updateMemberRole(projectId: string, userId: string, role: ProjectRole) {
    return prisma.projectMember.update({
      where: {
        projectId_userId: { projectId, userId },
      },
      data: { role },
    });
  }

  async findMember(projectId: string, userId: string) {
    return prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    });
  }

  async countAdmins(projectId: string) {
    return prisma.projectMember.count({
      where: { projectId, role: 'ADMIN' },
    });
  }

  async delete(projectId: string) {
    return prisma.project.delete({
      where: { id: projectId },
    });
  }
}

export const projectsRepository = new ProjectsRepository();
