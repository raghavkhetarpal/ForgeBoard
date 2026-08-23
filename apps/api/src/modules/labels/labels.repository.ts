import prisma from '../../infrastructure/prisma';
import { Prisma } from '@prisma/client';
import { LabelDto } from '@forgeboard/types';

export class LabelsRepository {
  async create(projectId: string, data: Prisma.LabelCreateWithoutProjectInput): Promise<LabelDto> {
    return prisma.label.create({
      data: {
        ...data,
        project: { connect: { id: projectId } }
      }
    });
  }

  async findByProjectId(projectId: string): Promise<LabelDto[]> {
    return prisma.label.findMany({
      where: { projectId },
      orderBy: { name: 'asc' }
    });
  }

  async findById(id: string): Promise<LabelDto | null> {
    return prisma.label.findUnique({ where: { id } });
  }

  async update(id: string, data: Prisma.LabelUpdateInput): Promise<LabelDto> {
    return prisma.label.update({
      where: { id },
      data
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.label.delete({ where: { id } });
  }

  async attachToIssue(issueId: string, labelId: string): Promise<void> {
    await prisma.issueLabel.create({
      data: { issueId, labelId }
    });
  }

  async removeFromIssue(issueId: string, labelId: string): Promise<void> {
    await prisma.issueLabel.delete({
      where: { issueId_labelId: { issueId, labelId } }
    });
  }
}

export const labelsRepository = new LabelsRepository();
