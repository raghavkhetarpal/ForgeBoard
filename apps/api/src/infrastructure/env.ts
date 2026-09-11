import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.union([z.string(), z.number()]).transform((val) => typeof val === 'number' ? val : parseInt(val, 10)).default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters').default('forgeboard-dev-session-secret-at-least-16-chars'),
  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    // Only exit in production or when explicitly configured, so tests don't break if partial env
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  return (result.success ? result.data : process.env) as Env;
}

export const env = validateEnv();
