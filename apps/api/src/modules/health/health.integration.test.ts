import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../index';
import prisma from '../../infrastructure/prisma';
import redis from '../../infrastructure/redis';

describe('Health & Observability Probes Integration Tests', () => {
  it('GET /health returns 200 with liveness status and uptime', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      service: 'api',
    });
    expect(typeof res.body.uptimeSeconds).toBe('number');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('GET /health/ready returns 200 with database and redis dependency latency when up', async () => {
    // Mock healthy responses from prisma and redis to test contract deterministically
    const querySpy = vi.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ '?column?': 1 }] as unknown as unknown[]);
    const pingSpy = vi.spyOn(redis, 'ping').mockResolvedValueOnce('PONG');

    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.service).toBe('api');
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.database.status).toBe('up');
    expect(typeof res.body.checks.database.latencyMs).toBe('number');
    expect(res.body.checks.redis.status).toBe('up');
    expect(typeof res.body.checks.redis.latencyMs).toBe('number');

    querySpy.mockRestore();
    pingSpy.mockRestore();
  });

  it('GET /health/ready returns 503 and degraded status when database or redis fails', async () => {
    const querySpy = vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('Connection timeout'));
    const pingSpy = vi.spyOn(redis, 'ping').mockResolvedValueOnce('PONG');

    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.checks.database.status).toBe('down');
    expect(res.body.checks.database.error).toBe('Connection timeout');
    expect(res.body.checks.redis.status).toBe('up');

    querySpy.mockRestore();
    pingSpy.mockRestore();
  });

  it('GET /health/metrics returns JSON snapshot by default', async () => {
    const res = await request(app).get('/health/metrics');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('api');
    expect(res.body.metrics).toBeDefined();
    expect(res.body.metrics.http).toBeDefined();
    expect(res.body.metrics.memoryUsageMb).toBeDefined();
    expect(res.body.metrics.socket).toBeDefined();
  });

  it('GET /health/metrics returns Prometheus exposition format when text/plain requested', async () => {
    const res = await request(app)
      .get('/health/metrics')
      .set('Accept', 'text/plain');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('process_uptime_seconds');
    expect(res.text).toContain('http_requests_total');
    expect(res.text).toContain('socketio_connected_clients');
  });

  it('sets X-Request-Id header on all responses', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(typeof res.headers['x-request-id']).toBe('string');
  });
});
