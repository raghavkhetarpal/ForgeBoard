import { labelsRepository } from './labels.repository';
import { AppError } from '../../infrastructure/errors';
import { LabelDto } from '@forgeboard/types';
import prisma from '../../infrastructure/prisma';

export class LabelsService {
  async createLabel(projectId: string, data: { name: string, color: string }): Promise<LabelDto> {
    const existing = await prisma.label.findUnique({
      where: { projectId_name: { projectId, name: data.name } }
    });
    if (existing) {
      throw new AppError('Label with this name already exists in the project', 400, 'BAD_REQUEST');
    }
    return labelsRepository.create(projectId, data);
  }

  async listLabels(projectId: string): Promise<LabelDto[]> {
    return labelsRepository.findByProjectId(projectId);
  }

  async updateLabel(projectId: string, labelId: string, data: { name?: string, color?: string }): Promise<LabelDto> {
    const label = await labelsRepository.findById(labelId);
    if (!label || label.projectId !== projectId) {
      throw new AppError('Label not found', 404, 'NOT_FOUND');
    }

    if (data.name && data.name !== label.name) {
      const existing = await prisma.label.findUnique({
        where: { projectId_name: { projectId, name: data.name } }
      });
      if (existing) {
        throw new AppError('Label with this name already exists in the project', 400, 'BAD_REQUEST');
      }
    }

    return labelsRepository.update(labelId, data);
  }

  async deleteLabel(projectId: string, labelId: string): Promise<void> {
    const label = await labelsRepository.findById(labelId);
    if (!label || label.projectId !== projectId) {
      throw new AppError('Label not found', 404, 'NOT_FOUND');
    }
    await labelsRepository.delete(labelId);
  }

  async attachToIssue(projectId: string, issueId: string, labelId: string): Promise<void> {
    const label = await labelsRepository.findById(labelId);
    if (!label || label.projectId !== projectId) {
      throw new AppError('Label not found or belongs to a different project', 400, 'BAD_REQUEST');
    }

    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue || issue.projectId !== projectId) {
      throw new AppError('Issue not found or belongs to a different project', 400, 'BAD_REQUEST');
    }

    try {
      await labelsRepository.attachToIssue(issueId, labelId);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err && err.code === 'P2002') {
        // Already attached
        return;
      }
      throw err;
    }
  }

  async removeFromIssue(projectId: string, issueId: string, labelId: string): Promise<void> {
    const label = await labelsRepository.findById(labelId);
    if (!label || label.projectId !== projectId) {
      throw new AppError('Label not found or belongs to a different project', 400, 'BAD_REQUEST');
    }

    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue || issue.projectId !== projectId) {
      throw new AppError('Issue not found or belongs to a different project', 400, 'BAD_REQUEST');
    }

    try {
      await labelsRepository.removeFromIssue(issueId, labelId);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err && err.code === 'P2025') {
        // Not attached
        return;
      }
      throw err;
    }
  }
}

export const labelsService = new LabelsService();
