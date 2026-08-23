import { z } from 'zod';
import { ProjectStatus, ProjectRole } from '@forgeboard/types';

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'] as const).optional(),
  deadline: z.string().datetime().optional().nullable(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'] as const).optional(),
  deadline: z.string().datetime().optional().nullable(),
});

export const addProjectMemberSchema = z.object({
  userId: z.string().cuid(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER'] as const),
});

export const updateProjectMemberSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER'] as const),
});
