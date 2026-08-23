import { describe, it, expect, vi, beforeEach } from 'vitest';
import { labelsService } from './labels.service';
import { labelsRepository } from './labels.repository';
import prisma from '../../infrastructure/prisma';
import { AppError } from '../../infrastructure/errors';
import { LabelDto } from '@forgeboard/types';

vi.mock('./labels.repository');
vi.mock('../../infrastructure/prisma', () => ({
  default: {
    issue: { findUnique: vi.fn() },
    label: { findUnique: vi.fn() }
  }
}));

describe('LabelsService Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('attachToIssue', () => {
    it('rejects if label belongs to a different project', async () => {
      vi.mocked(labelsRepository.findById).mockResolvedValue({ id: 'label1', projectId: 'projectA' } as LabelDto);
      
      await expect(labelsService.attachToIssue('projectB', 'issue1', 'label1'))
        .rejects.toThrowError(new AppError('Label not found or belongs to a different project', 400, 'BAD_REQUEST'));
    });

    it('rejects if issue belongs to a different project', async () => {
      vi.mocked(labelsRepository.findById).mockResolvedValue({ id: 'label1', projectId: 'projectA' } as LabelDto);
      vi.mocked(prisma.issue.findUnique).mockResolvedValue({ id: 'issue1', projectId: 'projectB' } as never);
      
      await expect(labelsService.attachToIssue('projectA', 'issue1', 'label1'))
        .rejects.toThrowError(new AppError('Issue not found or belongs to a different project', 400, 'BAD_REQUEST'));
    });
  });
});
