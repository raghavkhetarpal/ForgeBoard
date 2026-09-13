import { Router, Request, Response } from 'express';
import prisma from '../../infrastructure/prisma';
import redis from '../../infrastructure/redis';
import { metrics } from '../../infrastructure/metrics';
import { env } from '../../infrastructure/env';

const router = Router();

interface DependencyCheckResult {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

/**
 * Basic liveness check endpoint: /health
 * Returns 200 immediately if the API process is alive.
 * Used by container orchestrators and load balancers to check if the instance is up.
 */
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'api',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Deep readiness probe endpoint: /health/ready
 * Verifies real connectivity to PostgreSQL and Redis before accepting client traffic.
 */
router.get('/health/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, DependencyCheckResult> = {
    database: { status: 'down' },
    redis: { status: 'down' },
  };

  let allHealthy = true;

  // 1. Check PostgreSQL via Prisma query
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: 'up',
      latencyMs: Date.now() - dbStart,
    };
  } catch (err: unknown) {
    allHealthy = false;
    checks.database = {
      status: 'down',
      latencyMs: Date.now() - dbStart,
      error: err instanceof Error ? err.message : 'Database ping failed',
    };
  }

  // 2. Check Redis via ping
  const redisStart = Date.now();
  try {
    const pingRes = await redis.ping();
    if (pingRes === 'PONG') {
      checks.redis = {
        status: 'up',
        latencyMs: Date.now() - redisStart,
      };
    } else {
      throw new Error(`Unexpected ping response: ${pingRes}`);
    }
  } catch (err: unknown) {
    allHealthy = false;
    checks.redis = {
      status: 'down',
      latencyMs: Date.now() - redisStart,
      error: err instanceof Error ? err.message : 'Redis ping failed',
    };
  }

  const statusCode = allHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: allHealthy ? 'ready' : 'unhealthy',
    service: 'api',
    environment: env.NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    checks,
  });
});

/**
 * Metrics endpoint: /health/metrics
 * Exposes lightweight application runtime metrics (memory, HTTP status counts, sockets).
 * If Accept header contains 'text/plain', returns Prometheus text exposition format.
 */
router.get('/health/metrics', (req: Request, res: Response) => {
  const acceptHeader = req.headers.accept || '';

  if (acceptHeader.includes('text/plain')) {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(metrics.toPrometheusFormat());
    return;
  }

  res.status(200).json({
    service: 'api',
    environment: env.NODE_ENV,
    metrics: metrics.getSnapshot(),
  });
});

export default router;
