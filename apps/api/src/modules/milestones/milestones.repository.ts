import prisma from '../../infrastructure/prisma';
import { Prisma } from '@prisma/client';
import { MilestoneDto, MilestoneWithProgressDto } from '@forgeboard/types';

export class MilestonesRepository {
  async create(data: Prisma.MilestoneUncheckedCreateInput): Promise<MilestoneDto> {
    return prisma.milestone.create({ data });
  }

  async findById(id: string): Promise<MilestoneDto | null> {
    return prisma.milestone.findUnique({ where: { id } });
  }

  async findByProjectAndName(projectId: string, name: string): Promise<MilestoneDto | null> {
    return prisma.milestone.findUnique({
      where: { projectId_name: { projectId, name } },
    });
  }

  async findManyWithProgress(projectId: string): Promise<MilestoneWithProgressDto[]> {
    const milestones = await prisma.milestone.findMany({
      where: { projectId },
      orderBy: [
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
      include: {
        issues: {
          select: { id: true, status: true },
        },
      },
    });

    return milestones.map((m) => {
      const totalIssues = m.issues.length;
      const completedIssues = m.issues.filter((i) => i.status === 'DONE').length;
      const openIssues = totalIssues - completedIssues;
      const progress = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;

      const { issues: _issues, ...milestone } = m;
      return {
        ...milestone,
        totalIssues,
        completedIssues,
        openIssues,
        progress,
      };
    });
  }

  async findByIdWithProgress(id: string): Promise<MilestoneWithProgressDto | null> {
    const m = await prisma.milestone.findUnique({
      where: { id },
      include: {
        issues: {
          select: { id: true, status: true },
        },
      },
    });

    if (!m) return null;

    const totalIssues = m.issues.length;
    const completedIssues = m.issues.filter((i) => i.status === 'DONE').length;
    const openIssues = totalIssues - completedIssues;
    const progress = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;

    const { issues: _issues, ...milestone } = m;
    return {
      ...milestone,
      totalIssues,
      completedIssues,
      openIssues,
      progress,
    };
  }

  async update(id: string, data: Prisma.MilestoneUncheckedUpdateInput): Promise<MilestoneDto> {
    return prisma.milestone.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.milestone.delete({ where: { id } });
  }
}

export const milestonesRepository = new MilestonesRepository();
