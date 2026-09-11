import { z } from 'zod';

export const createIssueSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assigneeId: z.string().optional().nullable(),
  milestoneId: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
});

export const updateIssueSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assigneeId: z.string().optional().nullable(),
  milestoneId: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
});

export const listIssuesSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  assigneeId: z.string().optional(),
  labelId: z.string().optional(),
  milestoneId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'priority', 'position', 'dueDate', 'title']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  all: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
});

export type ListIssuesQuery = z.infer<typeof listIssuesSchema>;

export const moveIssueSchema = z.object({
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']),
  position: z.number().int().min(0), // The target index (0-based) in the column
});
