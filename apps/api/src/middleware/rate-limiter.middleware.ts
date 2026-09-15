import { Request, Response, NextFunction } from 'express';
import redis from '../infrastructure/redis';
import { env } from '../infrastructure/env';
import { logger } from '../infrastructure/logger';

export interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  keyPrefix?: string;
  keyGenerator?: (req: Request) => string;
}

/**
 * Creates a Redis-backed rate limiting middleware using atomic INCR + EXPIRE sliding window logic.
 * Defaults to environment settings or 10 requests per 15-minute window for auth routes.
 *
 * If Redis drops or errors, it fails open silently (logging the warning) so API functionality is never blocked.
 */
export function createRateLimiter(options: RateLimiterOptions = {}) {
  const windowMs = options.windowMs ?? env.RATE_LIMIT_AUTH_WINDOW_MS;
  const max = options.max ?? env.RATE_LIMIT_AUTH_MAX;
  const keyPrefix = options.keyPrefix ?? 'rate_limit:auth:';
  const keyGenerator =
    options.keyGenerator ??
    ((req: Request) => req.ip || req.socket.remoteAddress || '127.0.0.1');

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // In test environment, skip rate limiting unless specifically enabled by a test flag
    if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_RATE_LIMIT_TESTS) {
      return next();
    }

    const clientIp = keyGenerator(req);
    const key = `${keyPrefix}${clientIp}`;
    const windowSeconds = Math.ceil(windowMs / 1000);

    try {
      const pipeline = redis.pipeline();
      pipeline.incr(key);
      pipeline.ttl(key);
      const results = await pipeline.exec();

      if (!results || results.length < 2) {
        return next();
      }

      const incrErr = results[0][0];
      const count = results[0][1] as number;
      const ttl = results[1][1] as number;

      if (incrErr) {
        logger.warn('Redis rate limiter incr error, failing open', { error: String(incrErr) });
        return next();
      }

      // If key is newly created (ttl -1), set the expiration window
      if (ttl < 0) {
        await redis.expire(key, windowSeconds);
      }

      const remaining = Math.max(0, max - count);
      const ttlSeconds = ttl > 0 ? ttl : windowSeconds;

      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', remaining);

      if (count > max) {
        res.setHeader('Retry-After', ttlSeconds);
        res.status(429).json({
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: `Too many requests. Please try again after ${ttlSeconds} seconds.`,
            retryAfterSeconds: ttlSeconds,
          },
        });
        return;
      }

      next();
    } catch (err: unknown) {
      logger.warn('Redis rate limiter exception, failing open', { error: err instanceof Error ? err.message : String(err) });
      next();
    }
  };
}

export const authRateLimiter = createRateLimiter();
