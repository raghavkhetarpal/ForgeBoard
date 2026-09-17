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
  CORS_ORIGIN: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  SENTRY_DSN: z.string().optional(),
  RATE_LIMIT_AUTH_MAX: z.union([z.string(), z.number()]).transform((val) => typeof val === 'number' ? val : parseInt(val, 10)).default(10),
  RATE_LIMIT_AUTH_WINDOW_MS: z.union([z.string(), z.number()]).transform((val) => typeof val === 'number' ? val : parseInt(val, 10)).default(15 * 60 * 1000),
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

/**
 * Returns the list of origins allowed by CORS and Socket.IO.
 * Supports environment-based configuration via CORS_ORIGIN and NEXT_PUBLIC_APP_URL
 * (including comma-separated lists), while ensuring standard development and
 * production deployment origins are recognized.
 */
export function getAllowedOrigins(): (string | RegExp)[] {
  const origins: (string | RegExp)[] = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'https://forge-board-web.vercel.app',
    /^https:\/\/forge-board-web.*\.vercel\.app$/,
  ];

  const configuredOrigins = [
    process.env.CORS_ORIGIN,
    process.env.NEXT_PUBLIC_APP_URL,
  ];

  for (const entry of configuredOrigins) {
    if (entry) {
      for (const item of entry.split(',')) {
        const trimmed = item.trim().replace(/\/+$/, '');
        if (trimmed && !origins.some((o) => typeof o === 'string' && o.toLowerCase() === trimmed.toLowerCase())) {
          origins.push(trimmed);
        }
      }
    }
  }

  return origins;
}
