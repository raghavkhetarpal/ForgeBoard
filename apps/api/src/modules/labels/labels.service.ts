import { labelsRepository } from './labels.repository';
import { AppError } from '../../infrastructure/errors';
import { LabelDto } from '@forgeboard/types';
import prisma from '../../infrastructure/prisma';
import { getSocketServer } from '../../infrastructure/socket';
import { issuesRepository } from '../issues/issues.repository';

export class LabelsService {
  async createLabel(projectId: string, data: { name: string, color: string }): Promise<LabelDto> {
    const existing = await prisma.label.findUnique({
      where: { projectId_name: { projectId, name: data.name } }
    });
    if (existing) {
      throw new AppError('Label with this name already exists in the project', 400, 'BAD_REQUEST');
    }
    const created = await labelsRepository.create(projectId, data);
    try {
      getSocketServer().to(`project:${projectId}`).emit('label:created', { label: created });
    } catch (e) {
      console.error('Failed to emit label:created event', e);
    }
    return created;
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

    const updated = await labelsRepository.update(labelId, data);
    try {
      getSocketServer().to(`project:${projectId}`).emit('label:updated', { label: updated });
    } catch (e) {
      console.error('Failed to emit label:updated event', e);
    }
    return updated;
  }

  async deleteLabel(projectId: string, labelId: string): Promise<void> {
    const label = await labelsRepository.findById(labelId);
    if (!label || label.projectId !== projectId) {
      throw new AppError('Label not found', 404, 'NOT_FOUND');
    }
    await labelsRepository.delete(labelId);
    try {
      getSocketServer().to(`project:${projectId}`).emit('label:deleted', { labelId, projectId });
    } catch (e) {
      console.error('Failed to emit label:deleted event', e);
    }
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

    try {
      const updatedIssue = await issuesRepository.findById(issueId);
      if (updatedIssue) {
        getSocketServer().to(`project:${projectId}`).emit('issue:updated', { issue: updatedIssue });
      }
    } catch (e) {
      console.error('Failed to emit issue:updated after attachToIssue', e);
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

    try {
      const updatedIssue = await issuesRepository.findById(issueId);
      if (updatedIssue) {
        getSocketServer().to(`project:${projectId}`).emit('issue:updated', { issue: updatedIssue });
      }
    } catch (e) {
      console.error('Failed to emit issue:updated after removeFromIssue', e);
    }
  }
}

export const labelsService = new LabelsService();

