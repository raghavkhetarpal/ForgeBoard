import { describe, it, expect, vi } from 'vitest';
import { sanitizeLogData, logger } from './logger';
import { metrics } from './metrics';
import { errorReporter } from './error-reporter';

describe('Observability Infrastructure Unit Tests', () => {
  describe('Logger & Data Sanitization', () => {
    it('redacts sensitive keys including password, token, and authorization', () => {
      const sensitivePayload = {
        email: 'user@example.com',
        password: 'superSecretPassword123',
        token: 'eyJhGciOi...',
        nested: {
          authorization: 'Bearer token123',
          cookie: 'forgeboard_session=s%3Axyz',
          safeField: 'visibleValue',
        },
      };

      const sanitized = sanitizeLogData(sensitivePayload) as Record<string, unknown>;
      const nested = sanitized.nested as Record<string, unknown>;
      expect(sanitized.email).toBe('user@example.com');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(nested.authorization).toBe('[REDACTED]');
      expect(nested.cookie).toBe('[REDACTED]');
      expect(nested.safeField).toBe('visibleValue');
    });

    it('handles primitive types and null/undefined without crashing', () => {
      expect(sanitizeLogData(null)).toBe(null);
      expect(sanitizeLogData(undefined)).toBe(undefined);
      expect(sanitizeLogData('text')).toBe('text');
      expect(sanitizeLogData(123)).toBe(123);
    });

    it('sanitizes Error objects preserving message and name', () => {
      const err = new Error('Test failure');
      const sanitized = sanitizeLogData(err) as Record<string, unknown>;
      expect(sanitized.message).toBe('Test failure');
      expect(sanitized.name).toBe('Error');
    });
  });

  describe('Metrics Collector', () => {
    it('tracks active and total requests and status code buckets', () => {
      metrics.incrementRequests();
      metrics.recordStatusCode(200);
      metrics.recordStatusCode(404);
      metrics.recordStatusCode(500);
      metrics.decrementActiveRequests();

      const snapshot = metrics.getSnapshot();
      expect(snapshot.http.totalRequests).toBeGreaterThan(0);
      expect(snapshot.http.statusCodes['2xx']).toBeGreaterThan(0);
      expect(snapshot.http.statusCodes['4xx']).toBeGreaterThan(0);
      expect(snapshot.http.statusCodes['5xx']).toBeGreaterThan(0);
      expect(snapshot.memoryUsageMb.heapUsed).toBeGreaterThan(0);
    });

    it('formats metrics in Prometheus text exposition format', () => {
      metrics.incrementRequests();
      metrics.recordStatusCode(200);
      const text = metrics.toPrometheusFormat();
      expect(text).toContain('# TYPE http_requests_total counter');
      expect(text).toContain('process_uptime_seconds');
      expect(text).toContain('nodejs_memory_heap_used_bytes');
    });

    it('tracks connected socket clients correctly', () => {
      metrics.setConnectedSockets(5);
      expect(metrics.getSnapshot().socket.connectedClients).toBe(5);
      metrics.incrementConnectedSockets();
      expect(metrics.getSnapshot().socket.connectedClients).toBe(6);
      metrics.decrementConnectedSockets();
      expect(metrics.getSnapshot().socket.connectedClients).toBe(5);
    });
  });

  describe('Centralized Error Reporter', () => {
    it('captures exceptions without throwing and logs structured details', () => {
      const errorSpy = vi.spyOn(logger, 'error');
      const testError = new Error('Synthetic database outage');

      errorReporter.captureException(testError, {
        userId: 'u_123',
        route: '/api/issues',
        method: 'POST',
      });

      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('captures informational and warning messages', () => {
      const warnSpy = vi.spyOn(logger, 'warn');
      errorReporter.captureMessage('High memory consumption alert', 'warning', {
        extra: { memoryMb: 512 },
      });
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
