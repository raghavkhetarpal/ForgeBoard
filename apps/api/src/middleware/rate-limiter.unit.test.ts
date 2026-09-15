/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRateLimiter } from './rate-limiter.middleware';
import redis from '../infrastructure/redis';

describe('Rate Limiter Middleware Unit Tests', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    delete process.env.ENABLE_RATE_LIMIT_TESTS;
    req = {
      ip: '192.168.1.1',
      socket: { remoteAddress: '192.168.1.1' },
      headers: {},
    };
    res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it('skips rate limiting in test mode when ENABLE_RATE_LIMIT_TESTS is not set', async () => {
    const middleware = createRateLimiter({ max: 5, windowMs: 60000 });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('allows requests below the limit when rate limit tests are enabled', async () => {
    process.env.ENABLE_RATE_LIMIT_TESTS = 'true';
    const pipelineMock = {
      incr: vi.fn(),
      ttl: vi.fn(),
      exec: vi.fn().mockResolvedValue([
        [null, 1], // incr count = 1
        [null, 60], // ttl = 60s
      ]),
    };
    vi.spyOn(redis, 'pipeline').mockReturnValue(pipelineMock as any);

    const middleware = createRateLimiter({ max: 5, windowMs: 60000 });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 4);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('sets key expiration when key is newly created (ttl < 0)', async () => {
    process.env.ENABLE_RATE_LIMIT_TESTS = 'true';
    const pipelineMock = {
      incr: vi.fn(),
      ttl: vi.fn(),
      exec: vi.fn().mockResolvedValue([
        [null, 1],
        [null, -1], // ttl < 0 indicates new key
      ]),
    };
    vi.spyOn(redis, 'pipeline').mockReturnValue(pipelineMock as any);
    const expireSpy = vi.spyOn(redis, 'expire').mockResolvedValue(1 as any);

    const middleware = createRateLimiter({ max: 5, windowMs: 60000 });
    await middleware(req, res, next);

    expect(expireSpy).toHaveBeenCalledWith('rate_limit:auth:192.168.1.1', 60);
    expect(next).toHaveBeenCalled();
  });

  it('rejects requests exceeding the limit with 429 and Retry-After header', async () => {
    process.env.ENABLE_RATE_LIMIT_TESTS = 'true';
    const pipelineMock = {
      incr: vi.fn(),
      ttl: vi.fn(),
      exec: vi.fn().mockResolvedValue([
        [null, 6], // count = 6 (> max 5)
        [null, 45], // ttl = 45s remaining
      ]),
    };
    vi.spyOn(redis, 'pipeline').mockReturnValue(pipelineMock as any);

    const middleware = createRateLimiter({ max: 5, windowMs: 60000 });
    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', 45);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests. Please try again after 45 seconds.',
        retryAfterSeconds: 45,
      },
    });
  });

  it('fails open silently when Redis pipeline throws an exception', async () => {
    process.env.ENABLE_RATE_LIMIT_TESTS = 'true';
    vi.spyOn(redis, 'pipeline').mockImplementation(() => {
      throw new Error('Redis connection refused');
    });

    const middleware = createRateLimiter({ max: 5, windowMs: 60000 });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
