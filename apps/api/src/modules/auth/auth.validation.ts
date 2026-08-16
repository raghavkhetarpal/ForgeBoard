import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z.string().min(1, 'Name is required').trim(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export const requestPasswordResetSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
});

export const confirmPasswordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters long'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').trim().optional(),
  avatarUrl: z.string().url('Avatar must be a valid URL').nullable().optional(),
});
